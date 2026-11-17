/**
 * PDP showcases. Split under ./showcases/:
 * - einstein.ts: Einstein personalization capture, product count and diagnostic re-fetch
 * - brandShowcase.ts: "mais produtos da marca" (1st showcase section)
 * - recommendationShowcase.ts: "achamos que você vai gostar" (Einstein, lazy)
 */

export {
  extractProductsFromPayload,
  countEinsteinProducts,
  setupEinsteinShowcaseCapture,
} from "./showcases/einstein.js";
export { checkBrandShowcase } from "./showcases/brandShowcase.js";
export { checkRecommendationShowcase } from "./showcases/recommendationShowcase.js";
