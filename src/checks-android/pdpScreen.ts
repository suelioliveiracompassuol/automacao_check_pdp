import { sleepMs } from "../utils.js";
import { ANDROID_SELECTORS } from "./configs/selectors.js";

type ChainablePromiseElement = ReturnType<WebdriverIO.Browser["$"]>;

/** Below this visible height an element is treated as not on screen (or empty). */
const MIN_VISIBLE_HEIGHT = 40;
/** Half a screen per scroll: never skips past a carousel, which is shorter than that. */
const SCROLL_PERCENT = 0.5;
/** Long PDPs (open description, many accordions) take ~10 half-screen scrolls to the bottom. */
const MAX_SCROLLS = 30;
/** Lazy sections (Einstein, brand products) are appended after the PDP loads. */
const LAZY_LOAD_WAIT_MS = 1500;

/**
 * Closes the ZeeDog floating messages card ("cupom para você") if it's on screen. It shows up
 * a few seconds after the PDP opens and covers the sticky buy bar and the bottom of the page.
 */
export async function dismissZeeDog(
  driver: WebdriverIO.Browser,
): Promise<void> {
  try {
    const close = driver.$(`android=${ANDROID_SELECTORS.pdp.zeeDogClose}`);
    if (await close.isDisplayed()) {
      await close.click();
    }
  } catch {
    // Best effort: the card is not always shown
  }
}

/** Visible height in px (UiAutomator reports the on-screen bounds); 0 when not displayed. */
export async function getVisibleHeight(
  el: ChainablePromiseElement,
): Promise<number> {
  if (!(await el.isDisplayed().catch(() => false))) {
    return 0;
  }
  const size = await el.getSize().catch(() => null);
  return size?.height ?? 0;
}

/**
 * Scrolls the PDP NestedScrollView. Returns whether it can keep scrolling that way
 * (false at the end of the page, or when the gesture isn't available).
 */
async function scrollPdp(
  driver: WebdriverIO.Browser,
  direction: "down" | "up",
): Promise<boolean> {
  try {
    const container = await driver.$(
      `android=${ANDROID_SELECTORS.pdp.scrollContainer}`,
    );
    const canScrollMore = await driver.execute("mobile: scrollGesture", {
      elementId: container.elementId,
      direction,
      percent: SCROLL_PERCENT,
    });
    return canScrollMore !== false;
  } catch {
    return false;
  }
}

/**
 * Scrolls the PDP until `el` is visible, half a screen at a time. Goes down first; at the
 * bottom it waits for lazy sections and then searches back up, so it also finds a section
 * that loaded above the current position. Returns the element's visible height (0 = not found).
 *
 * Replaces UiScrollable.scrollIntoView, which stops at the first visible pixel (leaving the
 * carousel behind the sticky buy bar) and gives up on sections that are still loading.
 */
export async function scrollPdpUntilVisible(
  driver: WebdriverIO.Browser,
  el: ChainablePromiseElement,
): Promise<number> {
  let direction: "down" | "up" = "down";
  for (let i = 0; i < MAX_SCROLLS; i++) {
    const visibleHeight = await getVisibleHeight(el);
    if (visibleHeight >= MIN_VISIBLE_HEIGHT) {
      return visibleHeight;
    }
    if (!(await scrollPdp(driver, direction))) {
      if (direction === "up") {
        break;
      }
      await sleepMs(LAZY_LOAD_WAIT_MS);
      direction = "up";
    }
  }
  const visibleHeight = await getVisibleHeight(el);
  return visibleHeight >= MIN_VISIBLE_HEIGHT ? visibleHeight : 0;
}
