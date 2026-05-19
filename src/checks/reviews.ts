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
    // Scroll to bottom to ensure reviews lazy-loading is triggered
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Wait for a short time using a more robust method than waitForTimeout
    await page.evaluate(
      () => new Promise((resolve) => setTimeout(resolve, 600)),
    );

    // Primary: look for #reviews container
    const reviewsContainer = page.locator("#reviews");
    const hasReviews = await reviewsContainer
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    if (!hasReviews) {
      // Fallback: check for go-to-reviews-button in product header
      // Use count() instead of isVisible() — the button may exist in the DOM
      // but have no visible dimensions when the product has 0 reviews
      const goToReviewsBtnCount = await page
        .locator('[data-testid="go-to-reviews-button"]')
        .count()
        .catch(() => 0);

      if (goToReviewsBtnCount === 0) {
        // Check if it's because there are 0 reviews
        try {
          const reviewsApiUrl = await page.evaluate(() => {
            const entries = performance.getEntriesByType("resource");
            const reviewEntry = entries.find((e) =>
              e.name.includes("/reviews/v2/details"),
            );
            return reviewEntry ? reviewEntry.name : null;
          });

          if (reviewsApiUrl) {
            const reviewsData = await page.evaluate(async (url) => {
              try {
                const res = await fetch(url);
                return await res.json();
              } catch {
                return null;
              }
            }, reviewsApiUrl);

            if (reviewsData && reviewsData.reviewsCount === 0) {
              return {
                feature,
                featureKey,
                passed: true,
                status: "warning",
                message:
                  "Seção de avaliações não encontrada, mas a API indica 0 avaliações (comportamento esperado)",
              };
            }
          }
        } catch {
          // Ignore errors and fallback to fail
        }

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
          "Botão go-to-reviews presente mas container #reviews não carregou — produto sem avaliações",
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
