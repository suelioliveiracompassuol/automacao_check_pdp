import { CheckResult, FeatureKey, RemoteConfigFlags } from "../types.js";
import { isFeatureEnabledByRemoteConfig } from "../checks/remoteConfig.js";
import { compareProductAndReviewsRating } from "../checks/ratingConsistency.js";
import type { AppReviewsApi } from "./appNetworkFlags.js";
import { ANDROID_SELECTORS } from "./configs/selectors.js";
import {
  dismissZeeDog,
  forEachPdpScreenDown,
  scrollPdpUntilVisible,
} from "./pdpScreen.js";

/**
 * Android native checks for the "Avaliações & Nota" group, the same rows as the Web monitor.
 * Everything is read from the app: its screen (UiAutomator page source, resource-ids confirmed
 * against ncf-whitelabel-cf-android, see ANDROID_SELECTORS.reviews) and, after the session, the
 * app's own network traffic (reviews API, PDP API rating/top-rated fields, Remote Config
 * product_reviews), applied by applyAppReviewsApi.
 */

interface UiNode {
  id: string;
  text: string;
  desc: string;
}

/** What the screen showed: the reviews section at the bottom and the rating header at the top. */
export interface ReviewsScreen {
  sectionFound: boolean;
  headerFound: boolean;
  /** Distinct nodes of the reviews section screens (section to the end of the page). */
  section: UiNode[];
  /** Nodes of the PDP header screen (rating, stamps). */
  header: UiNode[];
  /** Most review photos (imageReview) seen on a single screen. */
  photosOnScreen: number;
}

const ID = {
  // Header (item_header_rating_ne.xml, item_stamp.xml, item_header_recommendation_percentage_ne.xml)
  headerRating: "tv_rt_value",
  headerSeeRatings: "tv_see_rating",
  headerEvaluate: "tv_review_product",
  stamp: "tv_tag_text",
  recommendation: "recommendationPercentageTextView",
  // Section (fragment_new_product_reviews_ne.xml and includes); radintgTextView is the legacy
  // header's (misspelled) id
  sectionRating: ["ratingTextView", "radintgTextView"],
  sectionTotal: "tvTotalNumberReview",
  noReviews: "noReviewsTextView",
  filter: "btFilterBy",
  sort: "tvSortBy",
  reviewItem: ["main_container", "tvReviewBody", "titleName"],
  photo: ["imageReview", "rvImagesReview"],
};

export function parseUiNodes(source: string): UiNode[] {
  const nodes: UiNode[] = [];
  for (const raw of source.match(/<[^>]+>/g) ?? []) {
    const id = /resource-id="[^"]*:id\/([^"]+)"/.exec(raw)?.[1];
    if (!id || /\sdisplayed="false"/.test(raw)) {
      continue;
    }
    nodes.push({
      id,
      text: /\stext="([^"]*)"/.exec(raw)?.[1] ?? "",
      desc: /content-desc="([^"]*)"/.exec(raw)?.[1] ?? "",
    });
  }
  return nodes;
}

/**
 * Reads the reviews section (scrolling to it, then every screen down to the end of the page),
 * then scrolls back up to the PDP header for the rating and the stamps. Runs after the
 * showcase checks, which leave the page near the bottom, where the section is.
 */
export async function captureReviewsScreen(
  driver: WebdriverIO.Browser,
): Promise<ReviewsScreen> {
  await dismissZeeDog(driver);
  const { visibleHeight } = await scrollPdpUntilVisible(
    driver,
    driver.$(`android=${ANDROID_SELECTORS.reviews.section}`),
  );
  const seen = new Map<string, UiNode>();
  let photosOnScreen = 0;
  if (visibleHeight > 0) {
    await forEachPdpScreenDown(driver, async () => {
      const nodes = parseUiNodes(await driver.getPageSource().catch(() => ""));
      photosOnScreen = Math.max(
        photosOnScreen,
        nodes.filter((n) => n.id === "imageReview").length,
      );
      for (const node of nodes) {
        seen.set(`${node.id}|${node.text}|${node.desc}`, node);
      }
    });
  }

  const header = await scrollPdpUntilVisible(
    driver,
    driver.$(`android=${ANDROID_SELECTORS.reviews.header}`),
    { upOnly: true },
  );
  const headerNodes =
    header.visibleHeight > 0
      ? parseUiNodes(await driver.getPageSource().catch(() => ""))
      : [];

  return {
    sectionFound: visibleHeight > 0,
    headerFound: header.visibleHeight > 0,
    section: [...seen.values()],
    header: headerNodes,
    photosOnScreen,
  };
}

const textOf = (n: UiNode) => n.text || n.desc;
const has = (nodes: UiNode[], ...ids: string[]) =>
  nodes.some((n) => ids.includes(n.id));
const texts = (nodes: UiNode[], ...ids: string[]) =>
  nodes.filter((n) => ids.includes(n.id)).map(textOf).filter(Boolean);

function firstNumber(value: string): number | undefined {
  const m = /\d+(?:[.,]\d+)?/.exec(value);
  return m ? Number(m[0].replace(",", ".")) : undefined;
}

const firstNumberOf = (values: string[]) =>
  values.map(firstNumber).find((n) => n !== undefined);

/** Rounded the way the app shows ratings ("%.1f"). */
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Review count: section "19 avaliações", header "(19) avaliações"; 0 when the app says there are none. */
export function readReviewCount(screen: ReviewsScreen): number | undefined {
  const n =
    firstNumberOf(texts(screen.section, ID.sectionTotal)) ??
    firstNumberOf(texts(screen.header, ID.headerSeeRatings));
  if (n !== undefined) {
    return n;
  }
  if (has(screen.section, ID.noReviews)) {
    return 0;
  }
  // Header: "avalie este produto" instead of "(N) avaliações" only when there are no reviews
  if (has(screen.header, ID.headerEvaluate) && !has(screen.header, ID.headerSeeRatings)) {
    return 0;
  }
  return undefined;
}

/** Ratings the screen shows (0 is "no rating": the app hides it then). */
export function readScreenRatings(screen: ReviewsScreen): {
  header?: number;
  section?: number;
} {
  const positive = (n: number | undefined) =>
    n !== undefined && n > 0 && n <= 5 ? n : undefined;
  return {
    header: positive(firstNumberOf(texts(screen.header, ID.headerRating))),
    section: positive(firstNumberOf(texts(screen.section, ...ID.sectionRating))),
  };
}

function result(
  feature: string,
  featureKey: string,
  status: CheckResult["status"],
  message: string,
  details?: Record<string, unknown>,
): CheckResult {
  return {
    feature,
    featureKey,
    passed: status === "pass" || status === "warning" || status === "na" || status === "disabled",
    status,
    message,
    ...(details ? { details } : {}),
  };
}

const NAMES = {
  reviews: "Avaliações do produto",
  reviewFilter: "Filtro de avaliações",
  reviewSort: "Ordenação de avaliações",
  reviewPhotos: "Fotos nas avaliações",
  reviewRecommendation: "Recomendação de avaliações",
  rating: "Nota/Rating",
  ratingConsistency: "Consistência da Nota (Rating)",
  topRatedBadge: 'Selo "Melhor avaliado"',
} as const;
type ReviewKey = keyof typeof NAMES;
const REVIEW_KEYS = Object.keys(NAMES) as ReviewKey[];

const ENDPOINT_KEY = "endpoint_reviews";
const ENDPOINT_NAME = "🌐 API de avaliações (/reviews/v2/)";

const NO_SECTION = "Seção de avaliações não encontrada na tela";
const NO_REVIEWS = "Produto sem avaliações — não se aplica";

/** Stamp text of the "top rated" badge when its label isn't known (no PDP API capture). */
const TOP_RATED_TEXT = /melhor avaliad|mejor (valorad|calificad|evaluad|puntuad)|top rated/i;

/**
 * Product rating (SFCC, PDP API `rating`, shown in the header) against the reviews' rating
 * (Konfidency, reviews API aggregatedRating, shown in the section), same rule as the Web
 * (compareProductAndReviewsRating; the orchestrator grades a divergence by age). Each side
 * comes from the app's API response when captured, else from what the app showed.
 */
function ratingConsistency(
  screen: { header?: number; section?: number },
  api?: { product?: number; reviews?: number },
): CheckResult {
  const product = api?.product ?? screen.header;
  const reviews = api?.reviews ?? screen.section;
  const ratings = { ...screen, ...(api ? { api } : {}) };
  if (product === undefined || reviews === undefined) {
    return result(
      NAMES.ratingConsistency,
      "ratingConsistency",
      "na",
      product === undefined && reviews === undefined
        ? "Sem nota para comparar"
        : `Só uma nota para comparar: ${product !== undefined ? `produto=${product}` : `reviews=${reviews}`}`,
      { ratings },
    );
  }
  const compared = compareProductAndReviewsRating({
    productRating: product,
    aggregatedRating: reviews,
    productRatingSource: api?.product !== undefined ? "api" : undefined,
    details: { ratings },
  });
  const fromScreen = api?.product === undefined || api?.reviews === undefined;
  return fromScreen
    ? { ...compared, message: `${compared.message} (notas lidas da tela do app: cabeçalho e seção)` }
    : compared;
}

/** All reviews-group results from what the screen showed. */
export function evaluateReviewsScreen(screen: ReviewsScreen): CheckResult[] {
  const { section, header } = screen;
  const count = readReviewCount(screen);
  const ratings = readScreenRatings(screen);
  const noReviews = count === 0;
  const reviewItems = section.filter((n) => n.id === "main_container").length;
  const base = {
    reviewCount: count,
    sectionFound: screen.sectionFound,
    headerFound: screen.headerFound,
  };
  const results: CheckResult[] = [];

  results.push(
    !screen.sectionFound
      ? result(NAMES.reviews, "reviews", "fail", NO_SECTION, base)
      : noReviews
        ? result(NAMES.reviews, "reviews", "pass", "Seção de avaliações presente (produto ainda sem avaliações)", base)
        : !has(section, ...ID.reviewItem)
          ? result(NAMES.reviews, "reviews", "fail", `Seção de avaliações sem nenhuma avaliação listada${count ? ` (o app informa ${count})` : ""}`, base)
          : result(
              NAMES.reviews,
              "reviews",
              "pass",
              count !== undefined
                ? `Seção de avaliações presente com ${count} reviews`
                : "Seção de avaliações presente",
              { ...base, reviewItemsSeen: reviewItems },
            ),
  );

  /** A control of the section: fail without the section, N/A without reviews. */
  const sectionControl = (
    key: "reviewFilter" | "reviewSort",
    id: string,
    present: string,
    missing: string,
  ) =>
    !screen.sectionFound
      ? result(NAMES[key], key, "fail", NO_SECTION)
      : noReviews
        ? result(NAMES[key], key, "na", NO_REVIEWS)
        : has(section, id)
          ? result(NAMES[key], key, "pass", present, { text: texts(section, id)[0] })
          : result(NAMES[key], key, "fail", missing);

  results.push(
    sectionControl(
      "reviewFilter",
      ID.filter,
      "Botão de filtro de avaliações presente",
      "Botão de filtro não encontrado na seção de avaliações",
    ),
    sectionControl(
      "reviewSort",
      ID.sort,
      "Ordenação de avaliações presente",
      "Ordenação não encontrada na seção de avaliações",
    ),
  );

  const filterNote = has(section, ID.filter) ? " (filtro de mídia disponível)" : "";
  results.push(
    !screen.sectionFound
      ? result(NAMES.reviewPhotos, "reviewPhotos", "fail", NO_SECTION)
      : noReviews
        ? result(NAMES.reviewPhotos, "reviewPhotos", "na", NO_REVIEWS)
        : screen.photosOnScreen > 0 || has(section, ...ID.photo)
          ? result(NAMES.reviewPhotos, "reviewPhotos", "pass", "Fotos exibidas nas avaliações", { photosOnScreen: screen.photosOnScreen })
          : result(NAMES.reviewPhotos, "reviewPhotos", "warning", `Nenhuma avaliação com foto entre as exibidas${filterNote}`, { photosOnScreen: 0 }),
  );

  const recommendation = texts(header, ID.recommendation).find((t) => /\d/.test(t));
  results.push(
    recommendation
      ? result(NAMES.reviewRecommendation, "reviewRecommendation", "pass", `${firstNumber(recommendation)}% de recomendação exibido`)
      : result(
          NAMES.reviewRecommendation,
          "reviewRecommendation",
          "na",
          "O app não exibe o percentual de recomendação (recommendation_percentage_section não é preenchida pelo app)",
        ),
  );

  const shownRating = ratings.header ?? ratings.section;
  results.push(
    shownRating !== undefined
      ? result(NAMES.rating, "rating", "pass", `Nota ${shownRating} exibida`, { ratings })
      : noReviews
        ? result(NAMES.rating, "rating", "na", "Produto sem avaliações — sem nota para exibir")
        : !screen.sectionFound && !screen.headerFound
          ? result(NAMES.rating, "rating", "fail", "Nota não encontrada: nem o cabeçalho nem a seção de avaliações apareceram")
          : result(NAMES.rating, "rating", "fail", "Nota não encontrada na PDP", { ratings }),
  );

  results.push(
    ratingConsistency(ratings),
  );

  const stamps = texts(header, ID.stamp);
  const badge = stamps.find((s) => TOP_RATED_TEXT.test(s));
  results.push(
    badge
      ? result(NAMES.topRatedBadge, "topRatedBadge", "pass", `Selo "${badge}" exibido`, { stamps, headerFound: screen.headerFound })
      : result(
          NAMES.topRatedBadge,
          "topRatedBadge",
          "na",
          "Selo não exibido; sem a API da PDP (captura de rede) não dá para saber se o produto é melhor avaliado",
          { stamps, headerFound: screen.headerFound },
        ),
  );

  return results;
}

/** All reviews-group results, from one pass over the page. */
export async function checkReviewsGroupAndroid(
  driver: WebdriverIO.Browser,
): Promise<CheckResult[]> {
  try {
    return evaluateReviewsScreen(await captureReviewsScreen(driver));
  } catch (error) {
    const message = `Erro ao verificar avaliações: ${error instanceof Error ? error.message : String(error)}`;
    return REVIEW_KEYS.map((key) => result(NAMES[key], key, "error", message));
  }
}

// =============================================================================
// After the session: the app's own traffic (reviews API, PDP API, Remote Config)
// =============================================================================

/** Review rows the app only shows behind product_reviews (ProductDetailsNeActivity.loadReviewsSection,
 * ProductBaseInformationViewHolder.controlRatingSection, NewProductReviewsSectionFragment.setupFilterVisibility). */
const GATED_BY_REVIEWS_ENABLED: string[] = ["reviews", "reviewFilter", "reviewSort", "reviewPhotos", "rating", "ratingConsistency", ENDPOINT_KEY];

function disabledByRemoteConfig(
  key: string,
  flags: RemoteConfigFlags | null | undefined,
): CheckResult | null {
  if (!flags || !(key in NAMES || key === ENDPOINT_KEY)) {
    return null;
  }
  // The section, the header rating and the API calls all hang on product_reviews.enabled
  const gateKey = (GATED_BY_REVIEWS_ENABLED.includes(key) ? "reviews" : key) as FeatureKey;
  const own = isFeatureEnabledByRemoteConfig(key as FeatureKey, flags);
  const parent = isFeatureEnabledByRemoteConfig(gateKey, flags);
  const gate = [parent, own].find((g) => !g.enabled && g.flagValue !== undefined);
  if (!gate) {
    return null;
  }
  const name = key === ENDPOINT_KEY ? ENDPOINT_NAME : NAMES[key as ReviewKey];
  return {
    feature: name,
    featureKey: key,
    passed: true,
    status: "disabled",
    message: `Desabilitado via Remote Config (${gate.flagKey}=${JSON.stringify(gate.flagValue)})`,
    flagKey: gate.flagKey,
    flagValue: gate.flagValue,
  };
}

function endpointResult(api: AppReviewsApi): CheckResult {
  const { calls } = api;
  if (calls.length === 0) {
    // Evidence: what was looked for and what the app did ask for in the session
    const others = api.otherSessionCalls ?? [];
    const ids = api.matchedIds ?? [];
    const looked = ids.length > 3 ? `${ids.slice(0, 3).join(", ")} +${ids.length - 3}` : ids.join(", ");
    const seen = others.length
      ? `chamadas de avaliações na sessão: ${others.map((c) => `productId=${c.productId}${c.status ? ` (${c.status})` : ""}`).join(", ")}`
      : "nenhuma chamada de avaliações na sessão";
    return result(
      ENDPOINT_NAME,
      ENDPOINT_KEY,
      "fail",
      `O app não chamou a API de avaliações (reviews/v2/details) deste produto · procurado productId: ${looked || "?"} · ${seen}`,
      { match: "/reviews/v2/details", notCalled: true, matchedIds: ids, otherSessionCalls: others },
    );
  }
  const failed = calls.filter((c) => c.status !== undefined && c.status >= 400);
  if (failed.length > 0) {
    return result(
      ENDPOINT_NAME,
      ENDPOINT_KEY,
      "fail",
      `${failed.length}/${calls.length} chamada(s) retornaram status inesperado: ${failed.map((c) => c.status).join(", ")}`,
      { match: "/reviews/v2/details", totalCalls: calls.length, failedCalls: failed },
    );
  }
  const statuses = [...new Set(calls.map((c) => c.status).filter((s) => s !== undefined))];
  return result(
    ENDPOINT_NAME,
    ENDPOINT_KEY,
    "pass",
    `${calls.length} chamada(s) ok${statuses.length ? ` (status ${statuses.join(", ")})` : ""}`,
    { match: "/reviews/v2/details", totalCalls: calls.length },
  );
}

function withApi(r: CheckResult, api: AppReviewsApi): CheckResult {
  const reviews = api.reviews;
  const product = api.product;
  const details = { ...r.details, api: { ...reviews, ...product } };
  switch (r.featureKey) {
    case "reviews": {
      if (r.status === "pass" && reviews?.reviewsCount !== undefined) {
        const shown = r.details?.reviewCount;
        if (typeof shown === "number" && shown !== reviews.reviewsCount) {
          return { ...r, status: "warning", message: `${r.message} · API de avaliações informa ${reviews.reviewsCount}`, details };
        }
      }
      return { ...r, details };
    }
    case "reviewPhotos": {
      if (!reviews || r.status === "na" || r.status === "error") {
        return r;
      }
      if (r.status === "warning" && reviews.reviewsWithPictures > 0) {
        return {
          ...r,
          passed: false,
          status: "fail",
          message: `API retorna ${reviews.reviewsWithPictures} avaliação(ões) com foto (${reviews.pictureCount} foto(s)) na 1ª página, mas o app não exibe nenhuma`,
          details,
        };
      }
      if (r.status === "pass") {
        return { ...r, message: `${reviews.pictureCount} foto(s) em ${reviews.reviewsWithPictures} avaliação(ões) (API) · exibidas no app`, details };
      }
      return { ...r, message: `${r.message} · API: nenhuma avaliação com foto na 1ª página`, details };
    }
    case "reviewRecommendation": {
      if (r.status !== "na" || reviews?.recommendedPercentage === undefined) {
        return r;
      }
      return { ...r, message: `${r.message} · API informa ${reviews.recommendedPercentage}%`, details };
    }
    case "ratingConsistency": {
      const { header, section } = (r.details?.ratings ?? {}) as { header?: number; section?: number };
      const positive = (n?: number) => (n !== undefined && n > 0 ? n : undefined);
      return ratingConsistency(
        { header, section },
        { product: positive(product?.rating), reviews: positive(reviews?.aggregatedRating) },
      );
    }
    case "rating": {
      // The header must show the product API's rating (SFCC)
      const shown = (r.details?.ratings as { header?: number } | undefined)?.header;
      const apiRating = product?.rating;
      if (r.status !== "pass" || shown === undefined || !apiRating) {
        return { ...r, details };
      }
      return round1(shown) === round1(apiRating)
        ? { ...r, message: `${r.message} (igual à API do produto)`, details }
        : result(NAMES.rating, "rating", "fail", `Nota exibida ${shown} diferente da nota da API do produto (${apiRating})`, details);
    }
    case "topRatedBadge": {
      if (!product || r.status === "error") {
        return r;
      }
      const stamps = (r.details?.stamps ?? []) as string[];
      const headerFound = r.details?.headerFound === true;
      const label = product.badgeTopRatedLabel;
      const shown = stamps.find((s) =>
        label ? s.trim().toLowerCase() === label.trim().toLowerCase() : TOP_RATED_TEXT.test(s),
      );
      if (product.isTopRated) {
        if (!label) {
          return result(NAMES.topRatedBadge, "topRatedBadge", "warning", "API do produto retorna isTopRated: true sem badgeTopRatedLabel — o app não exibe o selo", details);
        }
        if (shown) {
          return result(NAMES.topRatedBadge, "topRatedBadge", "pass", `API do produto retorna isTopRated: true e o selo "${shown}" é exibido`, details);
        }
        return result(
          NAMES.topRatedBadge,
          "topRatedBadge",
          "fail",
          headerFound
            ? `API do produto retorna isTopRated: true, mas o selo "${label}" não é exibido`
            : `API do produto retorna isTopRated: true, mas o cabeçalho da PDP não foi encontrado para conferir o selo`,
          details,
        );
      }
      return shown
        ? result(NAMES.topRatedBadge, "topRatedBadge", "fail", `API do produto não retorna isTopRated: true, mas o selo "${shown}" é exibido`, details)
        : result(NAMES.topRatedBadge, "topRatedBadge", "pass", 'API do produto não retorna isTopRated: true e o selo "melhor avaliado" corretamente não é exibido', details);
    }
    default:
      return r;
  }
}

/**
 * Completes the reviews-group results with what the app received in the session (read after it
 * closes): Remote Config product_reviews turns rows the app hides into "disabled"; the reviews
 * API adds its own row and checks counts, photos and rating; the PDP API decides the "top rated"
 * badge. Without a capture for this SKU the screen results stand.
 */
export function applyAppReviewsApi(
  features: CheckResult[],
  api: AppReviewsApi | undefined,
  remoteConfig: RemoteConfigFlags | null | undefined,
): CheckResult[] {
  const hasReviewsGroup = features.some((f) => f.featureKey in NAMES);
  if (!hasReviewsGroup) {
    return features;
  }
  let out = features.map((f) =>
    f.featureKey in NAMES && api && f.status !== "error" ? withApi(f, api) : f,
  );
  if (api && !out.some((f) => f.featureKey === ENDPOINT_KEY)) {
    const index = out.findIndex((f) => f.featureKey === "topRatedBadge");
    const endpoint = endpointResult(api);
    out = index >= 0
      ? [...out.slice(0, index + 1), endpoint, ...out.slice(index + 1)]
      : [...out, endpoint];
  }
  return out.map((f) => disabledByRemoteConfig(f.featureKey, remoteConfig) ?? f);
}
