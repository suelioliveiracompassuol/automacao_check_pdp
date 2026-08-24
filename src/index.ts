/**
 * PDP Feature Monitor - Main Orchestrator
 *
 * This script checks all configured PDPs for required features
 * and generates a report of the results.
 */

import { chromium, firefox, Browser } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  TIMING,
  buildPdpUrl,
  isFeatureSupported,
  getApplicableFeatures,
} from "./checks/configs/config.js";
import {
  CheckResult,
  PdpCheckResult,
  MonitoringReport,
  SkuConfig,
} from "./types.js";
import {
  FEATURE_CHECKERS,
  logFeaturesGrouped,
  dismissCookieBanner,
  scrollAndLoadContent,
} from "./checks/featureRunner.js";
import { generateHtmlReport, generateJsonReport } from "./reporter.js";
import { setupEndpointMonitor } from "./checks/endpointResponse.js";
import { checkI18nKeys } from "./checks/i18n.js";
import { setupEinsteinShowcaseCapture } from "./checks/showcases.js";
import {
  setupRatingConsistencyCapture,
  captureRatingFromDOM,
} from "./checks/ratingConsistency.js";
import { setupProductVariationsCapture } from "./checks/productVariations.js";

import {
  setupRemoteConfigCapture,
  setupCommerceFeatureFlagCapture,
  isFeatureEnabledByRemoteConfig,
  formatFlagsForLog,
  getFlagsByCategory,
  countCapturedFlags,
  getCommerceFlagsByCategory,
  countCommerceFlags,
  COUNTRY_TO_LOCALE,
  RemoteConfigFlags,
  CommerceFeatureFlags,
} from "./checks/remoteConfig.js";
import { loadSkus } from "./checks/configs/skus/skus.js";
import { FEATURES } from "./checks/configs/features.js";
import { PDP_ENDPOINT_RULES } from "./checks/configs/endpoints-rules.js";
import { runWithConcurrency, jitter, parseConcurrency } from "./concurrency.js";
import {
  describePlaywrightTraceMode,
  finalizeBrowserTrace,
  getPlaywrightTraceMode,
  startBrowserTraceIfEnabled,
} from "./playwrightTrace.js";

import { createStandardContext } from "./browserSetup.js";
import { formatFlagLogValue } from "./utils.js";

interface CheckPdpParams {
  browser: Browser;
  sku: SkuConfig;
  outputDir: string;
  featuresFilter: Set<string> | null;
  endpointMatch: string | null;
  monitorEndpoints: boolean;
  cachedRemoteConfig?: RemoteConfigFlags | null;
  cachedCommerceFlags?: CommerceFeatureFlags | null;
}

/**
 * Check a single PDP for all applicable features
 */
async function checkPdp(params: CheckPdpParams): Promise<PdpCheckResult> {
  const {
    browser,
    sku,
    outputDir,
    featuresFilter,
    endpointMatch,
    monitorEndpoints,
    cachedRemoteConfig,
    cachedCommerceFlags,
  } = params;

  const url = buildPdpUrl(sku);
  const timestamp = new Date().toISOString();
  const features: CheckResult[] = [];
  let pageScreenshot: string | undefined;
  let loadTime: number | undefined;
  let remoteConfigFlags: RemoteConfigFlags | null = cachedRemoteConfig ?? null;
  let commerceFeatureFlags: CommerceFeatureFlags | null =
    cachedCommerceFlags ?? null;

  console.log(`\n📦 Checking: ${sku.name} (${sku.sku})`);
  console.log(`   URL: ${url}`);

  const context = await createStandardContext(browser, url);
  const page = await context.newPage();

  // Legacy single-pattern endpoint check
  const endpointCalls: Array<{ url: string; method: string; status: number }> =
    [];
  if (endpointMatch) {
    page.on("response", (response) => {
      const url = response.url();
      if (!url.includes(endpointMatch)) {
        return;
      }
      endpointCalls.push({
        url,
        method: response.request().method(),
        status: response.status(),
      });
    });
  }

  // Structured PDP endpoint monitor (validates status + body fields)
  const collectEndpointResults = monitorEndpoints
    ? setupEndpointMonitor(page, PDP_ENDPOINT_RULES)
    : null;

  // Setup Remote Config capture BEFORE navigation (if not already cached)
  const locale = COUNTRY_TO_LOCALE[sku.country] || "pt-BR";
  const collectRemoteConfig = cachedRemoteConfig
    ? null
    : setupRemoteConfigCapture(page, locale);

  const collectCommerceFlags = cachedCommerceFlags
    ? null
    : setupCommerceFeatureFlagCapture(page);

  // Setup Einstein showcase capture BEFORE navigation
  setupEinsteinShowcaseCapture(page);

  // Setup rating consistency capture BEFORE navigation (intercepts API responses)
  setupRatingConsistencyCapture(page);

  // Setup product variations capture BEFORE navigation (intercepts BFF API + SSR)
  setupProductVariationsCapture(page);

  const traceMode = getPlaywrightTraceMode();
  const traceZipPath = path.join(
    outputDir,
    "traces",
    `${sku.sku.replace(/[^a-zA-Z0-9._-]+/g, "_")}_${Date.now()}.zip`,
  );
  let traceActive = await startBrowserTraceIfEnabled(context, traceMode);

  try {
    // Navigate to PDP (with retry on HTTP2 errors)
    const startTime = Date.now();
    let response;
    let lastError;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        response = await page.goto(url, {
          timeout: TIMING.navigationTimeout,
          waitUntil: "domcontentloaded",
        });
        lastError = null;
        break;
      } catch (e) {
        lastError = e;
        if (attempt < 2 && e instanceof Error && e.message.includes("HTTP2")) {
          console.log(
            `   ⚠️ HTTP2 error, retrying (attempt ${attempt + 1})...`,
          );
          await new Promise<void>((resolve) => setTimeout(resolve, 2000));
        }
      }
    }

    if (lastError) {
      throw lastError;
    }

    loadTime = Date.now() - startTime;

    if (!response || response.status() >= 400) {
      throw new Error(
        `HTTP ${response?.status() || "unknown"} - Page failed to load`,
      );
    }

    console.log(`   ⏱️  Load time: ${loadTime}ms`);

    // Wait for the page to fully load after domcontentloaded
    await page
      .waitForLoadState("load", { timeout: TIMING.pageLoadSettleTime })
      .catch(() => {});

    // Read product rating from JSON-LD immediately after load, before any DOM interactions
    // that could cause React to re-render/clear the SSR script tags.
    await captureRatingFromDOM(page);

    // Dismiss cookie banner
    await dismissCookieBanner(page);

    // Scroll progressively down to load ALL lazy content, then back to top
    await scrollAndLoadContent(page);

    // Get applicable features for this SKU
    let applicableFeatures = getApplicableFeatures(sku);

    // Apply external features filter if provided via env (e.g. from workflow_dispatch input)
    if (featuresFilter && featuresFilter.size > 0) {
      applicableFeatures = applicableFeatures.filter((f) =>
        featuresFilter.has(f.key),
      );
    }

    // Capture remote config flags if not already cached
    if (!remoteConfigFlags && collectRemoteConfig) {
      remoteConfigFlags = await collectRemoteConfig();
      if (remoteConfigFlags) {
        const totalFlags = countCapturedFlags(remoteConfigFlags);
        console.log(
          `   🔧 Remote Config capturado: ${totalFlags} flags (locale: ${remoteConfigFlags.locale})`,
        );
        console.log(`      ${formatFlagsForLog(remoteConfigFlags)}`);

        // Log detailed flags by category
        const categories = getFlagsByCategory(remoteConfigFlags);
        for (const [category, flags] of Object.entries(categories)) {
          const flagSummary = Object.entries(flags)
            .map(([k, v]) => `${k}=${formatFlagLogValue(v)}`)
            .join(", ");
          console.log(`      ${category}: ${flagSummary}`);
        }
      }
    }

    // Commerce flags: intercept /feature-flag (setup before goto) and/or use DOM fallback
    if (!cachedCommerceFlags && collectCommerceFlags) {
      commerceFeatureFlags = await collectCommerceFlags();
    }

    // Log commerce feature flags if captured
    if (commerceFeatureFlags) {
      const totalFlags = countCommerceFlags(commerceFeatureFlags);
      console.log(
        `   🛒 Commerce Feature Flags capturado: ${totalFlags} flags`,
      );

      // Log detailed flags by category
      const categories = getCommerceFlagsByCategory(commerceFeatureFlags);
      for (const [category, flags] of Object.entries(categories)) {
        const flagSummary = Object.entries(flags)
          .map(([k, v]) => `${k}=${formatFlagLogValue(v)}`)
          .join(", ");
        console.log(`      ${category}: ${flagSummary}`);
      }
    }

    // Run all feature checks — parallelized for performance.
    // Since scrollAndLoadContent() has already triggered all lazy content,
    // checks can safely run in parallel (they only read DOM state).

    // Phase 1: Pre-filter features (vendor support, remote config)
    interface RunnableCheck {
      featureConfig: (typeof applicableFeatures)[number];
      checker: (typeof FEATURE_CHECKERS)[string];
      rcCheck: ReturnType<typeof isFeatureEnabledByRemoteConfig>;
    }
    const runnableChecks: RunnableCheck[] = [];

    for (const featureConfig of applicableFeatures) {
      const checker = FEATURE_CHECKERS[featureConfig.key];

      if (!checker) {
        console.log(`   ⚠️  No checker for ${featureConfig.key}`);
        continue;
      }

      // Check vendor support
      if (!isFeatureSupported(featureConfig, sku.vendor)) {
        features.push({
          feature: featureConfig.name,
          featureKey: featureConfig.key,
          passed: true,
          status: "na",
          message: `N/A para ${sku.vendor}`,
        });
        continue;
      }

      // Check if feature is enabled by Remote Config
      const rcCheck = isFeatureEnabledByRemoteConfig(
        featureConfig.key,
        remoteConfigFlags,
      );
      if (!rcCheck.enabled && rcCheck.flagKey) {
        // Feature is disabled by remote config - not an error
        features.push({
          feature: featureConfig.name,
          featureKey: featureConfig.key,
          passed: true,
          status: "disabled",
          message: `Desabilitado via Remote Config (${rcCheck.flagKey}=${JSON.stringify(rcCheck.flagValue)})`,
          flagKey: rcCheck.flagKey,
          flagValue: rcCheck.flagValue,
        });
        continue;
      }

      runnableChecks.push({ featureConfig, checker, rcCheck });
    }

    // Phase 2: Execute checks in parallel
    const checkResults = await Promise.all(
      runnableChecks.map(async ({ featureConfig, checker, rcCheck }) => {
        const result = await checker(page);
        if (rcCheck.flagKey) {
          result.flagKey = rcCheck.flagKey;
          result.flagValue = rcCheck.flagValue;
        }
        return { featureConfig, result };
      }),
    );

    // Phase 3: Collect results and take screenshots sequentially for failures
    for (const { featureConfig, result } of checkResults) {
      features.push(result);

      // Take screenshot on failure (skip na and disabled)
      if (
        !result.passed &&
        result.status !== "na" &&
        result.status !== "disabled"
      ) {
        const screenshotName = `${sku.sku}_${featureConfig.key}_${Date.now()}.png`;
        const screenshotPath = path.join(
          outputDir,
          "screenshots",
          screenshotName,
        );

        try {
          await page.screenshot({ path: screenshotPath, fullPage: false });
          result.screenshot = path.relative(outputDir, screenshotPath);
        } catch {
          // Ignore screenshot errors
        }
      }
    }

    // Check for untranslated i18n keys (runs on every PDP)
    const i18nResult = await checkI18nKeys(page);
    features.push(i18nResult);

    if (!i18nResult.passed && i18nResult.status !== "na") {
      const screenshotName = `${sku.sku}_i18n_${Date.now()}.png`;
      const screenshotPath = path.join(
        outputDir,
        "screenshots",
        screenshotName,
      );
      try {
        await page.screenshot({ path: screenshotPath, fullPage: false });
        i18nResult.screenshot = path.relative(outputDir, screenshotPath);
      } catch {
        // Ignore screenshot errors
      }
    }

    // Structured PDP endpoint results (status + body validation)
    if (collectEndpointResults) {
      const endpointResults = await collectEndpointResults();
      for (const r of endpointResults) {
        // Skip rules that captured nothing — the endpoint may not apply to this page variant
        if (r.message.includes("Nenhuma chamada")) {
          continue;
        }
        features.push(r);
      }
    }

    // Legacy single-pattern endpoint check
    if (endpointMatch) {
      const failedCalls = endpointCalls.filter((c) => c.status >= 400);
      let endpointResult: CheckResult;

      if (endpointCalls.length === 0) {
        endpointResult = {
          feature: "Resposta de endpoint",
          featureKey: "endpointResponse",
          passed: false,
          status: "fail",
          message: `Nenhuma chamada capturada para o endpoint contendo "${endpointMatch}"`,
        };
      } else if (failedCalls.length > 0) {
        endpointResult = {
          feature: "Resposta de endpoint",
          featureKey: "endpointResponse",
          passed: false,
          status: "fail",
          message: `${failedCalls.length}/${endpointCalls.length} chamada(s) com erro (>= 400) para "${endpointMatch}"`,
          details: {
            endpointMatch,
            totalCalls: endpointCalls.length,
            failedCalls: failedCalls.map((c) => ({
              method: c.method,
              status: c.status,
              url: c.url,
            })),
          },
        };
      } else {
        endpointResult = {
          feature: "Resposta de endpoint",
          featureKey: "endpointResponse",
          passed: true,
          status: "pass",
          message: `${endpointCalls.length} chamada(s) ok para endpoint contendo "${endpointMatch}"`,
          details: {
            endpointMatch,
            totalCalls: endpointCalls.length,
            calls: endpointCalls
              .slice(0, 10)
              .map((c) => ({ method: c.method, status: c.status, url: c.url })),
          },
        };
      }

      features.push(endpointResult);
    }

    // Log all features in grouped order (same as HTML report)
    logFeaturesGrouped(features);

    // Overall success: all required (non-optional) features passed
    const requiredFeatures = features.filter((f) => {
      const config = FEATURES.find((fc) => fc.key === f.featureKey);
      // Endpoint monitor results also count as required
      if (f.featureKey.startsWith("endpoint_")) {
        return true;
      }
      // i18n keys check is always required
      if (f.featureKey === "i18nKeys") {
        return true;
      }
      return config && !config.optional;
    });

    if (endpointMatch) {
      const endpointResult = features.find(
        (f) => f.featureKey === "endpointResponse",
      );
      if (endpointResult) {
        requiredFeatures.push(endpointResult);
      }
    }

    const success = requiredFeatures.every(
      (f) => f.passed || f.status === "na" || f.status === "disabled",
    );

    // Take full page screenshot if any failure
    if (!success) {
      const screenshotName = `${sku.sku}_fullpage_${Date.now()}.png`;
      const screenshotPath = path.join(
        outputDir,
        "screenshots",
        screenshotName,
      );
      await page
        .screenshot({ path: screenshotPath, fullPage: true })
        .catch(() => {});
      pageScreenshot = path.relative(outputDir, screenshotPath);
    }

    const playwrightTracePathAbs = await finalizeBrowserTrace(
      context,
      traceMode,
      traceActive,
      success,
      traceZipPath,
    );
    traceActive = false;
    if (playwrightTracePathAbs) {
      console.log(`   🎬 Trace salvo: ${playwrightTracePathAbs}`);
    }

    return {
      sku: sku.sku,
      name: sku.name,
      url,
      vendor: sku.vendor,
      country: sku.country,
      channel: sku.channel,
      timestamp,
      success,
      loadTime,
      features,
      pageScreenshot,
      playwrightTracePath: playwrightTracePathAbs
        ? path.relative(outputDir, playwrightTracePathAbs)
        : undefined,
      remoteConfigFlags: remoteConfigFlags ?? undefined,
      commerceFeatureFlags: commerceFeatureFlags ?? undefined,
    };
  } catch (error) {
    console.log(
      `   ❌ Error: ${error instanceof Error ? error.message : String(error)}`,
    );

    // Take screenshot of error state
    const screenshotName = `${sku.sku}_error_${Date.now()}.png`;
    const screenshotPath = path.join(outputDir, "screenshots", screenshotName);
    await page
      .screenshot({ path: screenshotPath, fullPage: true })
      .catch(() => {});
    pageScreenshot = path.relative(outputDir, screenshotPath);

    const playwrightTracePathAbs = await finalizeBrowserTrace(
      context,
      traceMode,
      traceActive,
      false,
      traceZipPath,
    );
    traceActive = false;
    if (playwrightTracePathAbs) {
      console.log(`   🎬 Trace salvo: ${playwrightTracePathAbs}`);
    }

    return {
      sku: sku.sku,
      name: sku.name,
      url,
      vendor: sku.vendor,
      country: sku.country,
      channel: sku.channel,
      timestamp,
      success: false,
      loadTime,
      features,
      error: error instanceof Error ? error.message : String(error),
      pageScreenshot,
      playwrightTracePath: playwrightTracePathAbs
        ? path.relative(outputDir, playwrightTracePathAbs)
        : undefined,
      remoteConfigFlags: remoteConfigFlags ?? undefined,
      commerceFeatureFlags: commerceFeatureFlags ?? undefined,
    };
  } finally {
    if (traceActive) {
      await finalizeBrowserTrace(
        context,
        traceMode,
        traceActive,
        false,
        traceZipPath,
      ).catch(() => {});
    }
    await context.close().catch(() => {});
  }
}

/**
 * Main execution function
 */
async function main() {
  const runId = `run_${Date.now()}`;
  const startTime = new Date();
  const outputDir = path.join(process.cwd(), "docs", "reports", runId);

  // Create output directories
  fs.mkdirSync(path.join(outputDir, "screenshots"), { recursive: true });

  // Carrega SKUs do Firestore (ou JSON como fallback)
  const SKUS = await loadSkus();

  // Parse optional env-based filters (set via workflow_dispatch inputs)
  let featuresFilter: Set<string> | null = process.env.FEATURES_FILTER?.trim()
    ? new Set(
        process.env.FEATURES_FILTER.split(",")
          .map((f) => f.trim())
          .filter(Boolean),
      )
    : null;

  const operationsFilter: string[] | null =
    process.env.OPERATIONS_FILTER?.trim()
      ? process.env.OPERATIONS_FILTER.split(",")
          .map((o) => o.trim())
          .filter(Boolean)
      : null;

  const endpointMatch: string | null = process.env.ENDPOINT_MATCH?.trim()
    ? process.env.ENDPOINT_MATCH.trim()
    : null;

  // Enable structured PDP endpoint monitoring (validates status + body fields)
  // Defaults to true. Set MONITOR_ENDPOINTS=false to disable.
  const monitorEndpoints = process.env.MONITOR_ENDPOINTS !== "false";

  // Parse optional SKU filter
  const skuFilter: string[] | null = process.env.SKU_FILTER?.trim()
    ? process.env.SKU_FILTER.split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : null;

  // Apply operations filter (format: "natura-BR", "avon-BR", "natura-BR-social", etc.)
  let skusToCheck = operationsFilter
    ? SKUS.filter((sku) => {
        const key = `${sku.vendor}-${sku.country}${(sku.channel || "ecommerce") === "socialcommerce" ? "-social" : ""}`;
        return operationsFilter.includes(key);
      })
    : SKUS;

  // Apply SKU filter if provided
  if (skuFilter) {
    skusToCheck = skusToCheck.filter((sku) => skuFilter.includes(sku.sku));
  }

  // =========================================================================
  // MODE=smoke — quick healthcheck: 1 SKU per domain, subset of features
  // =========================================================================
  const SMOKE_FEATURES = ["images", "addToCart", "pricing"];
  const isSmokeMode = process.env.MODE === "smoke";

  if (isSmokeMode) {
    // Override features filter to smoke subset
    if (!featuresFilter) {
      featuresFilter = new Set(SMOKE_FEATURES);
    } else {
      // Intersect user filter with smoke subset
      featuresFilter = new Set(
        SMOKE_FEATURES.filter((f) => featuresFilter!.has(f)),
      );
    }

    // Limit to 1 SKU per domain
    const seen = new Set<string>();
    skusToCheck = skusToCheck.filter((sku) => {
      const key = `${sku.vendor}-${sku.country}${(sku.channel || "ecommerce") === "socialcommerce" ? "-social" : ""}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  console.log("🚀 PDP Feature Monitor");
  console.log(`📅 Started: ${startTime.toISOString()}`);
  console.log(`📂 Output: ${outputDir}`);
  const operationsFilterNote =
    operationsFilter && operationsFilter.length > 0
      ? ` (filtro: ${operationsFilter.join(", ")})`
      : "";
  console.log(`📦 SKUs to check: ${skusToCheck.length}${operationsFilterNote}`);
  if (isSmokeMode) {
    console.log(
      `⚡ MODE=smoke — healthcheck rápido (1 SKU/domínio, features: ${SMOKE_FEATURES.join(", ")})`,
    );
  }
  if (featuresFilter) {
    console.log(`🔍 Features filter: ${[...featuresFilter].join(", ")}`);
  }
  if (endpointMatch) {
    console.log(`🌐 Endpoint check (ENDPOINT_MATCH): ${endpointMatch}`);
  }
  if (monitorEndpoints) {
    console.log(
      `🌐 Monitoramento de endpoints PDP ativado (${PDP_ENDPOINT_RULES.length} regras)`,
    );
  }
  const traceMode = getPlaywrightTraceMode();
  if (traceMode !== "off") {
    console.log(
      `🎬 Trace Playwright: ${describePlaywrightTraceMode(traceMode)} — abrir com: npx playwright show-trace <caminho.zip>`,
    );
  }
  console.log("");

  // Launch browsers
  // Chromium for BR sites, Firefox for international (HTTP2 issues with headless Chromium)
  const isHeadless = process.env.HEADLESS !== "false";
  const browserChromium = await chromium.launch({
    headless: isHeadless,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-dev-shm-usage",
    ],
  });
  let browserFirefox: Browser | null = null;
  try {
    browserFirefox = await firefox.launch({ headless: isHeadless });
  } catch {
    console.log(
      "⚠️  Firefox not available, falling back to Chromium for all sites",
    );
  }

  const results: PdpCheckResult[] = [];

  // Concurrency from CONCURRENCY env var (default 3; hard-capped at 8 to reduce WAF risk)
  const concurrency = parseConcurrency(3);
  console.log(
    `⚡ Concorrência: ${concurrency} worker(s) | jitter 1\u20133 s entre SKUs do mesmo domínio\n`,
  );

  // Group SKUs by domain key so same-origin requests stay serial within each group
  const skusByDomain = new Map<string, typeof skusToCheck>();
  for (const sku of skusToCheck) {
    const domainKey = `${sku.vendor}-${sku.country}${(sku.channel || "ecommerce") === "socialcommerce" ? "-social" : ""}`;
    if (!skusByDomain.has(domainKey)) {
      skusByDomain.set(domainKey, []);
    }
    skusByDomain.get(domainKey)!.push(sku);
  }
  console.log(
    `🗂️  ${skusByDomain.size} grupo(s) de domínio: ${[...skusByDomain.keys()].join(", ")}\n`,
  );

  try {
    // One async task per domain group; groups run in parallel up to the concurrency limit.
    // SKUs within each group run serially with a random 1\u20133 s jitter between requests.
    const skuTasks = [...skusByDomain.entries()].map(
      ([, group]) =>
        async (): Promise<PdpCheckResult[]> => {
          const groupResults: PdpCheckResult[] = [];
          for (let i = 0; i < group.length; i++) {
            if (i > 0) {
              await jitter(1000, 2000); // 1\u20133 s between consecutive hits on the same domain
            }
            const sku = group[i];
            const useFirefox =
              browserFirefox !== null &&
              sku.vendor === "natura" &&
              sku.country !== "BR" &&
              (sku.channel || "ecommerce") === "ecommerce";
            const browser = useFirefox ? browserFirefox! : browserChromium;
            groupResults.push(
              await checkPdp({
                browser,
                sku,
                outputDir,
                featuresFilter,
                endpointMatch,
                monitorEndpoints,
              }),
            );
          }
          return groupResults;
        },
    );
    const groupedResults = await runWithConcurrency(skuTasks, concurrency);
    results.push(...groupedResults.flat());
  } finally {
    await browserChromium.close();
    if (browserFirefox) {
      await browserFirefox.close();
    }
  }

  const endTime = new Date();
  const durationMs = endTime.getTime() - startTime.getTime();

  // Generate report
  const report: MonitoringReport = {
    runId,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    durationMs,
    summary: {
      total: results.length,
      passed: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success && !r.error).length,
      errors: results.filter((r) => r.error).length,
    },
    results,
  };

  // Save reports
  const htmlPath = path.join(outputDir, "report.html");
  const jsonPath = path.join(outputDir, "report.json");

  fs.writeFileSync(htmlPath, generateHtmlReport(report));
  fs.writeFileSync(jsonPath, generateJsonReport(report));

  // Copy to last-report files and update index
  try {
    const docsDir = path.join(process.cwd(), "docs");
    const reportsDir = path.join(docsDir, "reports");

    // Copy to last-report
    fs.copyFileSync(htmlPath, path.join(docsDir, "last-report.html"));
    fs.copyFileSync(jsonPath, path.join(docsDir, "last-report.json"));

    // Update index.json
    const indexJsonPath = path.join(reportsDir, "index.json");
    let reportsIndex: { reports: MonitoringReport[] } = { reports: [] };

    if (fs.existsSync(indexJsonPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(indexJsonPath, "utf-8"));
        if (data && Array.isArray(data.reports)) {
          reportsIndex = data;
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        console.log("Could not parse existing report index, creating new one.");
      }
    }

    // Create a new entry for the index, removing full results to keep it small
    const reportForIndex: Partial<MonitoringReport> & {
      htmlPath: string;
      jsonPath: string;
    } = {
      runId: report.runId,
      startTime: report.startTime,
      endTime: report.endTime,
      durationMs: report.durationMs,
      summary: report.summary,
      // Paths relative to the /docs root for the frontend
      htmlPath: path.join("reports", runId, "report.html").replace(/\\/g, "/"),
      jsonPath: path.join("reports", runId, "report.json").replace(/\\/g, "/"),
    };

    reportsIndex.reports.unshift(reportForIndex as MonitoringReport);

    // Limit to 100 most recent reports
    if (reportsIndex.reports.length > 100) {
      reportsIndex.reports = reportsIndex.reports.slice(0, 100);
    }

    fs.writeFileSync(indexJsonPath, JSON.stringify(reportsIndex, null, 2));
    console.log(`\n✅  Índice de relatórios atualizado: ${indexJsonPath}`);
  } catch (e) {
    console.error("\n❌ Erro ao atualizar o histórico de relatórios:", e);
  }

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 RESUMO");
  console.log("=".repeat(60));
  console.log(`✅ Passou: ${report.summary.passed}/${report.summary.total}`);
  console.log(`❌ Falhou: ${report.summary.failed}/${report.summary.total}`);
  console.log(`⚠️  Erros: ${report.summary.errors}/${report.summary.total}`);
  console.log(`⏱️  Duração: ${(durationMs / 1000).toFixed(1)}s`);
  console.log(`📄 Relatório: ${htmlPath}`);
  console.log("=".repeat(60));

  // Exit with error code if any failures
  if (report.summary.failed > 0 || report.summary.errors > 0) {
    console.log("\n🔴 Há falhas no monitoramento!");
    process.exit(1);
  } else {
    console.log("\n🟢 Todas as verificações passaram!");
    process.exit(0);
  }
}

// Run
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
