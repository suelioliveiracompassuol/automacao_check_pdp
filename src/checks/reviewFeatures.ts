import { Page } from "@playwright/test";
import { CheckResult } from "../types.js";
import {
  getReviewCount,
  getGoToReviewsButtonReviewCount,
  pollUntilVisible,
} from "../utils.js";

const REVIEWS_CONTAINER_SELECTOR = '[data-testid="reviews-component"], #reviews';
const REVIEWS_FILTER_ICON_SELECTOR =
  '#reviews [data-testid="reviews-filter"], #reviews i[class*="natds-icons-outlined-action-filter"]';

/**
 * #reviews may fail to become "visible" within the wait timeout even when the
 * product genuinely has reviews (e.g. long review lists take longer to
 * hydrate). The go-to-reviews-button lives outside #reviews and always
 * reflects the real review count, so we use it to tell a true zero-review
 * product apart from a container that simply didn't render in time —
 * the latter is a real failure, not a "not applicable" warning.
 */
async function resolveMissingReviewsContainer(
  page: Page,
  feature: string,
  featureKey: string,
  notApplicableMessage: string,
): Promise<CheckResult> {
  const btnReviewCount = await getGoToReviewsButtonReviewCount(page);

  if (btnReviewCount === null) {
    return {
      feature,
      featureKey,
      passed: false,
      status: "fail",
      message: "Container #reviews não encontrado",
    };
  }

  if (btnReviewCount === 0) {
    return {
      feature,
      featureKey,
      passed: true,
      status: "warning",
      message: notApplicableMessage,
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
    const hasReviews = await pollUntilVisible(page, REVIEWS_CONTAINER_SELECTOR, 20000);

    if (!hasReviews) {
      return resolveMissingReviewsContainer(
        page,
        feature,
        featureKey,
        "Produto sem avaliações — filtro não se aplica",
      );
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
    const hasFilter = await pollUntilVisible(page, REVIEWS_FILTER_ICON_SELECTOR);

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
    const hasReviews = await pollUntilVisible(page, REVIEWS_CONTAINER_SELECTOR, 20000);

    if (!hasReviews) {
      return resolveMissingReviewsContainer(
        page,
        feature,
        featureKey,
        "Produto sem avaliações — ordenação não se aplica",
      );
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
    const hasSortIcon = await pollUntilVisible(
      page,
      '#reviews [data-testid="reviews-sort"], #reviews i[class*="natds-icons-outlined-navigation-arrowbottom"]',
    );

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
    const hasSortButton = await pollUntilVisible(
      page,
      '#reviews button[aria-label] i[class*="natds-icons"]',
      3000,
    );

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
    const hasReviews = await pollUntilVisible(page, REVIEWS_CONTAINER_SELECTOR, 20000);

    if (!hasReviews) {
      return resolveMissingReviewsContainer(
        page,
        feature,
        featureKey,
        "Produto sem avaliações — fotos não se aplicam",
      );
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
    const imgsCount = await page
      .locator(
        '#reviews img[class*="h-32"][class*="w-32"], #reviews img[class*="rounded-micro"]',
      )
      .count()
      .catch(() => 0);
    const hasFilter = await pollUntilVisible(page, REVIEWS_FILTER_ICON_SELECTOR);

    const reviewPhotos = {
      count: imgsCount,
      hasFilter: hasFilter,
    };

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
    // Wait for the chip to appear — reviews load async so querySelector fires too early.
    // The chip uses .bg-success (NCF SSR / Tailwind) or aria-label with "recomendam".
    const chipVisible = await pollUntilVisible(
      page,
      ".bg-success",
      15000,
    );
    const chipLocator = page
      .locator(".bg-success")
      .filter({ hasText: /\d+%/ })
      .first();

    if (chipVisible) {
      const chipText = (await chipLocator.textContent().catch(() => "")) ?? "";
      const percentMatch = chipText.match(/(\d+)%/);
      const percentage = percentMatch ? parseInt(percentMatch[1]) : 0;

      const labelEl = chipLocator.locator("xpath=..");
      const labelText = await labelEl.textContent().catch(() => "");

      if (percentage > 0) {
        return {
          feature,
          featureKey,
          passed: true,
          status: "pass",
          message: `${percentage}% de recomendação exibido`,
          details: {
            percentage,
            text: labelText?.trim().substring(0, 60),
          },
        };
      }
    }

    // Fallback: aria-label approach (parent div wraps chip + label text)
    const ariaChip = page
      .locator("[aria-label*='recomendam'], [aria-label*='recomiendan'], [aria-label*='recomiendan']")
      .first();
    const ariaVisible = await ariaChip
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    if (ariaVisible) {
      const ariaLabel = await ariaChip.getAttribute("aria-label").catch(() => "");
      const percentMatch = ariaLabel?.match(/(\d+)%/);
      const percentage = percentMatch ? parseInt(percentMatch[1]) : 0;
      if (percentage > 0) {
        return {
          feature,
          featureKey,
          passed: true,
          status: "pass",
          message: `${percentage}% de recomendação exibido`,
          details: { percentage, text: ariaLabel?.substring(0, 60) },
        };
      }
    }

    // Check if reviews exist but recommendation doesn't appear
    // (might not meet min_count threshold or percentage is 0)
    const reviewsExist = await page
      .locator('[data-testid="reviews-component"], #reviews')
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (reviewsExist) {
      // Check total review count from the summary area (not just visible cards)
      // The summary shows "N avaliações" / "N opiniones" which is the total count
      const reviewCount = await getReviewCount(page);

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
