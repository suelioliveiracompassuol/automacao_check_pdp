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
/** Generous: a cold PDP on the device farm has taken ~23s. */
const PDP_LOAD_TIMEOUT_MS = 45_000;

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

/**
 * Waits for the PDP to finish loading: skeleton gone and the product code filled in. A slow PDP
 * (seen at ~23s) otherwise has its checks run against the skeleton: no buy button yet, and an
 * image carousel (fixed size, so already "visible") without its "1 / N" counter.
 * Returns whether it loaded in time; the checks run either way and report what they see.
 */
export async function waitForPdpLoaded(
  driver: WebdriverIO.Browser,
  timeoutMs = PDP_LOAD_TIMEOUT_MS,
): Promise<boolean> {
  const skeleton = driver.$(`android=${ANDROID_SELECTORS.pdp.skeleton}`);
  const productCode = driver.$(`android=${ANDROID_SELECTORS.pdp.productCode}`);
  return driver
    .waitUntil(
      async () => {
        await dismissZeeDog(driver);
        if (await skeleton.isDisplayed().catch(() => false)) {
          return false;
        }
        const code = await productCode.getText().catch(() => "");
        return /\d/.test(code);
      },
      { timeout: timeoutMs, interval: 500 },
    )
    .then(
      () => true,
      () => false,
    );
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

/** Logs each distinct scroll failure once, so a run shows why a page didn't move. */
const loggedScrollErrors = new Set<string>();
function logScrollError(method: string, error: unknown): void {
  const message = `${method}: ${error instanceof Error ? error.message : String(error)}`;
  if (!loggedScrollErrors.has(message)) {
    loggedScrollErrors.add(message);
    console.log(`   ⚠️  Scroll da PDP falhou (${message})`);
  }
}

type ScrollMethod = (
  driver: WebdriverIO.Browser,
  direction: "down" | "up",
  screen: { width: number; height: number },
) => Promise<void>;

/** UiAutomator2's scroll gesture over GESTURE_AREA. */
const scrollGesture: ScrollMethod = async (driver, direction, screen) => {
  await driver.execute("mobile: scrollGesture", {
    left: Math.round(screen.width * GESTURE_AREA.left),
    top: Math.round(screen.height * GESTURE_AREA.top),
    width: Math.round(screen.width * GESTURE_AREA.width),
    height: Math.round(screen.height * GESTURE_AREA.height),
    direction,
    percent: 1,
  });
};

/**
 * Plain touch swipe (W3C actions) across GESTURE_AREA: fallback for apps where the scroll
 * gesture doesn't move the page (seen on the Avon app, same layout as Natura BR).
 */
const touchSwipe: ScrollMethod = async (driver, direction, screen) => {
  const x = Math.round(screen.width / 2);
  const bottom = Math.round(
    screen.height * (GESTURE_AREA.top + GESTURE_AREA.height),
  );
  const top = Math.round(screen.height * GESTURE_AREA.top);
  const [from, to] = direction === "down" ? [bottom, top] : [top, bottom];
  await driver
    .action("pointer", { parameters: { pointerType: "touch" } })
    .move({ x, y: from })
    .down()
    .pause(100)
    .move({ x, y: to, duration: 500 })
    .up()
    .perform();
};

/**
 * Scrolls the PDP half a screen. Returns whether the screen changed: the gesture's own
 * "can scroll more" result is unreliable on the PDP's NestedScrollView (false after the first
 * swipe), so the end of the page is detected by an unchanged page source instead. Tries the
 * scroll gesture first, then a touch swipe; only when neither moves the page is it the end.
 */
async function scrollPdp(
  driver: WebdriverIO.Browser,
  direction: "down" | "up",
): Promise<{ moved: boolean; source?: string }> {
  let source: string;
  let screen: { width: number; height: number };
  try {
    source = await driver.getPageSource();
    screen = await driver.getWindowSize();
  } catch (e) {
    logScrollError("getPageSource/getWindowSize", e);
    return { moved: false };
  }
  for (const [name, method] of [
    ["scrollGesture", scrollGesture],
    ["touchSwipe", touchSwipe],
  ] as const) {
    try {
      await method(driver, direction, screen);
      const after = await driver.getPageSource();
      if (after !== source) {
        return { moved: true, source: after };
      }
      source = after;
    } catch (e) {
      logScrollError(name, e);
    }
  }
  return { moved: false, source };
}

/** What a page source shows about showcases: carousel-like resource-ids and showcase titles. */
export interface ShowcasePageSummary {
  resourceIds: string[];
  showcaseTitles: string[];
}

const SHOWCASE_ID_PATTERN = /showcase|carousel|einstein|brand|recommend|personaliz|^rv/i;
const SHOWCASE_TITLE_IDS = ["tvMoreBrandProductsTitle", "tvEinsteinShowcaseTitle"];

/**
 * Summarizes a UiAutomator page source for the report when a showcase isn't found, so a run
 * shows which showcase components (if any) the app rendered instead of the expected one.
 */
export function summarizeShowcases(source: string): ShowcasePageSummary {
  const ids = new Set<string>();
  const titles = new Set<string>();
  for (const node of source.match(/<[^>]+resource-id="[^"]*:id\/[^"]+"[^>]*>/g) ?? []) {
    const id = /resource-id="[^"]*:id\/([^"]+)"/.exec(node)?.[1];
    if (!id || !SHOWCASE_ID_PATTERN.test(id)) {
      continue;
    }
    ids.add(id);
    const text = /\stext="([^"]*)"/.exec(node)?.[1];
    if (SHOWCASE_TITLE_IDS.includes(id) && text) {
      titles.add(text);
    }
  }
  return { resourceIds: [...ids].sort(), showcaseTitles: [...titles] };
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
): Promise<{ visibleHeight: number; pageSummary?: ShowcasePageSummary }> {
  let direction: "down" | "up" = "down";
  const moved = { down: 0, up: 0 };
  // Every screen seen on the way, so a miss reports what the whole page had
  const sources: string[] = [];
  for (let i = 0; i < MAX_SCROLLS; i++) {
    const visibleHeight = await getVisibleHeight(el);
    if (visibleHeight >= MIN_VISIBLE_HEIGHT) {
      return { visibleHeight };
    }
    const { moved: didMove, source } = await scrollPdp(driver, direction);
    if (source) {
      sources.push(source);
    }
    if (didMove) {
      moved[direction]++;
      continue;
    }
    if (direction === "up") {
      break;
    }
    await sleepMs(LAZY_LOAD_WAIT_MS);
    direction = "up";
  }
  const visibleHeight = await getVisibleHeight(el);
  if (visibleHeight >= MIN_VISIBLE_HEIGHT) {
    return { visibleHeight };
  }
  const pageSummary = summarizeShowcases(sources.join("\n"));
  console.log(
    `   ℹ️  Elemento não encontrado após rolar ${moved.down}x para baixo e ${moved.up}x para cima` +
      (moved.down === 0 ? " (a página não rolou)" : "") +
      ` — vitrines na página: ${pageSummary.resourceIds.join(", ") || "nenhuma"}` +
      (pageSummary.showcaseTitles.length
        ? ` (títulos: ${pageSummary.showcaseTitles.join(" | ")})`
        : ""),
  );
  return { visibleHeight: 0, pageSummary };
}
