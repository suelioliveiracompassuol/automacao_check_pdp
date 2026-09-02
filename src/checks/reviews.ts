import { Page } from "@playwright/test";
import { CheckResult } from "../types.js";
import {
  getReviewCount,
  getGoToReviewsButtonReviewCount,
  pollUntilVisible,
} from "../utils.js";

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
    // Primary: look for #reviews container or data-testid
    const reviewsContainer = page
      .locator('[data-testid="reviews-component"], #reviews')
      .first();

    // pollUntilVisible (not locator.waitFor) stays reliable when ~15 other
    // checks run concurrently against this same page (see featureRunner).
    const hasReviews = await pollUntilVisible(
      page,
      '[data-testid="reviews-component"], #reviews',
      20000,
    );

    if (!hasReviews) {
      // Fallback: the go-to-reviews-button lives outside #reviews and always
      // reflects the real review count, even when the container itself
      // failed to render/hydrate in time.
      const btnReviewCount = await getGoToReviewsButtonReviewCount(page);

      if (btnReviewCount === null) {
        return {
          feature,
          featureKey,
          passed: false,
          status: "fail",
          message:
            "Seção de avaliações não encontrada (#reviews e go-to-reviews-button ausentes)",
        };
      }

      if (btnReviewCount === 0) {
        return {
          feature,
          featureKey,
          passed: true,
          status: "warning",
          message:
            "Botão go-to-reviews presente mas container #reviews não carregou — produto sem avaliações",
        };
      }

      return {
        feature,
        featureKey,
        passed: false,
        status: "fail",
        message: `Container #reviews não carregou a tempo (produto tem ${btnReviewCount} avaliação(ões))`,
      };
    }

    // Structural check: rating icons plus the real review count (the
    // "review-card" selector below never matches production markup, so the
    // total is read from getReviewCount instead, same as the other review checks)
    const cardsCount = await getReviewCount(page);
    const hasRating = await page
      .locator(
        '[data-testid="review-stars"], [data-testid="star-icon"], i[class*="natds-icons-filled-action-rating"]',
      )
      .first()
      .isVisible()
      .catch(() => false);

    const gtmId = await reviewsContainer
      .getAttribute("data-gtm-reviews")
      .catch(() => null);

    const reviewData = {
      cards: cardsCount,
      hasRating: hasRating,
      gtmId,
    };

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
