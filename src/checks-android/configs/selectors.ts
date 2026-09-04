/**
 * Native Android (UiAutomator2) locators for PDP features.
 *
 * TODO(app team): confirm real resource-id / accessibility-id values for these elements
 * (see `product-details` module in ncf-whitelabel-cf-android). Until then, the text-match
 * UiSelector below is a best-effort placeholder mirroring the web SELECTORS.addToCart pattern.
 */
export const ANDROID_SELECTORS = {
  addToCart: {
    anyButton:
      'new UiSelector().textMatches("(?i)^(comprar|adicionar|avise-me).*$")',
  },
};
