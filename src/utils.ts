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
 * Polls a CSS selector via page.evaluate() until a matching element is
 * genuinely rendered (non-empty box, not display:none/visibility:hidden).
 *
 * All feature checks run concurrently against the same page (see
 * featureRunner's Promise.all), which can starve Playwright's own
 * locator.waitFor({state:"visible"}) polling (each attempt is a separate CDP
 * round-trip queued behind other checks' commands). A single evaluate() call
 * per attempt is atomic and far more reliable under that load.
 */
export async function pollUntilVisible(
  page: Page,
  selector: string,
  timeoutMs = 8000,
  intervalMs = 300,
): Promise<boolean> {
  const start = Date.now();
  do {
    const visible = await page
      .evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) {
          return false;
        }
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none"
        );
      }, selector)
      .catch(() => false);
    if (visible) {
      return true;
    }
    await sleepMs(intervalMs);
  } while (Date.now() - start < timeoutMs);
  return false;
}

/**
 * Count total reviews for the current product. Polls because the go-to-reviews
 * button/summary render a Skeleton (.animate-pulse) placeholder with empty text
 * for several seconds after #reviews mounts, before the real count loads —
 * reading it too early looks identical to a genuine "0 reviews" product.
 * Returns 0 if no reviews are found (or the timeout elapses while loading).
 */
export async function getReviewCount(
  page: Page,
  timeoutMs = 15000,
  intervalMs = 300,
): Promise<number> {
  const start = Date.now();
  do {
    const result = await page
      .evaluate(() => {
        const reviews = document.getElementById("reviews");
        if (!reviews) {
          return { ready: true, count: 0 };
        }

        // Look for the count in the go-to-reviews button text (e.g. "(350) avaliações")
        const goToBtn = document.querySelector(
          '[data-testid="go-to-reviews-button"]',
        );
        if (goToBtn) {
          if (goToBtn.querySelector(".animate-pulse")) {
            return { ready: false, count: 0 };
          }
          const match = goToBtn.textContent?.match(/\(?\s*(\d+)\s*\)?/);
          if (match) {
            return { ready: true, count: parseInt(match[1], 10) };
          }
        }

        // Fallback: look for count in reviews summary area
        const summaryText =
          reviews.querySelector(".flex.flex-col.gap-1")?.textContent || "";
        const countMatch = summaryText.match(/(\d+)\s*(avalia|opini|rese)/i);
        if (countMatch) {
          return { ready: true, count: parseInt(countMatch[1], 10) };
        }

        // Last fallback: count review cards (real markup uses role="group";
        // data-testid="review-card" kept for backward compatibility with mocks/tests)
        return {
          ready: true,
          count: reviews.querySelectorAll(
            'div[role="group"], [data-testid="review-card"]',
          ).length,
        };
      })
      .catch(() => ({ ready: true, count: 0 }));

    if (result.ready) {
      return result.count;
    }
    await sleepMs(intervalMs);
  } while (Date.now() - start < timeoutMs);
  return 0;
}

/**
 * Reads the review count directly from the go-to-reviews-button, which lives
 * outside #reviews (near the product title/price) and doesn't depend on the
 * #reviews container having rendered/hydrated yet. Polls past the Skeleton
 * loading placeholder (see getReviewCount) before parsing the text.
 * Returns null if the button itself isn't present in the DOM.
 */
export async function getGoToReviewsButtonReviewCount(
  page: Page,
  timeoutMs = 15000,
  intervalMs = 300,
): Promise<number | null> {
  const start = Date.now();
  do {
    const result = await page
      .evaluate(() => {
        const btn = document.querySelector(
          '[data-testid="go-to-reviews-button"]',
        );
        if (!btn) {
          return { found: false, ready: true, count: 0 };
        }
        if (btn.querySelector(".animate-pulse")) {
          return { found: true, ready: false, count: 0 };
        }
        // Button text is "(N) avaliações" when reviews exist, or a plain CTA
        // label like "avalie o produto" (no parentheses) when there are none.
        const match = btn.textContent?.match(/\(\s*(\d+)\s*\)/);
        return { found: true, ready: true, count: match ? parseInt(match[1], 10) : 0 };
      })
      .catch(() => ({ found: false, ready: true, count: 0 }));

    if (!result.found) {
      return null;
    }
    if (result.ready) {
      return result.count;
    }
    await sleepMs(intervalMs);
  } while (Date.now() - start < timeoutMs);
  return 0;
}
