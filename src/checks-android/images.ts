import { CheckResult } from "../types.js";
import type { PdpApiImages } from "./appNetworkFlags.js";
import { sleepMs } from "../utils.js";
import { ANDROID_SELECTORS } from "./configs/selectors.js";
import { contentRatio, decodePng } from "./pngImage.js";
import { dismissZeeDog, getVisibleHeight } from "./pdpScreen.js";

type ChainablePromiseElement = ReturnType<WebdriverIO.Browser["$"]>;

const FEATURE = "Imagens do produto";
const FEATURE_KEY = "images";

/** Below this the carousel is treated as not on screen. */
const MIN_CAROUSEL_HEIGHT = 200;
const CAROUSEL_WAIT_MS = 10_000;
/** Coil loads each page lazily (with crossfade) when it becomes current. */
const IMAGE_LOAD_TIMEOUT_MS = 8_000;
const POLL_INTERVAL_MS = 500;
const PAGE_CHANGE_TIMEOUT_MS = 2_000;
const PAGE_CHANGE_POLL_MS = 250;
/** Keeps a PDP with a huge gallery from eating the session's time. */
const MAX_IMAGES = 10;
/**
 * Area analyzed in each page: the middle of the image, away from the side navigation arrows
 * (vertically centered on both edges) and the page indicators / "1 / N" counter at the bottom,
 * which are drawn over the image even when it never loaded.
 */
const ANALYSIS_CROP = { left: 0.2, top: 0.1, width: 0.6, height: 0.7 };
/** Below this share of non-background pixels the page is blank (image didn't load). */
const MIN_CONTENT_RATIO = 0.01;

type ImageState = "loaded" | "blank" | "unknown";

/** "2 / 7" → { page: 2, total: 7 }; null when the counter isn't shown (single image) or unreadable. */
export function parseImageCounter(
  text: string | undefined,
): { page: number; total: number } | null {
  const match = /(\d+)\s*\/\s*(\d+)/.exec(text ?? "");
  return match ? { page: Number(match[1]), total: Number(match[2]) } : null;
}

async function readCounter(
  driver: WebdriverIO.Browser,
): Promise<{ page: number; total: number } | null> {
  const counter = driver.$(`android=${ANDROID_SELECTORS.images.counter}`);
  if (!(await counter.isDisplayed().catch(() => false))) {
    return null;
  }
  return parseImageCounter(await counter.getText().catch(() => undefined));
}

/** Whether the carousel's current page shows a picture, judged from the element's own screenshot. */
async function currentImageState(
  driver: WebdriverIO.Browser,
  carousel: ChainablePromiseElement,
): Promise<{ state: ImageState; ratio?: number; reason?: string }> {
  try {
    const elementId = await carousel.elementId;
    const base64 = await driver.takeElementScreenshot(elementId);
    const ratio = contentRatio(
      decodePng(Buffer.from(base64, "base64")),
      ANALYSIS_CROP,
    );
    return { state: ratio >= MIN_CONTENT_RATIO ? "loaded" : "blank", ratio };
  } catch (e) {
    return {
      state: "unknown",
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Polls the current page until its image shows up or the timeout ends. */
async function waitForImage(
  driver: WebdriverIO.Browser,
  carousel: ChainablePromiseElement,
  timeoutMs: number,
): Promise<{ state: ImageState; reason?: string }> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await currentImageState(driver, carousel);
    if (result.state !== "blank" || Date.now() >= deadline) {
      return result;
    }
    await sleepMs(POLL_INTERVAL_MS);
  }
}

/**
 * Taps the carousel's "next image" area. ncf-ui's BannerCarouselComposable draws two clickable
 * full-height boxes over the pager (zIndex), the left and right 20% of its width
 * (SIDE_NAV_WIDTH_FRACTION, "Ir para a próxima imagem"); a swipe starting there never reaches
 * the pager, and a tap in the middle opens the full-screen gallery. Tapping the right box runs
 * the app's own animateScrollToPage(next).
 */
async function tapNextImage(
  driver: WebdriverIO.Browser,
  carousel: ChainablePromiseElement,
): Promise<void> {
  const { x, y } = await carousel.getLocation();
  const { width, height } = await carousel.getSize();
  await driver
    .action("pointer", { parameters: { pointerType: "touch" } })
    .move({ x: Math.round(x + width * 0.9), y: Math.round(y + height * 0.5) })
    .down()
    .pause(50)
    .up()
    .perform();
}

/** Waits for the "N / total" counter to reach `position` (the page animation takes ~300ms). */
async function waitForPage(
  driver: WebdriverIO.Browser,
  position: number,
): Promise<boolean> {
  const deadline = Date.now() + PAGE_CHANGE_TIMEOUT_MS;
  for (;;) {
    const counter = await readCounter(driver);
    // Counter gone (e.g. a tap opened the gallery): can't tell, so don't report it as stuck
    if (!counter || counter.page === position) {
      return true;
    }
    if (Date.now() >= deadline) {
      return false;
    }
    await sleepMs(PAGE_CHANGE_POLL_MS);
  }
}

/**
 * Android native check for the product image carousel, the app counterpart of the Web
 * `checkImages`: the carousel must be on screen and every image of the gallery (read from the
 * "1 / N" counter, capped at MAX_IMAGES) must render. Each page is brought into view with the
 * carousel's "next image" tap area and judged
 * by the pixels of the carousel element — the Compose images expose nothing in the
 * accessibility tree, and a Coil load that fails leaves the page blank.
 *
 * Runs right after the PDP opens, while the carousel is at the top of the screen.
 */
export async function checkImagesAndroid(
  driver: WebdriverIO.Browser,
  { imageLoadTimeoutMs = IMAGE_LOAD_TIMEOUT_MS } = {},
): Promise<CheckResult> {
  try {
    await dismissZeeDog(driver);
    const carousel = driver.$(`android=${ANDROID_SELECTORS.images.carousel}`);
    const deadline = Date.now() + CAROUSEL_WAIT_MS;
    let carouselHeight = await getVisibleHeight(carousel);
    while (carouselHeight < MIN_CAROUSEL_HEIGHT && Date.now() < deadline) {
      await sleepMs(POLL_INTERVAL_MS);
      carouselHeight = await getVisibleHeight(carousel);
    }
    if (carouselHeight < MIN_CAROUSEL_HEIGHT) {
      return {
        feature: FEATURE,
        featureKey: FEATURE_KEY,
        passed: false,
        status: "fail",
        message: "Carrossel de imagens do produto não encontrado na tela",
        details: { hasCarousel: false },
      };
    }

    // No counter = single image (the app hides it when there's only one)
    const total = (await readCounter(driver))?.total ?? 1;
    const toCheck = Math.min(total, MAX_IMAGES);
    const blankPositions: number[] = [];
    const unknownPositions: number[] = [];
    let loadedCount = 0;
    let stuckAt: number | undefined;

    for (let position = 1; position <= toCheck; position++) {
      if (position > 1) {
        await tapNextImage(driver, carousel);
        if (!(await waitForPage(driver, position))) {
          // One more try: the tap may have landed while the previous animation was running
          await tapNextImage(driver, carousel);
          if (!(await waitForPage(driver, position))) {
            stuckAt = position;
            break;
          }
        }
      }
      const { state, reason } = await waitForImage(
        driver,
        carousel,
        imageLoadTimeoutMs,
      );
      if (state === "loaded") {
        loadedCount++;
      } else if (state === "blank") {
        blankPositions.push(position);
      } else {
        unknownPositions.push(position);
        console.log(
          `   ⚠️  Imagem ${position}/${total}: não foi possível analisar o screenshot (${reason})`,
        );
      }
    }

    const checked =
      loadedCount + blankPositions.length + unknownPositions.length;
    const details = {
      hasCarousel: true,
      imageCount: total,
      checkedCount: checked,
      loadedCount,
      blankCount: blankPositions.length,
      ...(blankPositions.length ? { blankPositions } : {}),
      ...(unknownPositions.length ? { unknownPositions } : {}),
      ...(stuckAt ? { pageStuckAt: stuckAt } : {}),
    };
    const notes = [
      total > MAX_IMAGES ? `${MAX_IMAGES} de ${total} verificadas` : "",
      stuckAt ? `carrossel não avançou para a imagem ${stuckAt}` : "",
      unknownPositions.length
        ? `${unknownPositions.length} sem análise do screenshot`
        : "",
    ].filter(Boolean);
    const suffix = notes.length ? ` — ${notes.join("; ")}` : "";

    if (blankPositions.length > 0) {
      return {
        feature: FEATURE,
        featureKey: FEATURE_KEY,
        passed: false,
        status: "fail",
        message:
          loadedCount === 0
            ? `Imagens encontradas (${total}) mas nenhuma carregou (em branco na tela)${suffix}`
            : `${loadedCount} ok, ${blankPositions.length} imagem(ns) em branco (posição ${blankPositions.join(", ")})${suffix}`,
        details,
      };
    }
    if (loadedCount === 0) {
      return {
        feature: FEATURE,
        featureKey: FEATURE_KEY,
        passed: true,
        status: "warning",
        message: `Carrossel presente (${total} imagem(ns)), mas não foi possível confirmar o carregamento${suffix}`,
        details,
      };
    }
    return {
      feature: FEATURE,
      featureKey: FEATURE_KEY,
      passed: true,
      // Only an incomplete check is a warning; capping a long gallery is expected
      status: stuckAt || unknownPositions.length ? "warning" : "pass",
      message: `${loadedCount} imagem(ns) carregada(s) corretamente (carrossel presente)${suffix}`,
      details,
    };
  } catch (error) {
    return {
      feature: FEATURE,
      featureKey: FEATURE_KEY,
      passed: false,
      status: "error",
      message: `Erro ao verificar imagens: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

const fileName = (url: string) => url.split("?")[0].split("/").pop() || url;

/**
 * Adds what the app received from the PDP API (session network capture, read after the session
 * closes) to the on-screen images result: the API must list images, and the app's download of
 * each one must not fail. Fewer images on screen than in the API is a warning. Without a
 * capture of the API body the screen result stands as is.
 */
export function applyPdpApiImages(
  result: CheckResult,
  api: PdpApiImages | undefined,
): CheckResult {
  if (!api || result.featureKey !== FEATURE_KEY || result.status === "error") {
    return result;
  }
  const details = {
    ...result.details,
    api: {
      source: api.source,
      imageCount: api.urls.length,
      downloadedCount: api.downloadedCount,
      ...(api.failed.length ? { failed: api.failed } : {}),
    },
  };
  if (api.urls.length === 0) {
    return {
      ...result,
      passed: false,
      status: "fail",
      message: `API da PDP não retornou imagens do produto · tela: ${result.message}`,
      details,
    };
  }
  if (api.failed.length > 0) {
    const sample = api.failed
      .slice(0, 3)
      .map((f) => `HTTP ${f.status} ${fileName(f.url)}`)
      .join(", ");
    return {
      ...result,
      passed: false,
      status: "fail",
      message: `${api.failed.length} de ${api.urls.length} imagem(ns) da API com erro no download (${sample}) · tela: ${result.message}`,
      details,
    };
  }
  const apiNote = `API: ${api.urls.length} imagem(ns)${api.downloadedCount ? `, ${api.downloadedCount} baixada(s) pelo app` : ""}`;
  // The screen counter also counts the product video, so only fewer than the API is a gap
  const onScreen = result.details?.imageCount;
  if (
    typeof onScreen === "number" &&
    onScreen < api.urls.length &&
    result.status !== "fail"
  ) {
    return {
      ...result,
      status: "warning",
      message: `${result.message} · tela mostra ${onScreen} de ${api.urls.length} imagens da API`,
      details,
    };
  }
  return { ...result, message: `${result.message} · ${apiNote}`, details };
}
