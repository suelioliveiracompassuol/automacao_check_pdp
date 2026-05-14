import { Page } from "@playwright/test";
import { CheckResult } from "../types.js";

/**
 * Count total reviews for the current product.
 * Returns 0 if no reviews found.
 */
async function getReviewCount(page: Page): Promise<number> {
  return page
    .evaluate(() => {
      // Check go-to-reviews button text (e.g. "(350) avaliações")
      const goToBtn = document.querySelector(
        '[data-testid="go-to-reviews-button"]',
      );
      if (goToBtn) {
        const match = goToBtn.textContent?.match(/\(?\s*(\d+)\s*\)?/);
        if (match) return parseInt(match[1]);
      }
      // Fallback: count visible review cards
      const reviews = document.getElementById("reviews");
      if (!reviews) return 0;
      return reviews.querySelectorAll('div[role="group"]').length;
    })
    .catch(() => 0);
}

/**
 * Check if reviews filter button is present in the reviews section.
 *
 * Structural detection:
 * - Looks for the filter icon (natds-icons-outlined-action-filter) inside #reviews
 * - The filter button enables filtering reviews by media (photos/videos)
 */
export async function checkReviewFilter(page: Page): Promise<CheckResult> {
  const featureKey = "reviewFilter";
  const feature = "Filtro de avaliações";

  try {
    const reviewsContainer = page.locator("#reviews");
    const hasReviews = await reviewsContainer
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!hasReviews) {
      return {
        feature,
        featureKey,
        passed: false,
        status: "fail",
        message: "Container #reviews não encontrado",
      };
    }

    // If product has no reviews, filter/sort/photos won't appear — that's expected
    const reviewCount = await getReviewCount(page);
    if (reviewCount === 0) {
      return {
        feature,
        featureKey,
        passed: true,
        status: "warning",
        message: "Produto sem avaliações — filtro não se aplica",
      };
    }

    // Look for filter icon inside reviews
    const filterIcon = reviewsContainer
      .locator('i[class*="natds-icons-outlined-action-filter"]')
      .first();

    const hasFilter = await filterIcon
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasFilter) {
      return {
        feature,
        featureKey,
        passed: true,
        status: "pass",
        message: "Botão de filtro de avaliações presente",
      };
    }

    return {
      feature,
      featureKey,
      passed: false,
      status: "fail",
      message: "Botão de filtro não encontrado na seção de avaliações",
    };
  } catch (error) {
    return {
      feature,
      featureKey,
      passed: false,
      status: "error",
      message: `Erro ao verificar filtro: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Check if reviews sort dropdown is present in the reviews section.
 *
 * Structural detection:
 * - Looks for the sort dropdown arrow icon (natds-icons-outlined-navigation-arrowbottom) inside #reviews
 * - Or a button with aria-label for sort functionality
 */
export async function checkReviewSort(page: Page): Promise<CheckResult> {
  const featureKey = "reviewSort";
  const feature = "Ordenação de avaliações";

  try {
    const reviewsContainer = page.locator("#reviews");
    const hasReviews = await reviewsContainer
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!hasReviews) {
      return {
        feature,
        featureKey,
        passed: false,
        status: "fail",
        message: "Container #reviews não encontrado",
      };
    }

    // If product has no reviews, sort dropdown won't appear — that's expected
    const reviewCount = await getReviewCount(page);
    if (reviewCount === 0) {
      return {
        feature,
        featureKey,
        passed: true,
        status: "warning",
        message: "Produto sem avaliações — ordenação não se aplica",
      };
    }

    // Look for sort dropdown arrow icon inside reviews
    const sortIcon = reviewsContainer
      .locator('i[class*="natds-icons-outlined-navigation-arrowbottom"]')
      .first();

    const hasSortIcon = await sortIcon
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasSortIcon) {
      return {
        feature,
        featureKey,
        passed: true,
        status: "pass",
        message: "Dropdown de ordenação de avaliações presente",
      };
    }

    // Fallback: look for button with aria-label for sorting
    const sortButton = reviewsContainer
      .locator("button[aria-label]")
      .filter({
        has: page.locator('i[class*="natds-icons"]'),
      })
      .first();

    const hasSortButton = await sortButton
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (hasSortButton) {
      return {
        feature,
        featureKey,
        passed: true,
        status: "pass",
        message: "Botão de ordenação de avaliações presente",
      };
    }

    return {
      feature,
      featureKey,
      passed: false,
      status: "fail",
      message: "Dropdown de ordenação não encontrado na seção de avaliações",
    };
  } catch (error) {
    return {
      feature,
      featureKey,
      passed: false,
      status: "error",
      message: `Erro ao verificar ordenação: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Check if review photos feature is active.
 *
 * Structural detection:
 * - Checks for review card images (img with h-32 w-32 classes) inside #reviews
 * - If no review photos exist in current reviews, reports as warning (feature may be enabled but no photos uploaded)
 * - The filter icon presence confirms the photos/media feature is enabled
 */
export async function checkReviewPhotos(page: Page): Promise<CheckResult> {
  const featureKey = "reviewPhotos";
  const feature = "Fotos nas avaliações";

  try {
    const reviewsContainer = page.locator("#reviews");
    const hasReviews = await reviewsContainer
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!hasReviews) {
      return {
        feature,
        featureKey,
        passed: false,
        status: "fail",
        message: "Container #reviews não encontrado",
      };
    }

    // If product has no reviews, photos won't appear — that's expected
    const reviewCount = await getReviewCount(page);
    if (reviewCount === 0) {
      return {
        feature,
        featureKey,
        passed: true,
        status: "warning",
        message: "Produto sem avaliações — fotos não se aplicam",
      };
    }

    // Check for review card images (h-32 w-32 thumbnails inside review cards)
    const reviewPhotos = await page.evaluate(() => {
      const reviews = document.getElementById("reviews");
      if (!reviews) return { count: 0, hasFilter: false };

      // Review card photos have specific size classes
      const imgs = reviews.querySelectorAll(
        'img[class*="h-32"][class*="w-32"], img[class*="rounded-micro"]',
      );

      // Also check if filter button exists (confirms media/photos feature is enabled)
      const filterIcon = reviews.querySelector(
        'i[class*="natds-icons-outlined-action-filter"]',
      );

      return {
        count: imgs.length,
        hasFilter: !!filterIcon,
      };
    });

    if (reviewPhotos.count > 0) {
      return {
        feature,
        featureKey,
        passed: true,
        status: "pass",
        message: `${reviewPhotos.count} foto(s) encontrada(s) nas avaliações`,
        details: { photoCount: reviewPhotos.count },
      };
    }

    // No photos in current reviews, but check if feature is enabled via filter
    if (reviewPhotos.hasFilter) {
      return {
        feature,
        featureKey,
        passed: true,
        status: "warning",
        message:
          "Feature de fotos habilitada (filtro de mídia presente), mas nenhuma avaliação com foto na página atual",
        details: { photoCount: 0, filterPresent: true },
      };
    }

    return {
      feature,
      featureKey,
      passed: false,
      status: "fail",
      message:
        "Feature de fotos nas avaliações não detectada (sem fotos e sem filtro de mídia)",
    };
  } catch (error) {
    return {
      feature,
      featureKey,
      passed: false,
      status: "error",
      message: `Erro ao verificar fotos: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Check if review recommendation percentage is displayed.
 *
 * Structural detection:
 * - Looks for the green chip (.bg-success) with percentage text
 * - The recommendation shows "X% recomendam" near the review summary area
 * - Requires product to have enough reviews (min_count: 4) and percentage > 0
 */
export async function checkReviewRecommendation(
  page: Page,
): Promise<CheckResult> {
  const featureKey = "reviewRecommendation";
  const feature = "Recomendação de avaliações";

  try {
    // Recommendation chip can be in the product header area (near go-to-reviews button)
    // or inside the #reviews section
    const recommendation = await page.evaluate(() => {
      // Look for bg-success chip anywhere on the page (it's part of reviews summary)
      const chip = document.querySelector(".bg-success");
      if (!chip) return null;

      // The chip contains the percentage text
      const chipText = chip.textContent?.trim() || "";
      const percentMatch = chipText.match(/(\d+)%/);
      const percentage = percentMatch ? parseInt(percentMatch[1]) : 0;

      // Get the sibling recommendation label text
      const parent = chip.closest("div[class*='flex'][class*='items-center']");
      const siblingText = parent
        ? Array.from(parent.children)
            .filter((c) => c !== chip)
            .map((c) => c.textContent?.trim())
            .join(" ")
        : "";

      return {
        percentage,
        labelText: siblingText.substring(0, 60),
      };
    });

    if (recommendation && recommendation.percentage > 0) {
      return {
        feature,
        featureKey,
        passed: true,
        status: "pass",
        message: `${recommendation.percentage}% de recomendação exibido`,
        details: {
          percentage: recommendation.percentage,
          text: recommendation.labelText,
        },
      };
    }

    // Check if reviews exist but recommendation doesn't appear
    // (might not meet min_count threshold or percentage is 0)
    const reviewsExist = await page
      .locator("#reviews")
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (reviewsExist) {
      // Check total review count from the summary area (not just visible cards)
      // The summary shows "N avaliações" / "N opiniones" which is the total count
      const reviewCount = await page.evaluate(() => {
        const reviews = document.getElementById("reviews");
        if (!reviews) return 0;

        // Look for the count in the go-to-reviews button text (e.g. "(350) avaliações")
        const goToBtn = document.querySelector(
          '[data-testid="go-to-reviews-button"]',
        );
        if (goToBtn) {
          const match = goToBtn.textContent?.match(/\(?\s*(\d+)\s*\)?/);
          if (match) return parseInt(match[1]);
        }

        // Fallback: look for count in reviews summary area
        const summaryText =
          reviews.querySelector(".flex.flex-col.gap-1")?.textContent || "";
        const countMatch = summaryText.match(/(\d+)\s*(avalia|opini|rese)/i);
        if (countMatch) return parseInt(countMatch[1]);

        // Last fallback: count visible cards
        return reviews.querySelectorAll('div[role="group"]').length;
      });

      if (reviewCount <= 4) {
        return {
          feature,
          featureKey,
          passed: true,
          status: "warning",
          message: `Recomendação não exibida (${reviewCount} avaliação(ões), mínimo necessário: >4)`,
          details: { reviewCount, minRequired: 4 },
        };
      }
    }

    return {
      feature,
      featureKey,
      passed: false,
      status: "fail",
      message: "Chip de recomendação não encontrado",
    };
  } catch (error) {
    return {
      feature,
      featureKey,
      passed: false,
      status: "error",
      message: `Erro ao verificar recomendação: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
