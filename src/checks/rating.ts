import { Page } from "@playwright/test";
import { CheckResult } from "../types.js";
import { SELECTORS } from "./configs/config.js";

/**
 * Check if product rating/stars are displayed
 */
export async function checkRating(page: Page): Promise<CheckResult> {
  const featureKey = "rating";
  const feature = "Nota/Rating";

  try {
    // Scroll to trigger lazy loading of rating section
    await page.evaluate(() => window.scrollBy(0, 2000));

    // Look for star rating display (increased timeout for lazy load)
    const starsLocator = page.locator(SELECTORS.rating.stars).first();
    let hasStars = await starsLocator
      .isVisible({ timeout: 8000 })
      .catch(() => false);

    if (!hasStars) {
      // Try finding SVG stars
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

    if (!hasStars) {
      // Try text-based rating scoped to rating/review containers only.
      // Using a broad "text=/\d[,.]\d/" globally causes false positives with
      // prices or volume text (e.g. "35,90" or "100ml" variants on the page).
      const ratingContainerText = await page
        .locator(
          '#reviews, [class*="rating"], [class*="stars"], [data-testid*="rating"]',
        )
        .first()
        .textContent({ timeout: 3000 })
        .catch(() => "");

      const hasRatingText = /\d[,.]\d/.test(ratingContainerText ?? "");

      if (!hasRatingText) {
        return {
          feature,
          featureKey,
          passed: false,
          status: "fail",
          message: "Indicador de nota/rating não encontrado",
        };
      }
    }

    // Try to extract rating value
    let ratingValue: number | null = null;
    let ratingText = "";

    // Look for numeric rating
    const ratingValueLocator = page.locator(SELECTORS.rating.value).first();
    ratingText =
      (await ratingValueLocator
        .textContent({ timeout: 2000 })
        .catch(() => "")) || "";

    if (!ratingText) {
      // Try extracting from any visible rating-like text
      const allText = await page
        .locator('[class*="rating"], [class*="stars"]')
        .first()
        .textContent()
        .catch(() => "");
      ratingText = allText || "";
    }

    // Parse rating value
    const ratingMatch = ratingText.match(/(\d+[,.]?\d*)/);
    if (ratingMatch) {
      ratingValue = parseFloat(ratingMatch[1].replace(",", "."));
    }

    // Count stars if visible
    const filledStars = page.locator(
      'svg[fill*="gold"], svg[fill*="yellow"], [class*="star"][class*="filled"], [class*="star-active"]',
    );
    const starCount = await filledStars.count().catch(() => 0);

    // If neither a real rating value nor stars were found, the check passed
    // only because the rating section exists in the DOM — but is empty
    // (product has no reviews yet). Return warning instead of a false pass.
    if (ratingValue === null && starCount === 0) {
      return {
        feature,
        featureKey,
        passed: true,
        status: "warning",
        message:
          "Produto sem avaliações — indicador de rating presente mas vazio",
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
