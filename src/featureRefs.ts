/**
 * Reference images for the dashboard: one fixed screenshot per feature per operation group,
 * showing what each check looks for. Captured by `npm run refs:capture` (captureFeatureRefs.ts)
 * or dropped in manually (e.g. when the WAF blocks the capture) at
 * `dashboard/public/feature-refs/<group>/<featureKey>.png`.
 *
 * The grouping lives in featureRefGroups.ts (the dashboard test checks its copy against it).
 */

import { Locator, Page } from "@playwright/test";
import { FeatureKey } from "./types.js";
import { SELECTORS } from "./checks/configs/config.js";

export { refGroupOf } from "./featureRefGroups.js";

export interface FeatureRefTarget {
  /** Element that frames the feature on the PDP */
  locate: (page: Page) => Locator;
  /** Max height of the capture (px) — tall sections are cropped from the top */
  maxHeight?: number;
  /** Space around the element (px); larger for tiny elements so they keep some context */
  padding?: number;
}

/** Main product card — the header and showcases have buy/favorite buttons too. */
const inProductCard = (selectors: string) =>
  selectors
    .split(", ")
    .map((s) => `section.bg-white ${s}`)
    .join(", ");

/** Features with something to see on the PDP. Data checks (ratingConsistency, i18nKeys, endpoints) have no image. */
export const FEATURE_REF_TARGETS: Partial<
  Record<FeatureKey, FeatureRefTarget>
> = {
  reviews: { locate: (p) => p.locator("#reviews"), maxHeight: 240 },
  aiReviewSummary: { locate: (p) => p.locator("#reviews .bg-info-lightest") },
  reviewFilter: {
    locate: (p) =>
      p.locator(
        '#reviews button:has(i[class*="natds-icons-outlined-action-filter"])',
      ),
  },
  reviewSort: {
    locate: (p) =>
      p.locator(
        '#reviews button:has(i[class*="natds-icons-outlined-navigation-arrowbottom"])',
      ),
  },
  reviewPhotos: {
    locate: (p) =>
      p
        .locator(
          '#reviews img[class*="h-32"][class*="w-32"], #reviews img[class*="rounded-micro"]',
        )
        // img → wrapper → photo row → review card
        .locator("xpath=../../.."),
    maxHeight: 320,
  },
  reviewRecommendation: {
    locate: (p) =>
      p.locator(".bg-success").filter({ hasText: /\d+%/ }).locator("xpath=.."),
  },
  rating: { locate: (p) => p.locator(SELECTORS.rating.value), padding: 4 },
  // The brand showcase is rendered first, the recommendation one second
  brandShowcase: {
    locate: (p) => p.locator(SELECTORS.showcase.populatedSection).nth(0),
    maxHeight: 520,
  },
  recommendationShowcase: {
    locate: (p) => p.locator(SELECTORS.showcase.populatedSection).nth(1),
    maxHeight: 520,
  },
  shopTheSet: {
    locate: (p) => p.locator(SELECTORS.shopTheSet.section),
    maxHeight: 520,
  },
  images: {
    // Same main-gallery selectors as checks/media.ts (the generic one also matches showcases)
    locate: (p) =>
      p.locator(
        '[data-testid="main-pdp-image-carousel"], [data-testid="pdp-image-gallery"], .swiper.swiper-fade',
      ),
    maxHeight: 520,
  },
  addToCart: {
    // Bag icon first; the text/aria-label fallbacks also match the favorite ("adicionar aos favoritos")
    locate: (p) =>
      p
        .locator(
          'section.bg-white button:has(i[data-icon-name="outlined-finance-bag"])',
        )
        .or(
          p
            .locator(inProductCard(SELECTORS.addToCart.anyButton))
            .filter({ hasNot: p.locator('[data-icon-name*="action-love"]') }),
        ),
  },
  favoriteButton: {
    locate: (p) => p.locator(SELECTORS.favoriteButton.button),
    padding: 24,
  },
  productVariations: {
    locate: (p) =>
      p.locator(SELECTORS.productVariations.selector).locator("xpath=.."),
  },
  contentBanners: {
    locate: (p) => p.locator(SELECTORS.contentBanners.section),
    maxHeight: 420,
  },
  coupons: { locate: (p) => p.locator(SELECTORS.coupons.banner) },
  giftModule: { locate: (p) => p.locator(SELECTORS.giftModule.trigger) },
};
