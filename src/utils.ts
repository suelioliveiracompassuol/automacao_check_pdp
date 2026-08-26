import { Page } from "@playwright/test";

/**
 * Formats a boolean or unknown flag value into a visual emoji for logging.
 */
export function formatFlagLogValue(value: unknown): string {
  if (value === true) {
    return "✅";
  }
  if (value === false) {
    return "❌";
  }
  return String(value);
}

/**
 * Safely parses a JSON string, or returns the original object if it's already parsed.
 * Returns null if parsing fails.
 */
export function safeJsonParse<T = unknown>(data: unknown): T | null {
  if (typeof data !== "string") {
    return (data as T) ?? null;
  }
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

/**
 * Carries forward 'consultoria' and 'marca' query parameters from the current URL
 * to a target URL. Required for Social Commerce navigation.
 */
export function appendSocialCommerceParams(
  targetUrl: string,
  currentUrl: string,
): string {
  try {
    const currentPageParams = new URL(currentUrl).searchParams;
    const consultoria = currentPageParams.get("consultoria");
    const marca = currentPageParams.get("marca");

    if (consultoria || marca) {
      const productUrl = new URL(targetUrl);
      if (consultoria) {
        productUrl.searchParams.set("consultoria", consultoria);
      }
      if (marca) {
        productUrl.searchParams.set("marca", marca);
      }
      return productUrl.href;
    }
  } catch {
    // Ignore invalid URLs
  }
  return targetUrl;
}

/**
 * Utility: access nested object value by dot-path ("data.product.id")
 */
export function getNestedValue(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc !== null && acc !== undefined && typeof acc === "object") {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Fixed delay without `page.waitForTimeout` (forbidden by eslint-plugin-playwright).
 */
export function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Count total reviews for the current product.
 * Returns 0 if no reviews found.
 */
export async function getReviewCount(page: Page): Promise<number> {
  return page
    .evaluate(() => {
      const reviews = document.getElementById("reviews");
      if (!reviews) {
        return 0;
      }

      // Look for the count in the go-to-reviews button text (e.g. "(350) avaliações")
      const goToBtn = document.querySelector(
        '[data-testid="go-to-reviews-button"]',
      );
      if (goToBtn) {
        const match = goToBtn.textContent?.match(/\(?\s*(\d+)\s*\)?/);
        if (match) {
          return parseInt(match[1], 10);
        }
      }

      // Fallback: look for count in reviews summary area
      const summaryText =
        reviews.querySelector(".flex.flex-col.gap-1")?.textContent || "";
      const countMatch = summaryText.match(/(\d+)\s*(avalia|opini|rese)/i);
      if (countMatch) {
        return parseInt(countMatch[1], 10);
      }

      // Last fallback: count visible cards
      return reviews.querySelectorAll('div[role="group"]').length;
    })
    .catch(() => 0);
}
