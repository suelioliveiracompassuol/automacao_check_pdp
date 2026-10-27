import { CheckResult } from "../types.js";
import type { PdpApiContentBanners } from "./appNetworkFlags.js";
import { sleepMs } from "../utils.js";
import { ANDROID_SELECTORS } from "./configs/selectors.js";
import { contentRatio, decodePng } from "./pngImage.js";
import { dismissZeeDog, forEachPdpScreenDown } from "./pdpScreen.js";

const FEATURE = "Banners de conteúdo do produto";
const FEATURE_KEY = "contentBanners";

/** Below this visible height a banner is only peeking in at a screen edge: judged on a later screen. */
const MIN_BANNER_HEIGHT = 200;
/** Glide loads the image when the RecyclerView binds the banner, i.e. as it scrolls into view. */
const IMAGE_LOAD_TIMEOUT_MS = 8_000;
const POLL_INTERVAL_MS = 500;
/**
 * Area analyzed in each banner: away from the widepic's side arrows and page dots and from the
 * text card that overlaps the bottom of the type1 banner (marginTop -48dp).
 */
const ANALYSIS_CROP = { left: 0.2, top: 0.1, width: 0.6, height: 0.7 };
/**
 * Below this share of non-background pixels the banner is blank. Glide's loading spinner is a
 * small ring (well under 1% of the area). The error icon, scaled up by centerCrop, scores like a
 * picture: a failed download is caught by the network capture instead (applyPdpApiContentBanners).
 */
const MIN_CONTENT_RATIO = 0.02;

type BannerKind = "banner" | "widepic";
type BannerState = "loaded" | "blank" | "unknown";

const KINDS: { kind: BannerKind; selector: string }[] = [
  { kind: "banner", selector: ANDROID_SELECTORS.contentBanners.banner },
  { kind: "widepic", selector: ANDROID_SELECTORS.contentBanners.widepic },
];

/** Whether a banner shows a picture, judged from the element's own screenshot. */
async function bannerState(
  driver: WebdriverIO.Browser,
  elementId: string,
): Promise<{ state: BannerState; reason?: string }> {
  try {
    const base64 = await driver.takeElementScreenshot(elementId);
    const ratio = contentRatio(
      decodePng(Buffer.from(base64, "base64")),
      ANALYSIS_CROP,
    );
    return { state: ratio >= MIN_CONTENT_RATIO ? "loaded" : "blank" };
  } catch (e) {
    return {
      state: "unknown",
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Polls a banner until its image shows up or the timeout ends. */
async function waitForBanner(
  driver: WebdriverIO.Browser,
  elementId: string,
  timeoutMs: number,
): Promise<{ state: BannerState; reason?: string }> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await bannerState(driver, elementId);
    if (result.state !== "blank" || Date.now() >= deadline) {
      return result;
    }
    await sleepMs(POLL_INTERVAL_MS);
  }
}

/**
 * Android native check for the product content banners, the app counterpart of the Web
 * `checkContentBanners`: scrolls the PDP down to the end and judges every banner image on screen
 * (type1 banner and the visible page of each widepic carousel) by its pixels — a blank one
 * didn't load. A PDP without banners is N/A here; whether the product should have them comes
 * from the PDP API in the session's network capture (applyPdpApiContentBanners).
 *
 * Runs after the image carousel check (top of the PDP) and leaves the page at the bottom, where
 * the showcase checks start their search.
 */
export async function checkContentBannersAndroid(
  driver: WebdriverIO.Browser,
  { imageLoadTimeoutMs = IMAGE_LOAD_TIMEOUT_MS } = {},
): Promise<CheckResult> {
  try {
    await dismissZeeDog(driver);
    // Keyed by element id: the same banner shows up on more than one screen while scrolling
    const states = new Map<string, BannerState>();
    const kinds = new Set<BannerKind>();
    let partialOnly = 0;

    const scrolls = await forEachPdpScreenDown(driver, async () => {
      for (const { kind, selector } of KINDS) {
        const elements = await driver.$$(`android=${selector}`);
        for (const el of elements) {
          if (!(await el.isDisplayed().catch(() => false))) {
            continue;
          }
          kinds.add(kind);
          const elementId = await el.elementId;
          const height = (await el.getSize().catch(() => null))?.height ?? 0;
          if (height < MIN_BANNER_HEIGHT) {
            partialOnly++;
            continue;
          }
          if (states.get(elementId) === "loaded") {
            continue;
          }
          const { state, reason } = await waitForBanner(
            driver,
            elementId,
            imageLoadTimeoutMs,
          );
          if (state === "unknown") {
            console.log(
              `   ⚠️  Banner (${kind}): não foi possível analisar o screenshot (${reason})`,
            );
          }
          // A banner judged blank on one screen and loaded on the next did load
          if (states.get(elementId) !== "loaded") {
            states.set(elementId, state);
          }
        }
      }
    });

    const all = [...states.values()];
    const loadedCount = all.filter((s) => s === "loaded").length;
    const blankCount = all.filter((s) => s === "blank").length;
    const unknownCount = all.filter((s) => s === "unknown").length;
    const details = {
      bannersOnScreen: states.size,
      kinds: [...kinds],
      loadedCount,
      blankCount,
      ...(unknownCount ? { unknownCount } : {}),
      scrolls,
    };

    if (kinds.size === 0) {
      return {
        feature: FEATURE,
        featureKey: FEATURE_KEY,
        passed: true,
        status: "na",
        message: `Produto sem banners de conteúdo na tela (PDP rolada até o fim, ${scrolls} rolagem(ns)) — verificação de banners não se aplica.`,
        details,
      };
    }
    if (blankCount > 0) {
      return {
        feature: FEATURE,
        featureKey: FEATURE_KEY,
        passed: false,
        status: "fail",
        message:
          loadedCount === 0
            ? `Banners encontrados (${states.size}) mas nenhum carregou (em branco na tela)`
            : `${loadedCount} ok, ${blankCount} banner(s) em branco na tela`,
        details,
      };
    }
    if (loadedCount === 0) {
      return {
        feature: FEATURE,
        featureKey: FEATURE_KEY,
        passed: true,
        status: "warning",
        message:
          states.size === 0
            ? `Banner de conteúdo apareceu só parcialmente na tela (${partialOnly}x) — não foi possível verificar a imagem`
            : `Banners presentes (${states.size}), mas não foi possível confirmar o carregamento`,
        details,
      };
    }
    return {
      feature: FEATURE,
      featureKey: FEATURE_KEY,
      passed: true,
      status: unknownCount ? "warning" : "pass",
      message:
        `${loadedCount} banner(s) de conteúdo carregado(s) na tela` +
        (unknownCount ? ` — ${unknownCount} sem análise do screenshot` : ""),
      details,
    };
  } catch (error) {
    return {
      feature: FEATURE,
      featureKey: FEATURE_KEY,
      passed: false,
      status: "error",
      message: `Erro ao verificar banners de conteúdo: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

const fileName = (url: string) => url.split("?")[0].split("/").pop() || url;

/**
 * Adds what the app received from the PDP API (session network capture, read after the session
 * closes) to the on-screen banners result: banners the API sent must show up on screen, and the
 * app's download of their images must not fail. Without a capture of the API body the screen
 * result stands as is.
 */
export function applyPdpApiContentBanners(
  result: CheckResult,
  api: PdpApiContentBanners | undefined,
): CheckResult {
  if (!api || result.featureKey !== FEATURE_KEY || result.status === "error") {
    return result;
  }
  const details = {
    ...result.details,
    api: {
      components: api.components.map((c) => ({
        type: c.type,
        imageCount: c.urls.length,
      })),
      imageCount: api.urls.length,
      downloadedCount: api.downloadedCount,
      ...(api.failed.length ? { failed: api.failed } : {}),
    },
  };
  if (api.components.length === 0) {
    return { ...result, message: `${result.message} · API: sem banners`, details };
  }
  const apiNote = `API: ${api.components.length} banner(s), ${api.urls.length} imagem(ns)${api.downloadedCount ? `, ${api.downloadedCount} baixada(s) pelo app` : ""}`;
  if (api.failed.length > 0) {
    const sample = api.failed
      .slice(0, 3)
      .map((f) => `HTTP ${f.status} ${fileName(f.url)}`)
      .join(", ");
    return {
      ...result,
      passed: false,
      status: "fail",
      message: `${api.failed.length} de ${api.urls.length} imagem(ns) de banner com erro no download (${sample}) · tela: ${result.message}`,
      details,
    };
  }
  if (result.status === "na") {
    return {
      ...result,
      passed: false,
      status: "fail",
      message: `API da PDP enviou ${api.components.length} banner(s) de conteúdo, mas nenhum apareceu na tela`,
      details,
    };
  }
  return { ...result, message: `${result.message} · ${apiNote}`, details };
}
