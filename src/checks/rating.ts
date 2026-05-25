import { Page } from "@playwright/test";
import { CheckResult } from "../types.js";
import { SELECTORS } from "./configs/config.js";
import { captureCache } from "./ratingConsistency.js";

/**
 * Check if product rating/stars are displayed
 */
export async function checkRating(page: Page): Promise<CheckResult> {
  const featureKey = "rating";
  const feature = "Nota/Rating";

  try {
    // Get cached data for supplementary info (used later for warning/fail logic)
    const cachedData = captureCache.get(page);
    const cachedRating = cachedData?.productRating;

    // Always verify via UI — the consistency check handles API/JSON-LD data;
    // this check confirms the rating is actually visible on screen.
    // Scroll to trigger lazy loading of rating section
    await page.evaluate(() => window.scrollBy(0, 2000));

    // ── Step 1: extract rating text from DOM (always, unconditionally) ──────
    let ratingText = "";

    // Most-specific selector first
    ratingText =
      (await page
        .locator(SELECTORS.rating.value)
        .first()
        .textContent({ timeout: 3000 })
        .catch(() => "")) || "";

    if (!ratingText) {
      // Broader rating/stars containers
      ratingText =
        (await page
          .locator(
            '#reviews, [class*="rating"], [class*="stars"], [data-testid*="rating"]',
          )
          .first()
          .textContent({ timeout: 5000 })
          .catch(() => "")) || "";
    }

    // ── Step 2: parse a numeric rating value (must have decimal → avoids
    //    matching review counts like "58") ───────────────────────────────────
    let ratingValue: number | null = null;
    const ratingMatch = ratingText.match(/(\d+[,.]\d+)/);
    if (ratingMatch) {
      const parsed = parseFloat(ratingMatch[1].replace(",", "."));
      // Sanity check: product ratings are 0–5
      if (parsed <= 5) {
        ratingValue = parsed;
      }
    }

    // ── Step 3: check for visual star indicators ────────────────────────────
    const timeoutForStars = ratingValue !== null ? 2000 : 8000;
    let hasStars = await page
      .locator(SELECTORS.rating.stars)
      .first()
      .isVisible({ timeout: timeoutForStars })
      .catch(() => false);

    if (!hasStars) {
      const svgStars = page.locator("svg").filter({
        has: page.locator(
          'path[d*="star"], path[fill*="gold"], path[fill*="yellow"]',
        ),
      });
      hasStars = await svgStars
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false);
    }

    const starCount = await page
      .locator(
        'svg[fill*="gold"], svg[fill*="yellow"], [class*="star"][class*="filled"], [class*="star-active"]',
      )
      .count()
      .catch(() => 0);

    // ── Step 4: determine if anything rating-related is visible in the DOM ──
    const foundInDom = ratingValue !== null || hasStars || starCount > 0;

    if (!foundInDom) {
      // Nothing found in DOM — is this a genuine absence or a product with no reviews?
      const reviewsCount = cachedData?.reviewsCount;

      if (typeof cachedRating === "number") {
        return {
          feature,
          featureKey,
          passed: true,
          status: "warning",
          message: `Rating (${cachedRating}) encontrado nos dados da página, mas não visível na interface.`,
          details: { ratingValue: cachedRating, source: "cache", domVisible: false },
        };
      }

      if (reviewsCount && reviewsCount > 0) {
        return {
          feature,
          featureKey,
          passed: false,
          status: "fail",
          message: `O produto tem ${reviewsCount} reviews, mas o indicador de rating não foi encontrado.`,
          details: { ratingValue, starCount, ratingText: ratingText.trim(), reviewsCount },
        };
      }

      return {
        feature,
        featureKey,
        passed: true,
        status: "warning",
        message: "Produto sem avaliações — indicador de rating presente mas vazio",
        details: { ratingValue, starCount, ratingText: ratingText.trim() },
      };
    }

    return {
      feature,
      featureKey,
      passed: true,
      status: "pass",
      message: ratingValue
        ? `Nota ${ratingValue.toFixed(1)} exibida`
        : `Indicador de rating presente${starCount > 0 ? ` (${starCount} estrelas)` : ""}`,
      details: {
        ratingValue,
        starCount,
        ratingText: ratingText.trim(),
        source: "dom",
      },
    };
  } catch (error) {
    return {
      feature,
      featureKey,
      passed: false,
      status: "error",
      message: `Erro ao verificar rating: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
