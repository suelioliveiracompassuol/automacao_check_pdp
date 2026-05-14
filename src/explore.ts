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

import { chromium, firefox, Browser, Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import {
  TIMING,
  isFeatureSupported,
} from "./checks/configs/config.js";
import {
  FEATURE_CHECKERS,
  logFeaturesGrouped,
  dismissCookieBanner,
  scrollAndLoadContent,
} from "./checks/featureRunner.js";
import {
  CheckResult,
  PdpCheckResult,
  MonitoringReport,
  DomainConfig,
} from "./types.js";
import { generateHtmlReport, generateJsonReport } from "./reporter.js";
import {
  setupRemoteConfigCapture,
  isFeatureEnabledByRemoteConfig,
  formatFlagsForLog,
  COUNTRY_TO_LOCALE,
  RemoteConfigFlags,
} from "./checks/remoteConfig.js";
import { DOMAINS } from "./checks/configs/domains.js";
import { FEATURES } from "./checks/configs/features.js";



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
    await page.waitForTimeout(600); // eslint-disable-line playwright/no-wait-for-timeout
  }

  // Wait a bit more for vitrines to fully render
  await page.waitForTimeout(2000); // eslint-disable-line playwright/no-wait-for-timeout

  // Extract product links directly from DOM - don't rely on Playwright visibility
  // Many carousels have hidden slides that contain valid product links
  const productUrls = await page.evaluate(() => {
    const links = document.querySelectorAll('a[href*="/p/"]');
    const uniqueUrls = new Set<string>();

    links.forEach((link) => {
      const href = link.getAttribute("href");
      if (href && href.includes("/p/")) {
        // Normalize URL (remove query params for deduplication)
        const baseUrl = href.split("?")[0];
        uniqueUrls.add(baseUrl);
      }
    });

    return Array.from(uniqueUrls);
  });

  if (productUrls.length === 0) {
    // Fallback: try Playwright locator with visible filter
    const vitrineSelectors = [
      'section:has(a[href*="/p/"]) a[href*="/p/"]',
      '[class*="swiper"] a[href*="/p/"]',
      '[class*="carousel"] a[href*="/p/"]',
      '[class*="showcase"] a[href*="/p/"]',
      'a[href*="/p/"]',
    ];

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

  // Wait for PDP to load
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(TIMING.pageLoadSettleTime); // eslint-disable-line playwright/no-wait-for-timeout

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
): Promise<{
  features: CheckResult[];
  passed: number;
  failed: number;
  remoteConfigFlags?: RemoteConfigFlags;
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

  return { features, passed, failed, remoteConfigFlags: rcFlags ?? undefined };
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

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    ignoreHTTPSErrors: true,
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

  // Setup Remote Config capture BEFORE navigation
  const locale = COUNTRY_TO_LOCALE[domainConfig.country] || "pt-BR";
  const collectRemoteConfig = setupRemoteConfigCapture(page, locale);

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
      };
    }

    // Verify we actually landed on a PDP
    if (!pdpUrl.includes("/p/")) {
      console.log(`   ❌ Não chegou em uma PDP (URL: ${pdpUrl})`);
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
      };
    }

    const title = await page.title();
    console.log(`\n   📍 PDP encontrada: ${title}`);
    console.log(`   🔗 URL: ${pdpUrl}`);

    // Dismiss cookie banner again if it reappeared after navigation
    await dismissCookieBannerExplore(page);

    // 3. Rodar checagens
    console.log("\n   📋 Rodando validações da PDP...");
    const { features, failed, remoteConfigFlags } = await runExplorePdpChecks(
      page,
      domainConfig,
      outputDir,
      label,
      null, // No cached flags
      collectRemoteConfig, // Collector function set up before navigation
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
    };
  } catch (error) {
    console.error(
      `\n   ❌ Falha na jornada exploratória (${label}):`,
      error instanceof Error ? error.message : error,
    );
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
    };
  } finally {
    await context.close();
  }
}

async function main() {
  const runId = `run_explore_${Date.now()}`;
  const startTime = new Date();
  const outputDir = path.join(process.cwd(), "reports", runId);
  fs.mkdirSync(path.join(outputDir, "screenshots"), { recursive: true });

  const isHeadless = process.env.HEADLESS !== "false";
  // Optional filter: OPERATIONS=natura-BR,avon-BR
  const operationsFilter = process.env.OPERATIONS
    ? new Set(process.env.OPERATIONS.split(",").map((s) => s.trim()))
    : null;

  console.log(`\n🚀 Jornada Exploratória - Navegação via Vitrines`);
  console.log(`   Headless: ${isHeadless}`);
  console.log(`   📂 Output: ${outputDir}`);

  // Determine which domains to test
  let domainsToTest = DOMAINS;
  if (operationsFilter) {
    domainsToTest = DOMAINS.filter((d) => {
      const key = `${d.vendor}-${d.country}${d.channel === "socialcommerce" ? "-social" : ""}`;
      return operationsFilter.has(key);
    });
    console.log(`   Filtro: ${[...operationsFilter].join(", ")}`);
  }
  console.log(`   Operações: ${domainsToTest.length}`);

  // Launch browsers
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
    console.log("   ⚠️  Firefox não disponível, usando Chromium para tudo");
  }

  const results: PdpCheckResult[] = [];

  try {
    for (let i = 0; i < domainsToTest.length; i++) {
      const domainConfig = domainsToTest[i];
      console.log(`\n[${i + 1}/${domainsToTest.length}]`);

      // Use Firefox for international sites that may block headless Chromium
      const useFirefox =
        browserFirefox &&
        domainConfig.vendor === "natura" &&
        domainConfig.country !== "BR" &&
        !domainConfig.channel;

      const browser = useFirefox ? browserFirefox! : browserChromium;

      const result = await runExploratoryJourney(
        browser,
        domainConfig,
        outputDir,
      );
      results.push(result);

      // Delay between operations
      if (i < domainsToTest.length - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, TIMING.delayBetweenPages),
        );
      }
    }
  } finally {
    await browserChromium.close();
    if (browserFirefox) await browserFirefox.close();
  }

  // Generate report
  const endTime = new Date();
  const durationMs = endTime.getTime() - startTime.getTime();

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

  const htmlPath = path.join(outputDir, "report.html");
  const jsonPath = path.join(outputDir, "report.json");

  fs.writeFileSync(htmlPath, generateHtmlReport(report));
  fs.writeFileSync(jsonPath, generateJsonReport(report));

  // Summary
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  console.log(`\n${"═".repeat(70)}`);
  console.log(`📊 RESUMO DA JORNADA EXPLORATÓRIA`);
  console.log(
    `   Total: ${results.length} | ✅ Sucesso: ${successCount} | ❌ Falha: ${failCount}`,
  );
  console.log(`   ⏱️  Duração: ${(durationMs / 1000).toFixed(1)}s`);
  console.log(`   📄 Relatório: ${htmlPath}`);
  console.log(`${"═".repeat(70)}\n`);

  if (failCount > 0) {
    console.log("🔴 Há falhas na jornada exploratória!");
    process.exit(1);
  } else {
    console.log("🟢 Todas as jornadas exploratórias passaram!");
  }
}

// Run standalone only when called directly (not when imported)
const isMainModule =
  process.argv[1]?.endsWith("explore.js") ||
  process.argv[1]?.endsWith("explore.ts");

if (isMainModule) {
  main().catch(console.error);
}
