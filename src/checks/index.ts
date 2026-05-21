/**
 * Feature Check Modules
 * Export all individual feature checkers
 */

export { checkReviews } from "./reviews.js";
export { checkAiReviewSummary } from "./aiReviewSummary.js";
export {
  checkReviewFilter,
  checkReviewSort,
  checkReviewPhotos,
  checkReviewRecommendation,
} from "./reviewFeatures.js";
export {
  checkBrandShowcase,
  checkRecommendationShowcase,
} from "./showcases.js";
export { checkShopTheSet } from "./shopTheSet.js";
export { checkImages } from "./media.js";
export { checkPricing } from "./pricing.js";
export { checkShipping } from "./shipping.js";
export {
  checkRatingConsistency,
  setupRatingConsistencyCapture,
  captureRatingFromJsonLd,
} from "./ratingConsistency.js";
export { checkRating } from "./rating.js";
