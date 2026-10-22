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
  /**
   * Display rule from ncf-whitelabel-cf-android (BuyBottomSheetNe / ProductBaseInformationViewHolder):
   * in stock → cv_buy_button (sticky bar) / btBuy (body); out of stock → btNotifyMe ("me avise",
   * item_product_warning_ne / product_body_warning_ne), shown only when isNotifyMeEnabled.
   */
  addToCart: {
    anyButton:
      'new UiSelector().resourceIdMatches(".*:id/(cv_buy_button|btBuy)")',
    notifyMeButton: 'new UiSelector().resourceIdMatches(".*:id/btNotifyMe")',
    /** "acabou, mas volta logo!" warning — shown out of stock with or without the notify-me button. */
    unavailableWarning:
      'new UiSelector().resourceIdMatches(".*:id/tv_warning_unavailable")',
    textFallback:
      'new UiSelector().textMatches("(?i)^(comprar|adicionar|agregar|me avise|avise-me|av[ií]same).*$")',
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
  pdp: {
    /**
     * Vertical scroll container of the PDP: product_details_nested_scroll.xml (NestedScrollView)
     * included as @id/main_view in product_details_activity_ne.xml (the include id replaces the
     * root id). Must be targeted explicitly: a generic `scrollable(true)` picks the first scrollable
     * node, which can be a horizontal pager (image gallery, ZeeDog), so no vertical scroll happens.
     */
    scrollContainer: 'new UiSelector().resourceIdMatches(".*:id/main_view")',
    /**
     * Close icon of the ZeeDog floating messages ("cupom para você", ncf-ui-cf-android
     * ZeeDogComponent.kt): Compose, no resource-id, contentDescription = zee_dog_close_accessibility.
     * PT-BR only — extend with the Spanish/Avon strings once those operations are configured.
     */
    zeeDogClose: 'new UiSelector().descriptionMatches("(?i)^fechar recados.*")',
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
    /**
     * Login V2 (feature flag isLoginV2Enabled, RegisterCustomerOtpScreen) is Jetpack Compose with no
     * resource-ids, so it's matched by widget class. "entrar usando minha senha" is always the last
     * Button on that screen (social/enter buttons come before it), which keeps this locale-independent.
     */
    v2EmailField: 'new UiSelector().className("android.widget.EditText")',
    v2Buttons: 'new UiSelector().className("android.widget.Button")',
  },
};
