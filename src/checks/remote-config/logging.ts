/**
 * Summaries of the captured Remote Config flags for the run log.
 */

import type { RemoteConfigFlags } from "./types.js";

/**
 * Formats captured flags for console logging (summary view)
 */
export function formatFlagsForLog(flags: RemoteConfigFlags | null): string {
  if (!flags) {
    return "(não capturado)";
  }

  const parts: string[] = [];

  if (flags.product_reviews) {
    const pr = flags.product_reviews;
    parts.push(
      `reviews=${pr.enabled ? "✅" : "❌"}`,
      `filter=${pr.filter ? "✅" : "❌"}`,
      `sort=${pr.sort ? "✅" : "❌"}`,
      `photos=${pr.photos ? "✅" : "❌"}`,
      `ai_summary=${pr.ai_summary ? "✅" : "❌"}`,
    );
  }

  if (flags.enable_shoptheset_pdp !== undefined) {
    parts.push(`shopTheSet=${flags.enable_shoptheset_pdp ? "✅" : "❌"}`);
  }

  if (flags.enable_vto_pdp !== undefined) {
    parts.push(`vto=${flags.enable_vto_pdp ? "✅" : "❌"}`);
  }

  return parts.length > 0 ? parts.join(", ") : "(sem flags PDP)";
}

/**
 * Groups captured flags by category for detailed display
 */
export function getFlagsByCategory(
  flags: RemoteConfigFlags | null,
): Record<string, Record<string, unknown>> {
  if (!flags) {
    return {};
  }

  const categories: Record<string, Record<string, unknown>> = {};

  // Product Reviews (structured)
  if (flags.product_reviews) {
    categories["📝 Reviews (product_reviews)"] = {
      enabled: flags.product_reviews.enabled,
      ai_summary: flags.product_reviews.ai_summary,
      filter: flags.product_reviews.filter,
      sort: flags.product_reviews.sort,
      photos: flags.product_reviews.photos,
      feedback: flags.product_reviews.feedback,
      "recommendation.enabled": flags.product_reviews.recommendation?.enabled,
      "recommendation.min_count":
        flags.product_reviews.recommendation?.min_count,
    };
  }

  // PDP Flags
  const pdpFlags: Record<string, unknown> = {};
  if (flags.pdp_new_experience !== undefined) {
    pdpFlags.pdp_new_experience = flags.pdp_new_experience;
  }
  if (flags.disable_omni_pickup_tab_on_pdp !== undefined) {
    pdpFlags.disable_omni_pickup_tab_on_pdp =
      flags.disable_omni_pickup_tab_on_pdp;
  }
  if (flags.enable_descount_amount_tag_pdp !== undefined) {
    pdpFlags.enable_descount_amount_tag_pdp =
      flags.enable_descount_amount_tag_pdp;
  }
  if (flags.enable_gift_pdp_new_experience !== undefined) {
    pdpFlags.enable_gift_pdp_new_experience =
      flags.enable_gift_pdp_new_experience;
  }
  if (flags.enable_pdp_review !== undefined) {
    pdpFlags.enable_pdp_review = flags.enable_pdp_review;
  }
  if (flags.enable_vto_pdp !== undefined) {
    pdpFlags.enable_vto_pdp = flags.enable_vto_pdp;
  }
  if (flags.enable_shoptheset_pdp !== undefined) {
    pdpFlags.enable_shoptheset_pdp = flags.enable_shoptheset_pdp;
  }
  if (flags.enable_shoptheset_pdp_einstein !== undefined) {
    pdpFlags.enable_shoptheset_pdp_einstein =
      flags.enable_shoptheset_pdp_einstein;
  }
  if (flags.wl_target_personalization_pdp_showcase !== undefined) {
    pdpFlags.wl_target_personalization_pdp_showcase =
      flags.wl_target_personalization_pdp_showcase;
  }
  if (flags.wl_target_personalization_pdp_showcase_v2 !== undefined) {
    pdpFlags.wl_target_personalization_pdp_showcase_v2 =
      flags.wl_target_personalization_pdp_showcase_v2;
  }
  if (flags.enable_image_zoom_pdp_web_responsive !== undefined) {
    pdpFlags.enable_image_zoom_pdp_web_responsive =
      flags.enable_image_zoom_pdp_web_responsive;
  }
  if (flags.enable_media_video_carousel_pdp !== undefined) {
    pdpFlags.enable_media_video_carousel_pdp =
      flags.enable_media_video_carousel_pdp;
  }
  if (flags.free_freight_tag !== undefined) {
    pdpFlags.free_freight_tag = flags.free_freight_tag;
  }
  if (flags.enable_coupons_pdp !== undefined) {
    pdpFlags.enable_coupons_pdp = flags.enable_coupons_pdp;
  }
  if (flags.wl_notify_me !== undefined) {
    pdpFlags.wl_notify_me = flags.wl_notify_me;
  }
  if (Object.keys(pdpFlags).length > 0) {
    categories["🛍️ PDP Features"] = pdpFlags;
  }

  // Gift module on PDP (+ the web options it depends on)
  if (flags.gift_module_pdp) {
    categories["🎁 Gift (gift_module_pdp)"] = {
      enabled: flags.gift_module_pdp.enabled,
      bundle_tags: flags.gift_module_pdp.bundle_tags?.join(", "),
      "web.card_message":
        flags.enable_module_gift_cart?.enable_module_gift_web?.card_message,
      "web.search_bag":
        flags.enable_module_gift_cart?.enable_module_gift_web?.search_bag,
    };
  }

  // Product Card Flags
  const cardFlags: Record<string, unknown> = {};
  if (flags.enable_product_card_rating !== undefined) {
    cardFlags.enable_product_card_rating = flags.enable_product_card_rating;
  }
  if (flags.wl_show_rating_on_product_card !== undefined) {
    cardFlags.wl_show_rating_on_product_card =
      flags.wl_show_rating_on_product_card;
  }
  if (Object.keys(cardFlags).length > 0) {
    categories["🃏 Product Card"] = cardFlags;
  }

  return categories;
}

/**
 * Counts total captured flags
 */
export function countCapturedFlags(flags: RemoteConfigFlags | null): number {
  if (!flags) {
    return 0;
  }

  let count = 0;

  // Count product_reviews fields
  if (flags.product_reviews) {
    count += 7; // enabled, ai_summary, filter, sort, photos, feedback, recommendation
  }

  // Count gift module fields
  if (flags.gift_search_category_cart) {
    count += 3; // web, app_android, app_ios
  }
  if (flags.enable_module_gift_cart) {
    count += 6; // 3 platforms x 2 properties each
  }

  // Count all other defined boolean flags
  const flagKeys = Object.keys(flags).filter(
    (k) =>
      k !== "_raw" &&
      k !== "capturedAt" &&
      k !== "locale" &&
      k !== "product_reviews" &&
      flags[k as keyof RemoteConfigFlags] !== undefined,
  );

  count += flagKeys.length;

  return count;
}
