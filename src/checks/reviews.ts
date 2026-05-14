import { Page } from "@playwright/test";
import { CheckResult } from "../types.js";

/**
 * Check if Reviews section is present and has content.
 *
 * Structural detection (whitelabel-safe):
 * - Primary: div#reviews with data-gtm-reviews attribute
 * - Review cards: div[role="group"] with bg-[#EEEEEE] class inside #reviews
 * - Rating: natds-icons-filled-action-rating icons inside #reviews
 * - go-to-reviews-button: data-testid="go-to-reviews-button" in product header
 */
export async function checkReviews(page: Page): Promise<CheckResult> {
  const featureKey = "reviews";
  const feature = "Avaliações do produto";

  try {
    // Scroll down to trigger lazy loading of reviews section
    await page.evaluate(() => window.scrollBy(0, 2000));
    await page.waitForTimeout(1500); // eslint-disable-line playwright/no-wait-for-timeout

    // Primary: look for #reviews container
    const reviewsContainer = page.locator("#reviews");
    const hasReviews = await reviewsContainer
      .isVisible({ timeout: 8000 })
      .catch(() => false);

    if (!hasReviews) {
      // Fallback: check for go-to-reviews-button in product header
      const goToReviewsBtn = page
        .locator('[data-testid="go-to-reviews-button"]')
        .first();
      const hasBtnVisible = await goToReviewsBtn
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      if (!hasBtnVisible) {
        return {
          feature,
          featureKey,
          passed: false,
          status: "fail",
          message:
            "Seção de avaliações não encontrada (#reviews e go-to-reviews-button ausentes)",
        };
      }

      return {
        feature,
        featureKey,
        passed: true,
        status: "warning",
        message:
          "Botão go-to-reviews presente mas container #reviews não carregou (lazy load)",
      };
    }

    // Structural check: count review cards and rating icons
    const reviewData = await page.evaluate(() => {
      const reviews = document.getElementById("reviews");
      if (!reviews) return { cards: 0, hasRating: false, gtmId: null };

      const cards = reviews.querySelectorAll('div[role="group"]');
      const ratingIcons = reviews.querySelectorAll(
        'i[class*="natds-icons-filled-action-rating"]',
      );
      const gtmId = reviews.getAttribute("data-gtm-reviews");

      return {
        cards: cards.length,
        hasRating: ratingIcons.length > 0,
        gtmId,
      };
    });

    return {
      feature,
      featureKey,
      passed: true,
      status: "pass",
      message: reviewData.hasRating
        ? `Seção de avaliações presente${reviewData.cards > 0 ? ` com ${reviewData.cards} reviews` : " (sem reviews ainda)"}`
        : "Seção de avaliações presente",
      details: {
        hasRating: reviewData.hasRating,
        reviewCount: reviewData.cards,
        gtmId: reviewData.gtmId,
      },
    };
  } catch (error) {
    return {
      feature,
      featureKey,
      passed: false,
      status: "error",
      message: `Erro ao verificar avaliações: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
