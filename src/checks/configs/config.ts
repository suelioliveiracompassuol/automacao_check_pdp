/**
 * Configuration for PDP Feature Monitoring
 */

import { EndpointRule } from "../endpointResponse.js";
import {
  Channel,
  Country,
  DomainConfig,
  FeatureConfig,
  SkuConfig,
  Vendor,
} from "../../types.js";
import { DOMAINS } from "./domains.js";
import { FEATURES } from "./features.js";
export { EndpointRule };

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get domain configuration for a vendor/country/channel combination
 */
export function getDomain(
  vendor: Vendor,
  country: Country,
  channel?: Channel,
): DomainConfig | undefined {
  const ch = channel || "ecommerce";
  return DOMAINS.find(
    (d) =>
      d.vendor === vendor &&
      d.country === country &&
      (d.channel || "ecommerce") === ch,
  );
}

/**
 * Build the PDP URL for a SKU
 */
export function buildPdpUrl(sku: SkuConfig): string {
  const domain = getDomain(sku.vendor, sku.country, sku.channel);
  if (!domain) {
    throw new Error(
      `No domain configured for ${sku.vendor}/${sku.country}/${sku.channel || "ecommerce"}`,
    );
  }
  // URL pattern: /p/{slug}/{SKU}
  // Use the slug if provided, otherwise generate from name
  const slug = sku.slug || sku.name.toLowerCase().replace(/\s+/g, "-");
  let url = `${domain.domain}/p/${encodeURIComponent(slug)}/${sku.sku}`;
  if (domain.queryParams) {
    url += `?${domain.queryParams}`;
  }
  return url;
}

/**
 * Check if a feature is supported for a given vendor
 */
export function isFeatureSupported(
  feature: FeatureConfig,
  vendor: Vendor,
): boolean {
  if (!feature.supportedVendors) {
    return true;
  }
  return feature.supportedVendors.includes(vendor);
}

/**
 * Get features applicable to a specific SKU.
 *
 * Logic:
 * 1. The operation's domain defines `availableFeatures` — only features listed there are checked.
 * 2. Optional features (olfactiveNotes, usageTips, shopTheSet) are only checked if also in `sku.expectedFeatures`.
 * 3. Features NOT in the operation's `availableFeatures` are skipped (N/A) to avoid false positives.
 */
export function getApplicableFeatures(sku: SkuConfig): FeatureConfig[] {
  const domain = getDomain(sku.vendor, sku.country, sku.channel);
  const domainFeatures = domain?.availableFeatures || [];

  return FEATURES.filter((f) => {
    // Feature must be available on this operation
    if (!domainFeatures.includes(f.key)) {
      return false;
    }

    // Check if feature is optional - only check if explicitly expected for this SKU
    if (f.optional) {
      if (!sku.expectedFeatures || !sku.expectedFeatures.includes(f.key)) {
        return false;
      }
    }

    return true;
  });
}

// =============================================================================
// SELECTORS (CSS selectors for feature detection)
// =============================================================================

export const SELECTORS = {
  // Cookie consent banner - dismiss it first (multi-language)
  cookieConsent: {
    acceptButton:
      '[id="onetrust-accept-btn-handler"], [data-testid="cookie-accept"]',
  },

  // Reviews section
  reviews: {
    section: '[data-testid="reviews-component"], #reviews',
    ratingValue: '[data-testid="reviews-summary"]',
    reviewList: '[data-testid="review-card"], [class*="review-card"]',
  },

  // Brand showcase
  brandShowcase: {
    section:
      'section:has-text("mais produtos da marca"), section:has-text("más productos de la marca"), [data-testid="product-showcase-carousel"], [data-testid="mock-product-showcase-carousel"]',
    productCards:
      '[data-testid="btn-add-to-cart"], [data-testid="product-card"], [class*="product-card"], [class*="showcase"] a[href*="/p/"]',
  },

  // Recommendation showcase
  recommendationShowcase: {
    section:
      'section:has-text("achamos que você vai gostar"), section:has-text("você também pode gostar"), section:has-text("también te puede gustar"), section:has-text("te puede gustar"), section:has-text("te pueden gustar"), section:has-text("también te puede interesar"), section:has-text("te puede interesar"), section:has-text("también podrían gustarte"), section:has-text("te podrían gustar"), section:has-text("te va a gustar"), section:has-text("productos recomendados"), section:has-text("también te puede gustar"), [data-testid="einstein-recommendation-carousel"], [data-testid="personalization-recommendation-carousel"], [data-testid="product-showcase-carousel"]',
    productCards:
      '[data-testid="btn-add-to-cart"], [data-testid="product-card"], [class*="product-card"], [class*="showcase"] a[href*="/p/"]',
  },

  // Product images
  images: {
    carousel: '[data-testid="product-image-carousel"], [data-testid="swiper"]',
    productImage:
      '[data-testid="product-image"], img[alt*="produto"], img[alt*="product"]',
  },

  // Pricing
  pricing: {
    section: '[data-testid="product-pricing"], [data-testid="sku-split-price"]',
    salePrice:
      '[data-testid="product-card-bag-product-pricing-sale-price"], [data-testid="price-line"]',
    listPrice: '[data-testid="product-card-bag-product-pricing-list-price"]',
    discount: '[data-testid="discount-badge"]',
  },

  // Shipping simulation
  shipping: {
    section: '[data-testid="shipping-indicator"], [data-testid="bag-shipping"]',
    cepInput:
      '[data-testid="shipping-indicator-form"], [data-testid="postalCode"]',
  },

  // Rating (top of page)
  rating: {
    stars: '[data-testid="review-stars"], [data-testid="star-icon"], [data-icon-name*="action-rating"]',
    value: '[data-testid="reviews-summary"], div:has(> [data-testid="go-to-reviews-button"])',
  },

  // Shop the Set
  shopTheSet: {
    section: '[data-testid="shop-the-set"]',
    productCards: '[data-testid="product-card"]',
  },

  // Product Variations selector — color/shade swatches on PDP
  productVariations: {
    selector: '[data-testid="color-option"]',
  },

  // Favorite Button — escopado no card principal do produto (section.bg-white)
  favoriteButton: {
    button: [
      'section.bg-white button[data-icon-name*="action-love"]',
      'section.bg-white button[aria-label*="favorito" i]',
      'section.bg-white button[aria-label*="favorit" i]',
      'section.bg-white button[title*="favorito" i]',
    ].join(', '),
  },

  // Add to Cart / Warn Me
  addToCart: {
    anyButton: [
      // Identificadores agnósticos de idioma
      '[data-testid="btn-add-to-cart"]',
      '[data-testid="product-quantity-counter"]',
      // Textos em Português
      'button:has-text("Comprar")',
      'button:has-text("Adicionar")',
      'button:has-text("Avise-me")',
      'button[aria-label*="Comprar" i]',
      'button[aria-label*="Adicionar" i]',
      'button[aria-label*="Avise-me" i]',
      // Textos em Espanhol
      'button:has-text("Agregar")',
      'button:has-text("Avisame")',
      'button:has-text("Avísame")',
      'button[aria-label*="Agregar" i]',
      'button[aria-label*="Avisame" i]',
      'button[aria-label*="Avísame" i]',
      // Textos em Inglês (fallback)
      'button:has-text("Buy")',
      'button:has-text("Warn me")',
      'button[aria-label*="buy" i]',
      'button[aria-label*="warn" i]'
    ].join(', '),
  },

  // Structural selector for showcase sections
  showcase: {
    section:
      'section.bg-background:not(#ot-pc-lst):not(#ot-fltr-modal), [data-testid="product-showcase-carousel"], [data-testid="einstein-recommendation-carousel"], [data-testid="personalization-recommendation-carousel"]',
    populatedSection:
      'section.bg-background:not(#ot-pc-lst):not(#ot-fltr-modal):has([data-testid="btn-add-to-cart"]), section.bg-background:not(#ot-pc-lst):not(#ot-fltr-modal):has(a[href*="/p/"]), [data-testid="product-showcase-carousel"]:has([data-testid="product-card"]), [data-testid="einstein-recommendation-carousel"]:has([data-testid="product-card"]), [data-testid="personalization-recommendation-carousel"]:has([data-testid="product-card"])',
  },

  // Explore journey selectors
  explore: {
    productLinks: 'a[href*="/p/"]',
    vitrineSelectors: [
      '[data-testid="product-showcase-carousel"] a[href*="/p/"]',
      '[data-testid="einstein-recommendation-carousel"] a[href*="/p/"]',
      '[data-testid="personalization-recommendation-carousel"] a[href*="/p/"]',
      '[data-testid="swiper"] a[href*="/p/"]',
      'a[href*="/p/"]',
    ],
  },
};

// =============================================================================
// TIMING CONFIGURATION
// =============================================================================

export const TIMING = {
  /** Delay between checking different PDPs (ms) */
  delayBetweenPages: 3000,
  /** Timeout for page navigation (ms) */
  navigationTimeout: 30000,
  /** Timeout for element visibility check (ms) */
  elementTimeout: 10000,
  /** Wait after page load for dynamic content (ms) */
  pageLoadSettleTime: 2000,
};
