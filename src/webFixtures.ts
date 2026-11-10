/**
 * What a Web fixture (src/tests/fixtures/web, made by `npm run fixtures:web`) holds and which
 * checkers it replays. Shared by the capture script (src/captureWebFixture.ts) and the test
 * (src/tests/web-fixtures.test.ts); no side effects on import.
 */
import type { Page } from "@playwright/test";
import {
  checkCoupons,
  checkFavoriteButton,
  checkMinStockBadge,
  checkProductVariations,
  checkReviewFilter,
  checkReviewPhotos,
  checkReviewRecommendation,
  checkReviewSort,
  checkTopRatedBadge,
} from "./checks/index.js";
import { checkI18nKeys } from "./checks/i18n.js";
import { matchesCommerceFeatureFlagUrl } from "./checks/remoteConfig.js";
import type { CheckResult } from "./types.js";

/**
 * Read-only checkers whose verdict is recorded on the live page and replayed on the fixture.
 */
export const WEB_FIXTURE_CHECKERS: Record<string, (page: Page) => Promise<CheckResult>> = {
  productVariations: checkProductVariations,
  reviewFilter: checkReviewFilter,
  reviewSort: checkReviewSort,
  reviewPhotos: checkReviewPhotos,
  reviewRecommendation: checkReviewRecommendation,
  favoriteButton: checkFavoriteButton,
  coupons: checkCoupons,
  topRatedBadge: checkTopRatedBadge,
  minStockBadge: checkMinStockBadge,
  i18nKeys: checkI18nKeys,
};

/** API responses kept in the .har.json (everything else the page loads is dropped). */
export function isFixtureApi(url: string): boolean {
  return (
    url.includes("/pages/v2/product/") ||
    url.includes("/pages/product/") ||
    url.includes("/reviews/v2") ||
    url.includes("einstein/personalization/campaign/products") ||
    url.includes("firebaseremoteconfig") ||
    url.includes("remoteconfig") ||
    matchesCommerceFeatureFlagUrl(url)
  );
}

export interface WebFixtureEntry {
  url: string;
  method: string;
  status: number;
  contentType: string;
  body?: string;
}

export interface WebFixtureMeta {
  source: {
    sku: string;
    vendor: string;
    country: string;
    channel: string;
    url: string;
    browser: string;
    capturedAt: string;
  };
  /** What each checker said on the live page (featureKey → status + message). */
  live: Record<string, { status: string; message: string }>;
}
