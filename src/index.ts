/**
 * PDP Feature Monitor - Main Orchestrator
 *
 * This script checks all configured PDPs for required features
 * and generates a report of the results.
 */

import { chromium, firefox, Browser } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
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
import {
  setupRemoteConfigCapture,
  extractCommerceFeatureFlags,
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
import { SKUS } from "./checks/configs/skus.js";
import { runExploratoryJourney } from "./explore.js";
import { DOMAINS } from "./checks/configs/domains.js";
import { FEATURES } from "./checks/configs/features.js";
import { PDP_ENDPOINT_RULES } from "./checks/configs/enpoints-rules.js";

/**
 * Check a single PDP for all applicable features
 */
async function checkPdp(
  browser: Browser,
  sku: SkuConfig,
  outputDir: string,
  featuresFilter: Set<string> | null,
  endpointMatch: string | null,
  monitorEndpoints: boolean,
  cachedRemoteConfig?: RemoteConfigFlags | null,
  cachedCommerceFlags?: CommerceFeatureFlags | null,
): Promise<PdpCheckResult> {
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

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {
      "Accept-Language": "pt-BR,pt;q=0.9,es;q=0.8,en;q=0.7",
    },
  });

  // Mask automation signals that trigger Akamai bot detection
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    Object.defineProperty(navigator, "plugins", {
      get: () => [1, 2, 3, 4, 5],
    });
    Object.defineProperty(navigator, "languages", {
      get: () => ["pt-BR", "pt", "es", "en"],
    });
  });

  const page = await context.newPage();

  // Legacy single-pattern endpoint check
  const endpointCalls: Array<{ url: string; method: string; status: number }> =
    [];
  if (endpointMatch) {
    page.on("response", (response) => {
      const url = response.url();
      if (!url.includes(endpointMatch)) return;
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
  const collectRemoteConfig = !cachedRemoteConfig
    ? setupRemoteConfigCapture(page, locale)
    : null;

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
          await page.waitForTimeout(2000); // eslint-disable-line playwright/no-wait-for-timeout
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

    // Wait for page to settle
    await page.waitForTimeout(TIMING.pageLoadSettleTime); // eslint-disable-line playwright/no-wait-for-timeout

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
            .map(
              ([k, v]) => `${k}=${v === true ? "✅" : v === false ? "❌" : v}`,
            )
            .join(", ");
          console.log(`      ${category}: ${flagSummary}`);
        }
      }
    }

    // Extract Commerce Feature Flags from page context (if not already cached)
    if (!cachedCommerceFlags) {
      commerceFeatureFlags = await extractCommerceFeatureFlags(page);
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
          .map(([k, v]) => `${k}=${v === true ? "✅" : v === false ? "❌" : v}`)
          .join(", ");
        console.log(`      ${category}: ${flagSummary}`);
      }
    }

    // Run all feature checks
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

      // Run the check
      const result = await checker(page);
      // Add flag info to result if available
      if (rcCheck.flagKey) {
        result.flagKey = rcCheck.flagKey;
        result.flagValue = rcCheck.flagValue;
      }
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
          result.screenshot = screenshotPath;
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
        i18nResult.screenshot = screenshotPath;
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
      if (f.featureKey.startsWith("endpoint_")) return true;
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
      pageScreenshot = path.join(outputDir, "screenshots", screenshotName);
      await page
        .screenshot({ path: pageScreenshot, fullPage: true })
        .catch(() => {});
    }

    return {
      sku: sku.sku,
      name: sku.name,
      url,
      vendor: sku.vendor,
      country: sku.country,
      timestamp,
      success,
      loadTime,
      features,
      pageScreenshot,
      remoteConfigFlags: remoteConfigFlags ?? undefined,
      commerceFeatureFlags: commerceFeatureFlags ?? undefined,
    };
  } catch (error) {
    console.log(
      `   ❌ Error: ${error instanceof Error ? error.message : String(error)}`,
    );

    // Take screenshot of error state
    const screenshotName = `${sku.sku}_error_${Date.now()}.png`;
    pageScreenshot = path.join(outputDir, "screenshots", screenshotName);
    await page
      .screenshot({ path: pageScreenshot, fullPage: true })
      .catch(() => {});

    return {
      sku: sku.sku,
      name: sku.name,
      url,
      vendor: sku.vendor,
      country: sku.country,
      timestamp,
      success: false,
      loadTime,
      features,
      error: error instanceof Error ? error.message : String(error),
      pageScreenshot,
      remoteConfigFlags: remoteConfigFlags ?? undefined,
      commerceFeatureFlags: commerceFeatureFlags ?? undefined,
    };
  } finally {
    await context.close().catch(() => {});
  }
}

/**
 * Main execution function
 */
async function main() {
  const runId = `run_${Date.now()}`;
  const startTime = new Date();
  const outputDir = path.join(process.cwd(), "reports", runId);

  // Create output directories
  fs.mkdirSync(path.join(outputDir, "screenshots"), { recursive: true });

  // Parse optional env-based filters (set via workflow_dispatch inputs)
  const featuresFilter: Set<string> | null = process.env.FEATURES_FILTER?.trim()
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

  console.log("🚀 PDP Feature Monitor");
  console.log(`📅 Started: ${startTime.toISOString()}`);
  console.log(`📂 Output: ${outputDir}`);
  console.log(
    `📦 SKUs to check: ${skusToCheck.length}${operationsFilter ? ` (filtro: ${operationsFilter.join(", ")})` : ""}`,
  );
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

  try {
    // Check each PDP
    for (let i = 0; i < skusToCheck.length; i++) {
      const sku = skusToCheck[i];
      // Use Firefox for international Natura sites (AR, CL, CO, MX, PE) that block headless Chromium
      const useFirefox =
        browserFirefox !== null &&
        sku.vendor === "natura" &&
        sku.country !== "BR" &&
        (sku.channel || "ecommerce") === "ecommerce";
      const browser = useFirefox ? browserFirefox! : browserChromium;
      const result = await checkPdp(
        browser,
        sku,
        outputDir,
        featuresFilter,
        endpointMatch,
        monitorEndpoints,
      );
      results.push(result);

      // Delay between pages (except last)
      if (i < skusToCheck.length - 1) {
        console.log(
          `   ⏳ Waiting ${TIMING.delayBetweenPages}ms before next page...`,
        );
        await new Promise((resolve) =>
          setTimeout(resolve, TIMING.delayBetweenPages),
        );
      }
    }

    // =========================================================================
    // EXPLORATORY JOURNEYS — navigate via vitrines on the homepage
    // =========================================================================
    const skipExplore = process.env.SKIP_EXPLORE === "true";
    if (!skipExplore) {
      // Determine which domains to explore
      let domainsToExplore = DOMAINS;
      if (operationsFilter) {
        domainsToExplore = DOMAINS.filter((d) => {
          const key = `${d.vendor}-${d.country}${(d.channel || "ecommerce") === "socialcommerce" ? "-social" : ""}`;
          return operationsFilter.includes(key);
        });
      }

      console.log("\n" + "═".repeat(60));
      console.log("🕵️  JORNADA EXPLORATÓRIA — Navegação via Vitrines");
      console.log(`   Operações: ${domainsToExplore.length}`);
      console.log("═".repeat(60));

      for (let i = 0; i < domainsToExplore.length; i++) {
        const domainConfig = domainsToExplore[i];
        console.log(`\n[Explore ${i + 1}/${domainsToExplore.length}]`);

        const useFirefox =
          browserFirefox !== null &&
          domainConfig.vendor === "natura" &&
          domainConfig.country !== "BR" &&
          !domainConfig.channel;

        const browser = useFirefox ? browserFirefox! : browserChromium;

        const exploreResult = await runExploratoryJourney(
          browser,
          domainConfig,
          outputDir,
        );
        results.push(exploreResult);

        if (i < domainsToExplore.length - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, TIMING.delayBetweenPages),
          );
        }
      }
    }
  } finally {
    await browserChromium.close();
    if (browserFirefox) await browserFirefox.close();
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
