/**
 * One Web PDP, start to finish: pre-navigation captures → navigation → flags → checks →
 * verdict, screenshot and trace. Called per SKU by the orchestrator (src/index.ts).
 */

import { Browser, Page } from "@playwright/test";
import * as path from "node:path";
import { createStandardContext } from "../browserSetup.js";
import { setupAiReviewSummaryCapture } from "../checks/aiReviewSummary.js";
import { TIMING, buildPdpUrl, getApplicableFeatures } from "../checks/configs/config.js";
import { PDP_ENDPOINT_RULES } from "../checks/configs/endpoints-rules.js";
import { setupEndpointMonitor } from "../checks/endpointResponse.js";
import {
  INTERACTIVE_FEATURES,
  dismissCookieBanner,
  logFeaturesGrouped,
  scrollAndLoadContent,
} from "../checks/featureRunner.js";
import { checkI18nKeys } from "../checks/i18n.js";
import { setupProductBadgesCapture } from "../checks/productBadges.js";
import { setupProductVariationsCapture } from "../checks/productVariations.js";
import { captureRatingFromDOM, setupRatingConsistencyCapture } from "../checks/ratingConsistency.js";
import {
  COUNTRY_TO_LOCALE,
  FEATURE_REMOTE_CONFIG_MAP,
  countCapturedFlags,
  countCommerceFlags,
  formatFlagsForLog,
  getCommerceFlagsByCategory,
  getFlagsByCategory,
  setupCommerceFeatureFlagCapture,
  setupRemoteConfigCapture,
  type CommerceFeatureFlags,
  type RemoteConfigFlags,
} from "../checks/remoteConfig.js";
import { setupEinsteinShowcaseCapture } from "../checks/showcases.js";
import { finalizeBrowserTrace, getPlaywrightTraceMode, startBrowserTraceIfEnabled } from "../playwrightTrace.js";
import { gradeRatingDivergence } from "../ratingDivergence.js";
import type { CheckResult, PdpCheckResult, SkuConfig } from "../types.js";
import { formatFlagLogValue, toSafeFileName } from "../utils.js";
import { gateFeatures, type RunnableCheck } from "./featureGating.js";
import { isPdpSuccessful, legacyEndpointResult, type EndpointCall } from "./pdpResults.js";

export interface CheckPdpParams {
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
 * Operations (vendor-country-channel) whose PDP didn't fetch Remote Config within the long wait
 * in this run — later SKUs of the same operation only wait briefly.
 */
const operationsWithoutRemoteConfig = new Set<string>();

interface PreNavigationCaptures {
  endpointCalls: EndpointCall[];
  collectEndpointResults: (() => Promise<CheckResult[]>) | null;
  collectRemoteConfig: ((maxWaitMs?: number) => Promise<RemoteConfigFlags | null>) | null;
  collectCommerceFlags: (() => Promise<CommerceFeatureFlags | null>) | null;
}

/**
 * Network interceptors that must exist before page.goto(): they read API responses (and the
 * SSR document) that only fly by during navigation.
 */
function registerPreNavigationCaptures(page: Page, params: CheckPdpParams): PreNavigationCaptures {
  const { sku, endpointMatch, monitorEndpoints, cachedRemoteConfig, cachedCommerceFlags } = params;

  // Legacy single-pattern endpoint check
  const endpointCalls: EndpointCall[] = [];
  if (endpointMatch) {
    page.on("response", (response) => {
      const url = response.url();
      if (url.includes(endpointMatch)) {
        endpointCalls.push({ url, method: response.request().method(), status: response.status() });
      }
    });
  }

  const captures: PreNavigationCaptures = {
    endpointCalls,
    // Structured PDP endpoint monitor (validates status + body fields)
    collectEndpointResults: monitorEndpoints ? setupEndpointMonitor(page, PDP_ENDPOINT_RULES) : null,
    collectRemoteConfig: cachedRemoteConfig
      ? null
      : setupRemoteConfigCapture(page, COUNTRY_TO_LOCALE[sku.country] || "pt-BR"),
    collectCommerceFlags: cachedCommerceFlags ? null : setupCommerceFeatureFlagCapture(page),
  };

  setupEinsteinShowcaseCapture(page);
  setupRatingConsistencyCapture(page, sku.sku);
  setupProductVariationsCapture(page, sku.sku);
  // isTopRated/minStockBadge from SSR payload + BFF API
  setupProductBadgesCapture(page, sku.sku);
  // aiSummary from /reviews/v2/details
  setupAiReviewSummaryCapture(page, sku.sku);

  return captures;
}

/** page.goto with one retry on HTTP2 errors; throws on failure or HTTP >= 400. */
async function navigateToPdp(page: Page, url: string): Promise<void> {
  let response;
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      response = await page.goto(url, { timeout: TIMING.navigationTimeout, waitUntil: "domcontentloaded" });
      lastError = null;
      break;
    } catch (e) {
      lastError = e;
      if (attempt < 2 && e instanceof Error && e.message.includes("HTTP2")) {
        console.log(`   ⚠️ HTTP2 error, retrying (attempt ${attempt + 1})...`);
        await new Promise<void>((resolve) => setTimeout(resolve, 2000));
      }
    }
  }
  if (lastError) {
    throw lastError;
  }
  if (!response || response.status() >= 400) {
    throw new Error(`HTTP ${response?.status() || "unknown"} - Page failed to load`);
  }
}

function logFlagCategories(categories: Record<string, Record<string, unknown>>): void {
  for (const [category, flags] of Object.entries(categories)) {
    const flagSummary = Object.entries(flags)
      .map(([k, v]) => `${k}=${formatFlagLogValue(v)}`)
      .join(", ");
    console.log(`      ${category}: ${flagSummary}`);
  }
}

/** Remote Config (waiting longer only when a feature to run depends on it) and Commerce flags. */
async function collectFlags(
  sku: SkuConfig,
  applicableFeatures: ReturnType<typeof getApplicableFeatures>,
  captures: PreNavigationCaptures,
  cached: { remoteConfig: RemoteConfigFlags | null; commerce: CommerceFeatureFlags | null },
): Promise<{ remoteConfigFlags: RemoteConfigFlags | null; commerceFeatureFlags: CommerceFeatureFlags | null }> {
  let remoteConfigFlags = cached.remoteConfig;
  let commerceFeatureFlags = cached.commerce;

  if (!remoteConfigFlags && captures.collectRemoteConfig) {
    const operation = `${sku.vendor}-${sku.country}-${sku.channel ?? "ecommerce"}`;
    const longWait =
      applicableFeatures.some((f) => FEATURE_REMOTE_CONFIG_MAP[f.key]) && !operationsWithoutRemoteConfig.has(operation);
    remoteConfigFlags = await captures.collectRemoteConfig(
      longWait ? TIMING.remoteConfigWait : TIMING.remoteConfigShortWait,
    );
    if (!remoteConfigFlags && longWait) {
      operationsWithoutRemoteConfig.add(operation);
    }
    if (remoteConfigFlags) {
      console.log(
        `   🔧 Remote Config capturado: ${countCapturedFlags(remoteConfigFlags)} flags (locale: ${remoteConfigFlags.locale})`,
      );
      console.log(`      ${formatFlagsForLog(remoteConfigFlags)}`);
      logFlagCategories(getFlagsByCategory(remoteConfigFlags));
    }
  }

  // Commerce flags: intercept /feature-flag (setup before goto) and/or use DOM fallback
  if (!cached.commerce && captures.collectCommerceFlags) {
    commerceFeatureFlags = await captures.collectCommerceFlags();
  }
  if (commerceFeatureFlags) {
    console.log(`   🛒 Commerce Feature Flags capturado: ${countCommerceFlags(commerceFeatureFlags)} flags`);
    logFlagCategories(getCommerceFlagsByCategory(commerceFeatureFlags));
  }

  return { remoteConfigFlags, commerceFeatureFlags };
}

/**
 * Read-only checks in parallel (scrollAndLoadContent already triggered the lazy content), then
 * the ones that click on the page one at a time, so the layout doesn't change under the
 * parallel visibility checks.
 */
async function runChecks(page: Page, runnable: RunnableCheck[]): Promise<CheckResult[]> {
  const run = async ({ checker, rcCheck }: RunnableCheck) => {
    const result = await checker(page);
    if (rcCheck.flagKey) {
      result.flagKey = rcCheck.flagKey;
      result.flagValue = rcCheck.flagValue;
    }
    return result;
  };
  const results = await Promise.all(
    runnable.filter((c) => !INTERACTIVE_FEATURES.has(c.featureConfig.key)).map(run),
  );
  for (const c of runnable) {
    if (INTERACTIVE_FEATURES.has(c.featureConfig.key)) {
      results.push(await run(c));
    }
  }
  return results;
}

/**
 * Check a single PDP for all applicable features
 */
export async function checkPdp(params: CheckPdpParams): Promise<PdpCheckResult> {
  const { browser, sku, outputDir, featuresFilter, endpointMatch } = params;

  const url = buildPdpUrl(sku);
  const timestamp = new Date().toISOString();
  let features: CheckResult[] = [];
  let pageScreenshot: string | undefined;
  let loadTime: number | undefined;
  let remoteConfigFlags: RemoteConfigFlags | null = params.cachedRemoteConfig ?? null;
  let commerceFeatureFlags: CommerceFeatureFlags | null = params.cachedCommerceFlags ?? null;

  console.log(`\n📦 Checking: ${sku.name} (${sku.sku})`);
  console.log(`   URL: ${url}`);

  const context = await createStandardContext(browser, url);
  const page = await context.newPage();
  const captures = registerPreNavigationCaptures(page, params);

  const traceMode = getPlaywrightTraceMode();
  const traceZipPath = path.join(outputDir, "traces", `${toSafeFileName(sku.sku)}_${Date.now()}.zip`);
  let traceActive = await startBrowserTraceIfEnabled(context, traceMode);

  const screenshot = async (kind: "fullpage" | "error") => {
    const screenshotPath = path.join(outputDir, "screenshots", `${sku.sku}_${kind}_${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
    return path.relative(outputDir, screenshotPath);
  };
  const finalizeTrace = async (success: boolean) => {
    const tracePath = await finalizeBrowserTrace(context, traceMode, traceActive, success, traceZipPath);
    traceActive = false;
    if (tracePath) {
      console.log(`   🎬 Trace salvo: ${tracePath}`);
    }
    return tracePath ? path.relative(outputDir, tracePath) : undefined;
  };
  // Same field order as before the split, so report.json diffs stay readable
  const result = (
    success: boolean,
    playwrightTracePath: string | undefined,
    error?: string,
  ): PdpCheckResult => ({
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
    ...(error !== undefined && { error }),
    pageScreenshot,
    playwrightTracePath,
    remoteConfigFlags: remoteConfigFlags ?? undefined,
    commerceFeatureFlags: commerceFeatureFlags ?? undefined,
  });

  try {
    const startTime = Date.now();
    await navigateToPdp(page, url);
    loadTime = Date.now() - startTime;
    console.log(`   ⏱️  Load time: ${loadTime}ms`);

    // Wait for the page to fully load after domcontentloaded
    await page.waitForLoadState("load", { timeout: TIMING.pageLoadSettleTime }).catch(() => {});

    // Read product rating from JSON-LD immediately after load, before any DOM interactions
    // that could cause React to re-render/clear the SSR script tags.
    await captureRatingFromDOM(page);
    await dismissCookieBanner(page);
    // Scroll progressively down to load ALL lazy content, then back to top
    await scrollAndLoadContent(page);

    let applicableFeatures = getApplicableFeatures(sku);
    // External features filter (e.g. from workflow_dispatch input)
    if (featuresFilter && featuresFilter.size > 0) {
      applicableFeatures = applicableFeatures.filter((f) => featuresFilter.has(f.key));
    }

    ({ remoteConfigFlags, commerceFeatureFlags } = await collectFlags(sku, applicableFeatures, captures, {
      remoteConfig: remoteConfigFlags,
      commerce: commerceFeatureFlags,
    }));

    const gated = gateFeatures(applicableFeatures, sku, remoteConfigFlags, commerceFeatureFlags);
    for (const key of gated.missingCheckers) {
      console.log(`   ⚠️  No checker for ${key}`);
    }
    features.push(...gated.decided, ...(await runChecks(page, gated.runnable)));

    // Untranslated i18n keys (runs on every PDP)
    features.push(await checkI18nKeys(page));

    // Structured PDP endpoint results; rules that captured nothing are skipped — the endpoint
    // may not apply to this page variant
    if (captures.collectEndpointResults) {
      for (const r of await captures.collectEndpointResults()) {
        if (!r.message.includes("Nenhuma chamada")) {
          features.push(r);
        }
      }
    }

    if (endpointMatch) {
      features.push(legacyEndpointResult(endpointMatch, captures.endpointCalls));
    }

    // Product rating vs Konfidency: a divergence up to a day old is only a warning
    features = gradeRatingDivergence(features, sku);

    // Log all features in grouped order (same as the dashboard)
    logFeaturesGrouped(features);

    const success = isPdpSuccessful(features, !!endpointMatch);
    if (!success) {
      pageScreenshot = await screenshot("fullpage");
    }
    const playwrightTracePath = await finalizeTrace(success);
    return result(success, playwrightTracePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`   ❌ Error: ${message}`);
    pageScreenshot = await screenshot("error");
    const playwrightTracePath = await finalizeTrace(false);
    return result(false, playwrightTracePath, message);
  } finally {
    if (traceActive) {
      await finalizeBrowserTrace(context, traceMode, traceActive, false, traceZipPath).catch(() => {});
    }
    await context.close().catch(() => {});
  }
}
