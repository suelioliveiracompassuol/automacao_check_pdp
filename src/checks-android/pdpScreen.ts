import { sleepMs } from "../utils.js";
import { ANDROID_SELECTORS } from "./configs/selectors.js";

type ChainablePromiseElement = ReturnType<WebdriverIO.Browser["$"]>;

/** Below this visible height an element is treated as not on screen (or empty). */
const MIN_VISIBLE_HEIGHT = 40;
/**
 * Gesture area: the middle half of the screen. Swipes near the top edge open Android's
 * notification shade (it stayed open over the app for the next SKUs), and the bottom has the
 * sticky buy bar. Scrolling 100% of this area moves the page half a screen, which never skips
 * past a carousel.
 */
const GESTURE_AREA = { top: 0.25, height: 0.5, left: 0.1, width: 0.8 };
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
 * Scrolls the PDP half a screen. Returns whether the screen changed: the gesture's own
 * "can scroll more" result is unreliable on the PDP's NestedScrollView (false after the first
 * swipe), so the end of the page is detected by an unchanged page source instead.
 */
async function scrollPdp(
  driver: WebdriverIO.Browser,
  direction: "down" | "up",
): Promise<boolean> {
  try {
    const before = await driver.getPageSource();
    const { width, height } = await driver.getWindowSize();
    await driver.execute("mobile: scrollGesture", {
      left: Math.round(width * GESTURE_AREA.left),
      top: Math.round(height * GESTURE_AREA.top),
      width: Math.round(width * GESTURE_AREA.width),
      height: Math.round(height * GESTURE_AREA.height),
      direction,
      percent: 1,
    });
    return (await driver.getPageSource()) !== before;
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
