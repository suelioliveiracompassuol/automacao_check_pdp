/**
 * Shapes of the flags the monitor reads: Firebase Remote Config (per locale) and the Commerce
 * BFF /feature-flag endpoint, plus how a feature maps to them.
 */

/**
 * Product Reviews configuration from Remote Config
 */
export interface ProductReviewsConfig {
  enabled: boolean;
  ai_summary: boolean;
  filter: boolean;
  sort: boolean;
  photos: boolean;
  feedback?: boolean;
  recommendation: {
    enabled: boolean;
    min_count: number;
  };
}

/**
 * Gift Search Category configuration from Remote Config
 */
export interface GiftSearchCategoryConfig {
  web?: {
    category_name: string;
  };
  app_android?: {
    category_name: string;
  };
  app_ios?: {
    category_name: string;
  };
}

/**
 * Enable Module Gift configuration from Remote Config
 */
export interface EnableModuleGiftConfig {
  enable_module_gift_web?: {
    card_message: boolean;
    search_bag: boolean;
  };
  enable_module_gift_app_android?: {
    card_message: boolean;
    search_bag: boolean;
  };
  enable_module_gift_app_ios?: {
    card_message: boolean;
    search_bag: boolean;
  };
}

/**
 * Gift module on PDP configuration from Remote Config
 */
export interface GiftModulePdpConfig {
  enabled: boolean;
  /** Product refinements that make the PDP a gift bundle */
  bundle_tags?: string[];
}

/**
 * Captured Remote Config flags relevant to PDP
 */
export interface RemoteConfigFlags {
  /** Raw captured data for debugging */
  _raw?: Record<string, unknown>;
  /** Capture timestamp */
  capturedAt: string;
  /** Locale used to extract values */
  locale: string;

  // =========================================================================
  // PRODUCT REVIEWS (structured object)
  // =========================================================================
  product_reviews?: ProductReviewsConfig;

  // =========================================================================
  // PDP FEATURE FLAGS
  // =========================================================================
  pdp_new_experience?: boolean;
  disable_omni_pickup_tab_on_pdp?: boolean;
  enable_descount_amount_tag_pdp?: boolean;
  enable_gift_pdp_new_experience?: boolean;
  enable_pdp_review?: boolean;
  enable_vto_pdp?: boolean;
  enable_shoptheset_pdp?: boolean;
  enable_shoptheset_pdp_einstein?: boolean;
  wl_target_personalization_pdp_showcase?: boolean;
  wl_target_personalization_pdp_showcase_v2?: boolean;
  enable_image_zoom_pdp_web_responsive?: boolean;
  enable_media_video_carousel_pdp?: boolean;
  free_freight_tag?: boolean;
  /** Card de cupons na PDP (ncf-ssr: também exige o commerce flag couponCenter). */
  enable_coupons_pdp?: boolean;

  // // =========================================================================
  // // REVIEWS FLAGS (individual)
  // // =========================================================================
  // enable_konfidency_review?: boolean;
  // enable_review_ai_summary?: boolean;
  // enable_review_feedback?: boolean;
  // enable_reviews_filter?: boolean;
  // enable_reviews_sorting?: boolean;
  // enable_image_and_upload_review?: boolean;
  //=========================================================================
  // GIFT MODULE (structured objects)
  // =========================================================================
  gift_search_category_cart?: GiftSearchCategoryConfig;
  enable_module_gift_cart?: EnableModuleGiftConfig;
  /** Módulo "esse pedido é para presente?" na PDP (ncf-ssr: também exige uma opção web em enable_module_gift_cart). */
  gift_module_pdp?: GiftModulePdpConfig;

  // =========================================================================
  // PRODUCT CARD FLAGS
  // =========================================================================
  enable_product_card_rating?: boolean;
  wl_show_rating_on_product_card?: boolean;

  // =========================================================================
  // APP-ONLY FLAGS (Android)
  // =========================================================================
  /** "me avise" button for out-of-stock products (GlobalFlags.isNotifyMeEnabled). */
  wl_notify_me?: boolean;
}

/**
 * Commerce Feature Flags from /feature-flag endpoint
 * These are separate from Firebase Remote Config
 */
export interface CommerceFeatureFlags {
  /** Capture timestamp */
  capturedAt: string;
  /** Raw response for debugging */
  _raw?: Record<string, unknown>;

  // Business Model
  businessModel?: string;

  // PDP Features
  displayStockOnProductDetailPage?: boolean;
  newExperiencePdpEnable?: boolean;
  enablePdpFreightCalculation?: boolean;
  enableDisplayFreeShippingPdp?: boolean;
  freeShippingValue?: number;
  nePagesPdV2?: boolean;

  // Gift & Packaging
  giftPackaging?: boolean;
  enableGiftOnSite?: boolean;
  giftSku?: string;

  productRecommendation?: boolean;
  location?: boolean;
  newExperienceEnable?: boolean;

  // Social Commerce
  socialCommerce?: boolean;
  socialCommerceMinhaLoja?: boolean;

  // Coupons
  couponCenter?: boolean;
}

/**
 * Mapping of feature keys to their Remote Config paths
 */
export interface RemoteConfigMapping {
  /** Remote Config key (e.g., "product_reviews") */
  configKey: string;
  /** Path within the config object (e.g., "filter" or "recommendation.enabled") */
  configPath?: string;
  /**
   * Only check the feature when the flag was captured as true (absent = N/A). Its keys are
   * read for the page's own locale only, without the pt-BR fallback.
   */
  requireCaptured?: boolean;
  /**
   * Further Remote Config paths of which at least one must also be true (e.g. the gift module
   * needs a web gift option). When none of them was captured: N/A with `requireCaptured`,
   * otherwise ignored.
   */
  requiresAnyOf?: { configKey: string; configPath?: string }[];
}

/** Outcome of a feature flag gate. */
export interface FlagGateResult {
  enabled: boolean;
  flagValue: unknown;
  flagKey?: string;
  /** The feature only exists behind a flag that wasn't captured — report N/A, not disabled. */
  notCaptured?: boolean;
}
