/**
 * Exploratory Journey Script
 *
 * Simulates a real user journey for ALL configured operations:
 * 1. Goes to the Home page of each domain
 * 2. Scrolls to find showcase vitrines (product carousels)
 * 3. Clicks on a product card from the vitrine
 * 4. Runs the PDP checks on the dynamically found product page
 *
 * No search is used — navigation happens entirely through vitrines on the home.
 */

import { Browser, Page } from "@playwright/test";
import * as path from "path";
import {
  TIMING,
  isFeatureSupported,
  SELECTORS,
} from "./checks/configs/config.js";
import {
  FEATURE_CHECKERS,
  logFeaturesGrouped,
  dismissCookieBanner,
  scrollAndLoadContent,
} from "./checks/featureRunner.js";
import { CheckResult, PdpCheckResult, DomainConfig } from "./types.js";
import {
  setupRemoteConfigCapture,
  setupCommerceFeatureFlagCapture,
  getCommerceFeatureFlagsFromPage,
  mergeCommerceFeatureFlags,
  isFeatureEnabledByRemoteConfig,
  formatFlagsForLog,
  getCommerceFlagsByCategory,
  countCommerceFlags,
  COUNTRY_TO_LOCALE,
  RemoteConfigFlags,
  CommerceFeatureFlags,
} from "./checks/remoteConfig.js";
import { setupEinsteinShowcaseCapture } from "./checks/showcases.js";
import { FEATURES } from "./checks/configs/features.js";
import {
  finalizeBrowserTrace,
  getPlaywrightTraceMode,
  startBrowserTraceIfEnabled,
} from "./playwrightTrace.js";
import { createStandardContext } from "./browserSetup.js";
import { formatFlagLogValue } from "./utils.js";

export async function dismissCookieBannerExplore(page: Page): Promise<void> {
  return dismissCookieBanner(page, "     ");
}

/**
 * Find a product link inside a showcase vitrine on the homepage and click it.
 * Scrolls progressively to trigger lazy-loaded vitrines.
 * Returns the URL landed on, or null if no vitrine product was found.
 */
export async function navigateViaVitrine(page: Page): Promise<string | null> {
  // Scroll progressively to load all lazy vitrines
  for (let i = 1; i <= 8; i++) {
    await page.evaluate((step) => window.scrollTo(0, step * 800), i);
  }

  // Wait until at least one product link appears in the DOM, or fall back after 6 s
  await page
    .waitForFunction(
      () => document.querySelectorAll('a[href*="/p/"]').length > 0,
      { timeout: 6000 },
    )
    .catch(() => {});

  // Extract product links directly from DOM - don't rely on Playwright visibility
  // Many carousels have hidden slides that contain valid product links
  const productUrls = await page.evaluate(() => {
    const links = document.querySelectorAll('a[href*="/p/"]');
    const uniqueUrls = new Set<string>();

    links.forEach((link) => {
      const href = link.getAttribute("href");
      if (href?.includes("/p/")) {
        // Normalize URL (remove query params for deduplication)
        const baseUrl = href.split("?")[0];
        uniqueUrls.add(baseUrl);
      }
    });

    return Array.from(uniqueUrls);
  }, SELECTORS.explore.productLinks);

  if (productUrls.length === 0) {
    // Fallback: try Playwright locator with visible filter
    const vitrineSelectors = SELECTORS.explore.vitrineSelectors;

    for (const selector of vitrineSelectors) {
      const productLinks = page.locator(selector).locator("visible=true");
      const count = await productLinks.count().catch(() => 0);

      if (count > 0) {
        const link = productLinks.first();
        const href = await link.getAttribute("href").catch(() => null);
        if (href) {
          let fullUrl = href.startsWith("http")
            ? href
            : new URL(href, page.url()).href;
          // Carry forward consultoria/marca params (required by Social Commerce)
          const currentPageParams = new URL(page.url()).searchParams;
          const consultoria = currentPageParams.get("consultoria");
          const marca = currentPageParams.get("marca");
          if (consultoria || marca) {
            const productUrl = new URL(fullUrl);
            if (consultoria)
              productUrl.searchParams.set("consultoria", consultoria);
            if (marca) productUrl.searchParams.set("marca", marca);
            fullUrl = productUrl.href;
          }
          await page.goto(fullUrl, {
            waitUntil: "domcontentloaded",
            timeout: TIMING.navigationTimeout,
          });
          return page.url();
        }
      }
    }
    return null;
  }

  // Pick a random product URL from the first 5 unique URLs
  const pickIndex = Math.min(
    Math.floor(Math.random() * 5),
    productUrls.length - 1,
  );
  const selectedUrl = productUrls[pickIndex];

  console.log(
    `     🔗 Encontrou ${productUrls.length} produto(s) único(s), navegando para produto ${pickIndex + 1}...`,
  );
  console.log(`     📎 Link: ${selectedUrl}`);

  // Navigate directly to the product URL, preserving social commerce query params
  let fullUrl = selectedUrl.startsWith("http")
    ? selectedUrl
    : new URL(selectedUrl, page.url()).href;

  // Carry forward consultoria/marca params (required by Social Commerce to avoid redirect)
  const currentPageParams = new URL(page.url()).searchParams;
  const consultoria = currentPageParams.get("consultoria");
  const marca = currentPageParams.get("marca");
  if (consultoria || marca) {
    const productUrl = new URL(fullUrl);
    if (consultoria) productUrl.searchParams.set("consultoria", consultoria);
    if (marca) productUrl.searchParams.set("marca", marca);
    fullUrl = productUrl.href;
  }

  await page.goto(fullUrl, {
    waitUntil: "domcontentloaded",
    timeout: TIMING.navigationTimeout,
  });

  // Wait for PDP to fully load; domcontentloaded is already guaranteed by goto()
  await page
    .waitForLoadState("load", { timeout: TIMING.pageLoadSettleTime })
    .catch(() => {});

  return page.url();
}

/**
 * Run PDP checks using the available features for the given domain.
 */
export async function runExplorePdpChecks(
  page: Page,
  domainConfig: DomainConfig,
  outputDir: string,
  label: string,
  remoteConfigFlags?: RemoteConfigFlags | null,
  collectRemoteConfig?: (() => Promise<RemoteConfigFlags | null>) | null,
  collectCommerceFlags?: (() => Promise<CommerceFeatureFlags | null>) | null,
): Promise<{
  features: CheckResult[];
  passed: number;
  failed: number;
  remoteConfigFlags?: RemoteConfigFlags;
  commerceFeatureFlags?: CommerceFeatureFlags;
}> {
  // Scroll progressively down to load lazy content, then back to top
  await scrollAndLoadContent(page);

  // Capture remote config flags if not provided
  let rcFlags: RemoteConfigFlags | null = remoteConfigFlags ?? null;
  if (!rcFlags && collectRemoteConfig) {
    rcFlags = await collectRemoteConfig();
    if (rcFlags) {
      console.log(`     🔧 Remote Config: ${formatFlagsForLog(rcFlags)}`);
    }
  }

  const fromNetwork = collectCommerceFlags
    ? await collectCommerceFlags()
    : null;
  const fromPage = await getCommerceFeatureFlagsFromPage(page);
  const commerceFeatureFlags = mergeCommerceFeatureFlags(fromNetwork, fromPage);
  if (commerceFeatureFlags) {
    const totalFlags = countCommerceFlags(commerceFeatureFlags);
    console.log(
      `     🛒 Commerce Feature Flags capturado: ${totalFlags} flags`,
    );
    const categories = getCommerceFlagsByCategory(commerceFeatureFlags);
    for (const [category, flags] of Object.entries(categories)) {
      const flagSummary = Object.entries(flags)
        .map(([k, v]) => `${k}=${formatFlagLogValue(v)}`)
        .join(", ");
      console.log(`        ${category}: ${flagSummary}`);
    }
  }

  // Run checks for all features available on this domain
  const applicableFeatures = FEATURES.filter((f) =>
    domainConfig.availableFeatures.includes(f.key),
  );

  const features: CheckResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const featureConfig of applicableFeatures) {
    const checker = FEATURE_CHECKERS[featureConfig.key];
    if (!checker) continue;

    if (!isFeatureSupported(featureConfig, domainConfig.vendor)) {
      features.push({
        feature: featureConfig.name,
        featureKey: featureConfig.key,
        passed: true,
        status: "na",
        message: `N/A para ${domainConfig.vendor}`,
      });
      continue;
    }

    // Check if feature is enabled by Remote Config
    const rcCheck = isFeatureEnabledByRemoteConfig(featureConfig.key, rcFlags);
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
      passed++; // disabled counts as pass
      continue;
    }

    const result = await checker(page);

    // Add flag info to result if available
    if (rcCheck.flagKey) {
      result.flagKey = rcCheck.flagKey;
      result.flagValue = rcCheck.flagValue;
    }

    // In exploratory mode, optional features that fail become warnings
    // since we don't know beforehand if the product should have them
    if (!result.passed && result.status === "fail" && featureConfig.optional) {
      result.passed = true;
      result.status = "warning";
      result.message = `(opcional) ${result.message}`;
    }

    features.push(result);

    // Take screenshot on failure (skip na and disabled)
    if (
      !result.passed &&
      result.status !== "na" &&
      result.status !== "disabled"
    ) {
      const screenshotName = `explore_${label.replace(/[/ ()]/g, "_")}_${featureConfig.key}_${Date.now()}.png`;
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

    if (
      result.passed ||
      result.status === "na" ||
      result.status === "warning" ||
      result.status === "disabled"
    ) {
      passed++;
    } else {
      failed++;
    }
  }

  // Log all features in grouped order (same as HTML report)
  logFeaturesGrouped(features);

  console.log(
    `\n     📊 Resultado: ${passed} ok, ${failed} falha(s) de ${applicableFeatures.length} feature(s)`,
  );

  return {
    features,
    passed,
    failed,
    remoteConfigFlags: rcFlags ?? undefined,
    commerceFeatureFlags: commerceFeatureFlags ?? undefined,
  };
}

/**
 * Run an exploratory journey for a single domain/operation.
 */
export async function runExploratoryJourney(
  browser: Browser,
  domainConfig: DomainConfig,
  outputDir: string,
): Promise<PdpCheckResult> {
  const label = `${domainConfig.vendor}/${domainConfig.country}${domainConfig.channel === "socialcommerce" ? " (Social Commerce)" : ""}`;
  const homeUrl =
    domainConfig.channel === "socialcommerce"
      ? `${domainConfig.domain}${domainConfig.queryParams ? `?${domainConfig.queryParams}` : ""}`
      : domainConfig.domain;

  console.log(`\n${"═".repeat(70)}`);
  console.log(`🕵️  Jornada exploratória: ${label}`);
  console.log(`   Home: ${homeUrl}`);
  console.log(`${"═".repeat(70)}`);

  const context = await createStandardContext(browser, homeUrl);
  const page = await context.newPage();

  // Setup Remote Config capture BEFORE navigation
  const locale = COUNTRY_TO_LOCALE[domainConfig.country] || "pt-BR";
  const collectRemoteConfig = setupRemoteConfigCapture(page, locale);
  const collectCommerceFlags = setupCommerceFeatureFlagCapture(page);

  // Setup Einstein showcase capture BEFORE navigation
  setupEinsteinShowcaseCapture(page);

  const traceMode = getPlaywrightTraceMode();
  const traceZipPath = path.join(
    outputDir,
    "traces",
    `explore_${label.replace(/[^a-zA-Z0-9._-]+/g, "_")}_${Date.now()}.zip`,
  );
  let traceActive = await startBrowserTraceIfEnabled(context, traceMode);

  const finishTrace = async (
    runSucceeded: boolean,
  ): Promise<string | undefined> => {
    if (!traceActive) return undefined;
    const p = await finalizeBrowserTrace(
      context,
      traceMode,
      traceActive,
      runSucceeded,
      traceZipPath,
    );
    traceActive = false;
    if (p) console.log(`   🎬 Trace salvo: ${p}`);
    return p;
  };

  try {
    // 1. Acessar a Home
    console.log("   -> Acessando a Home...");
    await page.goto(homeUrl, {
      waitUntil: "domcontentloaded",
      timeout: TIMING.navigationTimeout,
    });

    // Fechar banner de cookies
    await dismissCookieBannerExplore(page);

    // 2. Navegar via vitrine
    console.log("   -> Procurando vitrines de produtos na home...");
    const pdpUrl = await navigateViaVitrine(page);

    if (!pdpUrl) {
      console.log("   ❌ Nenhuma vitrine com produtos encontrada na home");
      const playwrightTracePath = await finishTrace(false);
      return {
        sku: "explore",
        name: `Exploratória: ${label}`,
        url: homeUrl,
        vendor: domainConfig.vendor,
        country: domainConfig.country,
        timestamp: new Date().toISOString(),
        success: false,
        features: [],
        error: "Nenhuma vitrine com produtos encontrada na home",
        playwrightTracePath,
      };
    }

    // Verify we actually landed on a PDP
    if (!pdpUrl.includes("/p/")) {
      console.log(`   ❌ Não chegou em uma PDP (URL: ${pdpUrl})`);
      const playwrightTracePath = await finishTrace(false);
      return {
        sku: "explore",
        name: `Exploratória: ${label}`,
        url: pdpUrl,
        vendor: domainConfig.vendor,
        country: domainConfig.country,

        timestamp: new Date().toISOString(),
        success: false,
        features: [],
        error: `Navegação não chegou em uma PDP (URL: ${pdpUrl})`,
        playwrightTracePath,
      };
    }

    const title = await page.title();
    console.log(`\n   📍 PDP encontrada: ${title}`);
    console.log(`   🔗 URL: ${pdpUrl}`);

    // Dismiss cookie banner again if it reappeared after navigation
    await dismissCookieBannerExplore(page);

    // 3. Rodar checagens
    console.log("\n   📋 Rodando validações da PDP...");
    const { features, failed, remoteConfigFlags, commerceFeatureFlags } =
      await runExplorePdpChecks(
        page,
        domainConfig,
        outputDir,
        label,
        null, // No cached flags
        collectRemoteConfig, // Collector function set up before navigation
        collectCommerceFlags,
      );

    // Take full page screenshot on failure
    let pageScreenshot: string | undefined;
    if (failed > 0) {
      const ssName = `explore_${label.replace(/[/ ()]/g, "_")}_page_${Date.now()}.png`;
      const ssPath = path.join(outputDir, "screenshots", ssName);
      try {
        await page.screenshot({ path: ssPath, fullPage: true });
        pageScreenshot = ssPath;
      } catch {
        // Ignore
      }
    }

    console.log(`\n   ✅ Jornada exploratória finalizada: ${label}`);

    const playwrightTracePath = await finishTrace(failed === 0);

    return {
      sku: "explore",
      name: `Exploratória: ${label} — ${title}`,
      url: pdpUrl,
      vendor: domainConfig.vendor,
      country: domainConfig.country,
      timestamp: new Date().toISOString(),
      success: failed === 0,
      features,
      pageScreenshot,
      remoteConfigFlags,
      commerceFeatureFlags,
      playwrightTracePath,
    };
  } catch (error) {
    console.error(
      `\n   ❌ Falha na jornada exploratória (${label}):`,
      error instanceof Error ? error.message : error,
    );
    const playwrightTracePath = await finishTrace(false);
    return {
      sku: "explore",
      name: `Exploratória: ${label}`,
      url: homeUrl,
      vendor: domainConfig.vendor,
      country: domainConfig.country,
      timestamp: new Date().toISOString(),
      success: false,
      features: [],
      error: error instanceof Error ? error.message : String(error),
      playwrightTracePath,
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
      traceActive = false;
    }
    await context.close();
  }
}
