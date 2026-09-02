import { Page } from "@playwright/test";
import { CheckResult } from "../types.js";
import { getReviewCount, sleepMs } from "../utils.js";

interface CapturedRatingData {
  /** rating field from /pages/v2/product/:id */
  productRating?: number;
  /** aggregatedRating field from /reviews/v2/details */
  aggregatedRating?: number;
  /** reviewsCount from /reviews/v2/details */
  reviewsCount?: number;
  /** URL of the product API call (for report details) */
  productApiUrl?: string;
  /** URL of the reviews API call (for report details) */
  reviewsApiUrl?: string;
}

/**
 * WeakMap stores captured data per page instance.
 * Keys are garbage-collected when the page is closed.
 */
export const captureCache = new WeakMap<Page, CapturedRatingData>();

/**
 * Must be called AFTER page.waitForLoadState("load") but BEFORE
 * dismissCookieBanner / scrollAndLoadContent.
 *
 * This function is a fallback for pages where the product rating is not
 * available via the standard client-side APIs or initial SSR data blobs
 * (__NEXT_DATA__).
 *
 * It attempts to capture the rating by:
 * 1. Parsing <script type="application/ld+json"> from the DOM (for natura.com.br).
 * 2. For avon.com.br, finding the rating element based on its proximity to a
 *    stable `data-testid`.
 */
export async function captureRatingFromDOM(page: Page): Promise<void> {
  const existing = captureCache.get(page) ?? {};
  if (existing.productRating !== undefined) {
    return;
  }
  const pageUrl = page.url();

  try {
    const isAvon =
      pageUrl.includes("avon.com.br") || pageUrl.includes("marca=avon");

    // Case 1: Avon-specific DOM scraping using data-testid
    if (isAvon) {
      const ratingButton = page.locator('[data-testid="go-to-reviews-button"]');
      // The rating span is a sibling to the button's parent.
      const ratingLocator = ratingButton
        .locator("..")
        .locator("..")
        .locator("span")
        .first();
      const ratingText = await ratingLocator.textContent({ timeout: 12000 });

      if (ratingText) {
        const parsed = parseFloat(ratingText.replace(",", "."));
        if (!isNaN(parsed)) {
          const current = captureCache.get(page) ?? {};
          if (current.productRating === undefined) {
            captureCache.set(page, { ...current, productRating: parsed });
          }
          return; // Found it for Avon, we're done.
        }
      }
    }

    // Case 2: Poll for JSON-LD (original logic for natura.com.br)
    // Use waitForFunction to poll the DOM until the JSON-LD with ratingValue is available.
    const ratingHandle = await page.waitForFunction(
      () => {
        const scripts = Array.from(
          document.querySelectorAll('script[type="application/ld+json"]'),
        );
        for (const s of scripts) {
          try {
            const data = JSON.parse(s.textContent ?? "");
            const aggregateRating = data?.aggregateRating;
            if (aggregateRating?.ratingValue !== undefined) {
              const parsed = parseFloat(String(aggregateRating.ratingValue));
              if (!isNaN(parsed)) {
                return parsed;
              }
            }
          } catch {
            // ignore malformed JSON-LD
          }
        }
        return undefined; // Keep polling if not found
      },
      { timeout: 12000 },
    );

    const rating = await ratingHandle.jsonValue();

    if (typeof rating === "number") {
      // Re-read the cache to avoid race conditions with other listeners.
      const current = captureCache.get(page) ?? {};
      if (current.productRating === undefined) {
        captureCache.set(page, { ...current, productRating: rating });
      }
    }
  } catch {
    // ignore evaluation errors (e.g. page navigated away, locator timed out)
  }
}

/**
 * Must be called BEFORE page.goto() in the main orchestrator.
 * Intercepts the product and reviews API responses and stores them for later
 * use by checkRatingConsistency — avoiding the need to re-request the APIs
 * with authentication headers that are not available outside the page context.
 *
 * @param expectedProductId When provided, ignores reviews/product API calls for
 * other productIds (e.g. star ratings fetched by recommendation carousels),
 * which would otherwise overwrite the current product's captured data.
 */
export function setupRatingConsistencyCapture(
  page: Page,
  expectedProductId?: string,
): void {
  page.on("response", async (response) => {
    const url = response.url();

    // Intercept the HTML page response to extract JSON-LD rating from SSR HTML
    // before React hydration (most reliable approach for SSR-only product APIs).
    if (
      response.request().resourceType() === "document" &&
      response.status() === 200
    ) {
      try {
        const html = await response.text();

        // 1) Try JSON-LD first (reliable when present)
        const jsonLdPattern =
          /type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
        let match: RegExpExecArray | null;
        while ((match = jsonLdPattern.exec(html)) !== null) {
          try {
            const data = JSON.parse(match[1]) as Record<string, unknown>;
            const aggregateRating = data?.aggregateRating as
              | Record<string, unknown>
              | undefined;
            if (aggregateRating?.ratingValue !== undefined) {
              const parsed = parseFloat(String(aggregateRating.ratingValue));
              if (!isNaN(parsed)) {
                const existing = captureCache.get(page) ?? {};
                if (existing.productRating === undefined) {
                  captureCache.set(page, {
                    ...existing,
                    productRating: parsed,
                  });
                }
                break;
              }
            }
          } catch {
            // ignore malformed JSON-LD
          }
        }

        // 2) Fallback: extract from __NEXT_DATA__ (available for all Next.js SSR domains)
        //    The product API data is baked into the SSR HTML and is impossible to be
        //    absent (the page cannot render without it). This covers natura.com.co and
        //    other international domains where the product API is not called client-side.
        const existing = captureCache.get(page) ?? {};
        if (existing.productRating === undefined) {
          const nextDataMatch = html.match(
            /<script id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
          );
          if (nextDataMatch) {
            try {
              const nextData = JSON.parse(nextDataMatch[1]) as Record<
                string,
                unknown
              >;
              // Walk through the nested structure to find a rating value
              // associated with the current product (productId present at same level)
              const ratingValue = findRatingInNextData(nextData);
              if (ratingValue !== undefined) {
                captureCache.set(page, {
                  ...existing,
                  productRating: ratingValue,
                });
              }
            } catch {
              // ignore malformed __NEXT_DATA__
            }
          }
        }
      } catch {
        // ignore response body read errors
      }
      return;
    }

    if (
      !url.includes("/reviews/v2/details") &&
      !url.includes("/pages/v2/product/")
    ) {
      return;
    }
    try {
      const json = (await response.json()) as Record<string, unknown>;
      const existing = captureCache.get(page) ?? {};

      if (url.includes("/reviews/v2/details")) {
        // Skip media-filtered subqueries (e.g. filterMedia=pictures, used by the
        // photos filter) — their reviewsCount reflects the filtered subset, not
        // the product's total, and would overwrite the correct captured value.
        if (url.includes("filterMedia=")) {
          return;
        }

        const productId = new URL(url).searchParams.get("productId");
        if (expectedProductId && productId !== expectedProductId) {
          return;
        }

        captureCache.set(page, {
          ...existing,
          aggregatedRating: json.aggregatedRating as number | undefined,
          reviewsCount: json.reviewsCount as number | undefined,
          reviewsApiUrl: productId
            ? `${url.split("/reviews/v2/details")[0]}/reviews/v2/details?productId=${productId}`
            : url,
        });
      } else if (url.includes("/pages/v2/product/")) {
        // Only store if this is the main product page (not a recommendations list)
        if (
          typeof json.productId === "string" &&
          typeof json.rating === "number" &&
          (!expectedProductId || json.productId === expectedProductId)
        ) {
          captureCache.set(page, {
            ...existing,
            productRating: json.rating as number,
            productApiUrl: url,
          });
        }
      }
    } catch {
      // ignore parse errors (non-JSON responses, aborted requests, etc.)
    }
  });
}

/**
 * Recursively searches a __NEXT_DATA__ object for an object that has both
 * a numeric `rating` field and a string `productId` field (matching the
 * shape of the /pages/v2/product/ API response baked into SSR HTML).
 */
function findRatingInNextData(obj: unknown, depth = 0): number | undefined {
  if (depth > 10 || obj === null || typeof obj !== "object") {
    return undefined;
  }
  const record = obj as Record<string, unknown>;
  if (
    typeof record.productId === "string" &&
    typeof record.rating === "number"
  ) {
    return record.rating;
  }
  for (const value of Object.values(record)) {
    const found = findRatingInNextData(value, depth + 1);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

export async function checkRatingConsistency(page: Page): Promise<CheckResult> {
  const featureKey = "ratingConsistency";
  const feature = "Consistência da Nota (Rating)";

  try {
    let captured = captureCache.get(page);

    // The reviews API response is captured asynchronously via page.on("response"),
    // which can resolve after this check has already started reading the cache
    // (both run concurrently — see featureRunner's Promise.all). Give it a brief
    // window to land before falling back to a DOM-based reviewsCount guess.
    const pollStart = Date.now();
    while (
      captured?.aggregatedRating === undefined &&
      captured?.reviewsCount === undefined &&
      Date.now() - pollStart < 15000
    ) {
      await sleepMs(300);
      captured = captureCache.get(page);
    }

    // If the product has no reviews, consistency check is not applicable.
    // aggregatedRating === 0 with reviewsCount === 0 is the expected state.
    if (captured?.reviewsCount === 0) {
      return {
        feature,
        featureKey,
        passed: true,
        status: "warning",
        message: "Produto sem avaliações — consistência de nota não se aplica.",
      };
    }

    // aggregatedRating comes from the Konfidency reviews API (intercepted during navigation)
    const aggregatedRating = captured?.aggregatedRating;

    // productRating comes from:
    // 1. WeakMap capture of /pages/v2/product/ API (client-side sites)
    // 2. JSON-LD extracted from raw SSR HTML response (intercepted in setup)
    // 3. __NEXT_DATA__ extracted from SSR HTML (Next.js domains)
    // 4. DOM scraping as a last resort (see captureRatingFromDOM)
    const productRating: number | undefined = captured?.productRating;

    if (productRating === undefined && aggregatedRating === undefined) {
      return {
        feature,
        featureKey,
        passed: false,
        status: "error",
        message:
          "Nenhum dado de rating disponível: produto API (SSR/JSON-LD) e reviews API não retornaram valores.",
      };
    }

    if (productRating === undefined) {
      // This error now means all capture methods have failed: API interception,
      // SSR HTML parsing (JSON-LD, __NEXT_DATA__), and direct DOM scraping.
      return {
        feature,
        featureKey,
        passed: false,
        status: "error",
        message:
          "Rating do produto não encontrado. Todas as formas de captura falharam (API, JSON-LD, __NEXT_DATA__, e raspagem do DOM).",
        details: { reviewsApiUrl: captured?.reviewsApiUrl, aggregatedRating },
      };
    }

    if (aggregatedRating === undefined) {
      // API capture may have raced with navigation (reviewsCount stayed undefined
      // instead of 0); confirm via DOM before reporting a hard error.
      const domReviewCount = await getReviewCount(page);
      if (domReviewCount === 0) {
        return {
          feature,
          featureKey,
          passed: true,
          status: "warning",
          message:
            "Produto sem avaliações — consistência de nota não se aplica.",
        };
      }

      return {
        feature,
        featureKey,
        passed: false,
        status: "error",
        message:
          "Rating da API de reviews não capturado (campo 'aggregatedRating' ausente).",
        details: { productApiUrl: captured?.productApiUrl, productRating },
      };
    }

    // Rating in products API is rounded to one decimal place.
    const roundedAggregatedRating = Math.round(aggregatedRating * 10) / 10;
    const areConsistent = productRating === roundedAggregatedRating;

    const details = {
      productRating,
      aggregatedRating,
      roundedAggregatedRating,
      productApiUrl: captured?.productApiUrl,
      reviewsApiUrl: captured?.reviewsApiUrl,
    };

    if (areConsistent) {
      return {
        feature,
        featureKey,
        passed: true,
        status: "pass",
        message: `Notas consistentes: produto=${productRating} | reviews=${aggregatedRating}.`,
        details,
      };
    }

    return {
      feature,
      featureKey,
      passed: false,
      status: "fail",
      message: `Inconsistência: produto=${productRating} vs reviews arredondado=${roundedAggregatedRating} (original=${aggregatedRating}).`,
      details,
    };
  } catch (error) {
    return {
      feature,
      featureKey,
      passed: false,
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Erro desconhecido ao verificar a consistência das notas.",
    };
  }
}
