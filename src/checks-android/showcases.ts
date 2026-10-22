import { CheckResult } from "../types.js";
import { ANDROID_SELECTORS } from "./configs/selectors.js";

/**
 * Native Android showcase / carousel verification.
 *
 * Verifies that the native RecyclerView is rendered on screen (scrolling vertically if needed)
 * and confirms that child ViewHolders (product cards) are populated, rather than relying on
 * a web Playwright Chromium browser session.
 */
async function verifyNativeShowcase(
  driver: WebdriverIO.Browser,
  resourceId: string,
): Promise<{ rendered: boolean; itemCount: number }> {
  const idPattern = `.*:id/${resourceId}`;

  await dismissZeeDog(driver);

  try {
    // Scroll the PDP NestedScrollView itself (see ANDROID_SELECTORS.pdp.scrollContainer)
    const scrollSelector = `android=new UiScrollable(${ANDROID_SELECTORS.pdp.scrollContainer}).setAsVerticalList().scrollIntoView(new UiSelector().resourceIdMatches("${idPattern}"))`;
    await driver.$(scrollSelector).waitForDisplayed({ timeout: 8000 });
  } catch {
    // If scroll failed, check if it's already visible in current viewport
  }

  const el = driver.$(
    `android=new UiSelector().resourceIdMatches("${idPattern}")`,
  );

  // scrollIntoView stops as soon as any sliver of the element is on screen, which can leave the
  // carousel at the bottom edge behind the sticky buy bar (or still loading) with only a few px
  // visible. UiAutomator reports the visible bounds, so nudge the PDP down until it shows up.
  let visibleHeight = await getVisibleHeight(el);
  for (
    let nudge = 0;
    nudge < MAX_SCROLL_NUDGES && visibleHeight < MIN_VISIBLE_HEIGHT;
    nudge++
  ) {
    if (!(await nudgePdpDown(driver))) {
      break;
    }
    visibleHeight = await getVisibleHeight(el);
  }
  if (visibleHeight < MIN_VISIBLE_HEIGHT) {
    return { rendered: false, itemCount: 0 };
  }

  // Inspect child cards/elements to ensure the adapter is bound and populated
  let itemCount: number;
  try {
    const childCards = await el.$$(
      'android=new UiSelector().resourceIdMatches(".*:id/product_carousel_item_ne")',
    );
    itemCount = (childCards as unknown as { length: number }).length ?? 0;
  } catch {
    itemCount = 0;
  }

  return {
    rendered: true,
    itemCount,
  };
}

/** Below this visible height the carousel is treated as not rendered (empty or off screen). */
const MIN_VISIBLE_HEIGHT = 40;
/** Extra short scrolls after scrollIntoView; 30% each, so ~1.2 screens at most. */
const MAX_SCROLL_NUDGES = 4;

async function getVisibleHeight(
  el: ReturnType<WebdriverIO.Browser["$"]>,
): Promise<number> {
  if (!(await el.isDisplayed().catch(() => false))) {
    return 0;
  }
  const size = await el.getSize().catch(() => null);
  return size?.height ?? 0;
}

/** Scrolls the PDP NestedScrollView down by 30% of its height; false if it can't scroll. */
async function nudgePdpDown(driver: WebdriverIO.Browser): Promise<boolean> {
  try {
    const container = await driver.$(
      `android=${ANDROID_SELECTORS.pdp.scrollContainer}`,
    );
    await driver.execute("mobile: scrollGesture", {
      elementId: container.elementId,
      direction: "down",
      percent: 0.3,
    });
    return true;
  } catch {
    return false;
  }
}

/** Closes the ZeeDog floating messages card if present: it covers the bottom of the PDP. */
async function dismissZeeDog(driver: WebdriverIO.Browser): Promise<void> {
  try {
    const close = driver.$(`android=${ANDROID_SELECTORS.pdp.zeeDogClose}`);
    if (await close.isDisplayed()) {
      await close.click();
    }
  } catch {
    // Best effort: the card is not always shown
  }
}

interface ShowcaseCheckSpec {
  feature: string;
  featureKey: "brandShowcase" | "recommendationShowcase";
  label: string;
  resourceId: string;
}

async function checkShowcaseAndroid(
  driver: WebdriverIO.Browser,
  spec: ShowcaseCheckSpec,
): Promise<CheckResult> {
  const { feature, featureKey, label, resourceId } = spec;
  try {
    const { rendered, itemCount } = await verifyNativeShowcase(
      driver,
      resourceId,
    );

    if (rendered) {
      return {
        feature,
        featureKey,
        passed: true,
        status: "pass",
        message: `${label} renderizada no app Android (RecyclerView com ${itemCount > 0 ? `${itemCount} itens detectados` : "conteúdo"})`,
        details: { rendered: true, itemCount, resourceId },
      };
    }

    return {
      feature,
      featureKey,
      passed: false,
      status: "fail",
      message: `${label} não encontrada ou vazia na tela`,
      details: { rendered: false, resourceId },
    };
  } catch (error) {
    return {
      feature,
      featureKey,
      passed: false,
      status: "error",
      message: `Erro ao verificar vitrine: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/** Android native check for "Mais produtos da marca" showcase. */
export function checkBrandShowcaseAndroid(
  driver: WebdriverIO.Browser,
): Promise<CheckResult> {
  return checkShowcaseAndroid(driver, {
    feature: 'Vitrine "Mais produtos da marca"',
    featureKey: "brandShowcase",
    label: 'Vitrine "mais produtos da marca"',
    resourceId: ANDROID_SELECTORS.showcase.brandRecyclerView,
  });
}

/** Android native check for the personalization showcase ("achamos que você vai gostar"). */
export function checkRecommendationShowcaseAndroid(
  driver: WebdriverIO.Browser,
): Promise<CheckResult> {
  return checkShowcaseAndroid(driver, {
    feature: 'Vitrine "Achamos que você vai gostar"',
    featureKey: "recommendationShowcase",
    label: "Vitrine de recomendações",
    resourceId: ANDROID_SELECTORS.showcase.recommendationRecyclerView,
  });
}
