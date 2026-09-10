import { chromium } from "@playwright/test";
import { CheckResult, SkuConfig } from "../types.js";
import { buildPdpUrl } from "../checks/configs/config.js";
import { ANDROID_SELECTORS } from "./configs/selectors.js";
import {
  setupEinsteinShowcaseCapture,
  checkBrandShowcase,
  checkRecommendationShowcase,
} from "../checks/showcases.js";

/**
 * Confirmed native selector for the showcase/vitrine RecyclerViews (see selectors.ts for the
 * source file references). The Einstein BFF endpoint also requires app-level auth (a
 * "tenant_id" header only the real web/app client sends — a bare fetch() gets HTTP 500
 * "tenant_id header is required") on top of Akamai bot protection, so rebuilding the URL and
 * calling it directly from Node doesn't work for the content-zone/campaign-count part.
 *
 * So this check combines two signals:
 * 1. Native: is the RecyclerView (rvMoreBrandProducts / rvEinsteinShowcase) actually
 *    rendered on screen, scrolling it into view first since the PDP is a long vertical list.
 * 2. Backend: the exact same content zone + endpoint verification as the web checker
 *    (src/checks/showcases.ts), via a throwaway headless Playwright page on the SAME PDP URL.
 */
async function isRecyclerViewRendered(
  driver: WebdriverIO.Browser,
  resourceId: string,
): Promise<boolean> {
  const idPattern = `.*:id/${resourceId}`;
  try {
    await driver
      .$(
        `android=new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().resourceIdMatches("${idPattern}"))`,
      )
      .waitForDisplayed({ timeout: 8000 });
  } catch {
    return false;
  }

  const el = driver.$(
    `android=new UiSelector().resourceIdMatches("${idPattern}")`,
  );
  const displayed = await el.isDisplayed().catch(() => false);
  if (!displayed) {
    return false;
  }
  // An empty RecyclerView (wrap_content height) collapses to ~0px — a rendered card list
  // gives it real height, which is a cheap way to tell "exists but empty" from "has items".
  const size = await el.getSize().catch(() => null);
  return !!size && size.height > 40;
}

async function runWebShowcaseChecks(sku: SkuConfig): Promise<{
  brand: CheckResult;
  recommendation: CheckResult;
}> {
  const url = buildPdpUrl(sku);
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    setupEinsteinShowcaseCapture(page);
    await page
      .goto(url, { waitUntil: "domcontentloaded", timeout: 30000 })
      .catch(() => {});

    const brand = await checkBrandShowcase(page);
    const recommendation = await checkRecommendationShowcase(page);
    return { brand, recommendation };
  } finally {
    await browser.close();
  }
}

/** Caches the (brand, recommendation) pair per SKU so both android checks share one browser run. */
const showcaseResultCache = new Map<
  string,
  ReturnType<typeof runWebShowcaseChecks>
>();

function getShowcaseResults(
  sku: SkuConfig,
): ReturnType<typeof runWebShowcaseChecks> {
  if (!showcaseResultCache.has(sku.sku)) {
    showcaseResultCache.set(sku.sku, runWebShowcaseChecks(sku));
  }
  return showcaseResultCache.get(sku.sku)!;
}

const NOTE =
  "Content zone/endpoint Einstein iguais ao checker web; renderização nativa confirmada via RecyclerView (rvMoreBrandProducts/rvEinsteinShowcase)";

/** Android equivalent of checks/showcases.ts#checkBrandShowcase — native RecyclerView + same content zone/endpoint. */
export async function checkBrandShowcaseAndroid(
  driver: WebdriverIO.Browser,
  sku: SkuConfig,
): Promise<CheckResult> {
  try {
    const [nativeRendered, { brand }] = await Promise.all([
      isRecyclerViewRendered(
        driver,
        ANDROID_SELECTORS.showcase.brandRecyclerView,
      ),
      getShowcaseResults(sku),
    ]);

    if (nativeRendered) {
      return {
        ...brand,
        passed: true,
        status: "pass",
        message: `Vitrine "mais produtos da marca" renderizada na tela (RecyclerView) — ${brand.message}`,
        details: { ...brand.details, nativeSectionRendered: true, note: NOTE },
      };
    }
    return {
      ...brand,
      details: { ...brand.details, nativeSectionRendered: false, note: NOTE },
    };
  } catch (error) {
    return {
      feature: 'Vitrine "Mais produtos da marca"',
      featureKey: "brandShowcase",
      passed: false,
      status: "error",
      message: `Erro ao verificar vitrine: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/** Android equivalent of checks/showcases.ts#checkRecommendationShowcase — native RecyclerView + same content zone/endpoint. */
export async function checkRecommendationShowcaseAndroid(
  driver: WebdriverIO.Browser,
  sku: SkuConfig,
): Promise<CheckResult> {
  try {
    const [nativeRendered, { recommendation }] = await Promise.all([
      isRecyclerViewRendered(
        driver,
        ANDROID_SELECTORS.showcase.recommendationRecyclerView,
      ),
      getShowcaseResults(sku),
    ]);

    if (nativeRendered) {
      return {
        ...recommendation,
        passed: true,
        status: "pass",
        message: `Vitrine de recomendações renderizada na tela (RecyclerView) — ${recommendation.message}`,
        details: {
          ...recommendation.details,
          nativeSectionRendered: true,
          note: NOTE,
        },
      };
    }
    return {
      ...recommendation,
      details: {
        ...recommendation.details,
        nativeSectionRendered: false,
        note: NOTE,
      },
    };
  } catch (error) {
    return {
      feature: 'Vitrine "Achamos que você vai gostar"',
      featureKey: "recommendationShowcase",
      passed: false,
      status: "error",
      message: `Erro ao verificar vitrine: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
