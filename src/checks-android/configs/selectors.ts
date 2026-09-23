/**
 * Native Android (UiAutomator2) locators for PDP features.
 *
 * Prefer resourceId selectors everywhere: this is a whitelabel app (same shared UI modules
 * generate BR, LATAM/Spanish and Avon builds), so resource-ids are compile-time identifiers
 * shared across all of them, while visible text/content-desc is translated per locale/brand
 * and must not be relied upon as a primary selector.
 *
 * `cv_buy_button` confirmed against the QA team's ncf-natura-cf-automation-mobile repo
 * (tests/elements/android/elementsAndroid.js, naturaBrasil.btnBuyProductByPDP).
 * `textFallback` is a PT-BR-only last resort (only reached if the resource-id above fails)
 * — extend it with the Spanish/Avon equivalents once those operations are configured.
 */
export const ANDROID_SELECTORS = {
  addToCart: {
    anyButton: 'new UiSelector().resourceIdMatches(".*:id/cv_buy_button")',
    textFallback:
      'new UiSelector().textMatches("(?i)^(comprar|adicionar|avise-me).*$")',
  },
  /**
   * Confirmed against ncf-whitelabel-cf-android source:
   * - Brand showcase ("mais produtos da marca"): item_showcase_multiple_products.xml,
   *   bound by ProductMoreBrandProductsViewHolder (product-details/ui/.../adapter/viewholder).
   * - Recommendation showcase ("achamos que você vai gostar"): item_einstein_showcase.xml,
   *   bound by PersonalizationShowcaseViewHolder.
   * Both carousels reuse product_carousel_item_ne.xml for each card (tvBrand, tvName,
   * tvSalePrice/tvBasePrice/tagStampDiscount via item_price_product_card.xml, btBuy).
   */
  showcase: {
    brandRecyclerView: "rvMoreBrandProducts",
    recommendationRecyclerView: "rvEinsteinShowcase",
  },
  /**
   * Auth flow locators confirmed against ncf-natura-cf-automation-mobile
   */
  login: {
    accountTab: 'new UiSelector().resourceIdMatches(".*:id/page_account")',
    emailContainer:
      'new UiSelector().resourceIdMatches(".*:id/text_field_input_main").instance(0)',
    emailInput:
      'new UiSelector().resourceIdMatches(".*:id/text_field_input_value").instance(0)',
    passwordContainer:
      'new UiSelector().resourceIdMatches(".*:id/text_field_input_main").instance(1)',
    passwordInput:
      'new UiSelector().resourceIdMatches(".*:id/text_field_input_value").instance(1)',
    loginButton: 'new UiSelector().resourceIdMatches(".*:id/btn_login")',
    permissionAllowButton:
      'new UiSelector().resourceIdMatches(".*:id/permission_allow_button")',
  },
};
