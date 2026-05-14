/**
 * Shared feature-runner utilities
 *
 * Centralises everything that was duplicated between index.ts and explore.ts:
 *   - FEATURE_CHECKERS map
 *   - REVIEW_RATING_KEYS set
 *   - getStatusIcon()
 *   - logFeaturesGrouped()
 *   - dismissCookieBanner()
 *   - scrollAndLoadContent()
 */

import { Page } from "@playwright/test";
import { CheckResult } from "../types.js";
import { TIMING, SELECTORS } from "./configs/config.js";
import {
  checkReviews,
  checkAiReviewSummary,
  checkReviewFilter,
  checkReviewSort,
  checkReviewPhotos,
  checkReviewRecommendation,
  checkBrandShowcase,
  checkRecommendationShowcase,
  checkShopTheSet,
  checkImages,
  checkPricing,
  checkShipping,
  checkRating,
} from "./index.js";

// ---------------------------------------------------------------------------
// Feature checker map — single source of truth
// ---------------------------------------------------------------------------

export const FEATURE_CHECKERS: Record<
  string,
  (page: Page) => Promise<CheckResult>
> = {
  reviews: checkReviews,
  aiReviewSummary: checkAiReviewSummary,
  reviewFilter: checkReviewFilter,
  reviewSort: checkReviewSort,
  reviewPhotos: checkReviewPhotos,
  reviewRecommendation: checkReviewRecommendation,
  brandShowcase: checkBrandShowcase,
  recommendationShowcase: checkRecommendationShowcase,
  shopTheSet: checkShopTheSet,
  images: checkImages,
  pricing: checkPricing,
  shipping: checkShipping,
  rating: checkRating,
};

// ---------------------------------------------------------------------------
// Grouping metadata
// ---------------------------------------------------------------------------

export const REVIEW_RATING_KEYS = new Set([
  "reviews",
  "reviewFilter",
  "reviewSort",
  "reviewPhotos",
  "reviewRecommendation",
  "aiReviewSummary",
  "rating",
]);

// ---------------------------------------------------------------------------
// Console helpers
// ---------------------------------------------------------------------------

export function getStatusIcon(result: CheckResult): string {
  if (result.status === "warning") return "⚠️";
  if (result.status === "disabled") return "🚫";
  if (result.status === "na") return "⬜";
  if (result.status === "error") return "⚠️";
  return result.passed ? "✅" : "❌";
}

export function logFeaturesGrouped(
  features: CheckResult[],
  indent = "   ",
): void {
  const reviewFeatures = features.filter((f) =>
    REVIEW_RATING_KEYS.has(f.featureKey),
  );
  const endpointFeatures = features.filter(
    (f) =>
      f.featureKey.startsWith("endpoint_") ||
      f.featureKey === "endpointResponse",
  );
  const otherFeatures = features.filter(
    (f) =>
      !REVIEW_RATING_KEYS.has(f.featureKey) &&
      !f.featureKey.startsWith("endpoint_") &&
      f.featureKey !== "endpointResponse",
  );

  if (reviewFeatures.length > 0) {
    const passCount = reviewFeatures.filter(
      (f) => f.passed || f.status === "warning" || f.status === "disabled",
    ).length;
    const failCount = reviewFeatures.filter(
      (f) =>
        !f.passed &&
        f.status !== "na" &&
        f.status !== "warning" &&
        f.status !== "disabled",
    ).length;
    const total = reviewFeatures.filter((f) => f.status !== "na").length;
    const groupIcon = failCount > 0 ? "❌" : "✅";
    console.log(
      `${indent}${groupIcon} ⭐ Avaliações & Rating (${passCount}/${total} ok)`,
    );
    for (const f of reviewFeatures) {
      console.log(`${indent}   ${getStatusIcon(f)} ${f.feature}: ${f.message}`);
    }
  }

  if (endpointFeatures.length > 0) {
    const passCount = endpointFeatures.filter(
      (f) => f.passed || f.status === "warning" || f.status === "disabled",
    ).length;
    const failCount = endpointFeatures.filter(
      (f) => !f.passed && f.status !== "na" && f.status !== "disabled",
    ).length;
    const total = endpointFeatures.filter((f) => f.status !== "na").length;
    const groupIcon = failCount > 0 ? "❌" : "✅";
    console.log(
      `${indent}${groupIcon} 🌐 Endpoints de API (${passCount}/${total} ok)`,
    );
    for (const f of endpointFeatures) {
      console.log(`${indent}   ${getStatusIcon(f)} ${f.feature}: ${f.message}`);
    }
  }

  for (const f of otherFeatures) {
    console.log(`${indent}${getStatusIcon(f)} ${f.feature}: ${f.message}`);
  }
}

// ---------------------------------------------------------------------------
// Page interaction helpers
// ---------------------------------------------------------------------------

/**
 * Dismiss the cookie consent banner if present.
 * @param indent - leading whitespace for the confirmation log line
 */
export async function dismissCookieBanner(
  page: Page,
  indent = "  ",
): Promise<void> {
  try {
    const cookieButton = page
      .locator(SELECTORS.cookieConsent.acceptButton)
      .first();
    const isVisible = await cookieButton
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (isVisible) {
      await cookieButton.click();
      await page.waitForTimeout(500); // eslint-disable-line playwright/no-wait-for-timeout
      console.log(`${indent}✓ Cookie banner dismissed`);
    }
  } catch {
    // Ignore — banner may not be present
  }
}

/**
 * Scroll the page progressively to trigger lazy-loaded content,
 * then return to the top.
 */
export async function scrollAndLoadContent(page: Page): Promise<void> {
  for (let i = 1; i <= 5; i++) {
    await page.evaluate((step) => window.scrollTo(0, step * 1000), i);
    await page.waitForTimeout(500); // eslint-disable-line playwright/no-wait-for-timeout
  }
  await page.waitForTimeout(1500); // eslint-disable-line playwright/no-wait-for-timeout
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500); // eslint-disable-line playwright/no-wait-for-timeout
}
