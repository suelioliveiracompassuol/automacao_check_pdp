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
      'button:has-text("aceitar"), button:has-text("Aceitar"), button:has-text("aceptar"), button:has-text("Aceptar"), button:has-text("accept"), [data-testid="cookie-accept"]',
  },

  // Reviews section (PT-BR: avaliações, ES: evaluaciones/reseñas)
  reviews: {
    section:
      'section:has-text("avaliações do produto"), section:has-text("avaliações"), h2:has-text("avaliações"), h2:has-text("evaluaciones"), section:has-text("evaluaciones"), section:has-text("reseñas"), [data-testid="reviews"], #reviews',
    ratingValue: '[class*="rating"], [class*="stars"], [data-testid="rating"]',
    reviewList:
      '[class*="review-card"], [class*="review-item"], [data-testid="review"]',
  },

  // Brand showcase (PT-BR: "mais produtos da marca", ES: "más productos de la marca")
  brandShowcase: {
    section:
      'section:has-text("mais produtos da marca"), section:has-text("más productos de la marca"), [data-testid="brand-showcase"]',
    productCards: '[class*="product-card"], [class*="showcase"] a[href*="/p/"]',
  },

  // Recommendation showcase (PT-BR: "achamos que você vai gostar", ES: "te puede gustar", "también te puede gustar", "también te puede interesar")
  recommendationShowcase: {
    section:
      'section:has-text("achamos que você vai gostar"), section:has-text("você também pode gostar"), section:has-text("también te puede gustar"), section:has-text("te puede gustar"), section:has-text("te pueden gustar"), section:has-text("también te puede interesar"), section:has-text("te puede interesar"), section:has-text("también podrían gustarte"), section:has-text("te podrían gustar"), section:has-text("te va a gustar"), section:has-text("productos recomendados"), section:has-text("también te puede gustar"), [data-testid="recommendation-showcase"]',
    productCards: '[class*="product-card"], [class*="showcase"] a[href*="/p/"]',
  },

  // Product images
  images: {
    carousel: '[class*="swiper"], [class*="carousel"], [class*="gallery"]',
    productImage:
      'img[src*="natura"], img[src*="avon"], img[alt*="produto"], img[alt*="product"], [data-testid="product-image"]',
  },

  // Pricing
  pricing: {
    section: '[class*="price"], [class*="pricing"], [data-testid="price"]',
    salePrice:
      '[class*="sale"], [class*="price"]:not([class*="list"]), [data-testid="sale-price"]',
    listPrice: '[class*="list-price"], [class*="original"], del, s',
    discount: '[class*="discount"], [class*="badge"]',
  },

  // Shipping simulation (PT-BR: simular frete, ES: calcular envío / costo de envío)
  shipping: {
    section:
      'section:has-text("simular frete"), section:has-text("calcular frete"), section:has-text("frete grátis"), section:has-text("calcular envío"), section:has-text("costo de envío"), section:has-text("envío gratis"), [data-testid="shipping"]',
    cepInput:
      'input[placeholder*="CEP"], input[placeholder*="cep"], input[placeholder*="Cep"], input[placeholder*="código postal"], input[placeholder*="CP"], input[name*="cep"], input[name*="CEP"], input[name*="postal"], input[aria-label*="cep" i], input[aria-label*="postal" i], input[type="tel"][maxlength="9"], input[type="tel"][maxlength="8"], input[type="tel"][maxlength="5"], input[inputmode="numeric"]',
  },

  // Rating (top of page)
  rating: {
    stars: '[class*="star"], [class*="rating"], svg[class*="star"]',
    value: '[class*="rating-value"], [class*="average"], text=/\\d+\\.\\d+/',
  },

  // Shop the Set / "Queridinhos que são comprados juntos"
  shopTheSet: {
    section:
      'section:has-text("Queridinhos que são comprados juntos"), section:has-text("queridinhos que são comprados juntos"), section:has-text("comprados juntos"), section:has-text("compre junto"), section:has-text("shop the set"), section:has-text("compra el set"), section:has-text("favoritos que se compran juntos"), [data-testid="shop-the-set"], [data-testid="bought-together"]',
    productCards: 'a[href*="/p/"], [class*="product-card"]',
  },

  // Structural selector for showcase sections
  showcase: {
    section: "section.bg-background:not(#ot-pc-lst):not(#ot-fltr-modal)",
    populatedSection:
      'section.bg-background:not(#ot-pc-lst):not(#ot-fltr-modal):has([data-testid="btn-add-to-cart"], a[href*="/p/"])',
  },

  // Explore journey selectors
  explore: {
    productLinks: 'a[href*="/p/"]',
    vitrineSelectors: [
      'section:has(a[href*="/p/"]) a[href*="/p/"]',
      '[class*="swiper"] a[href*="/p/"]',
      '[class*="carousel"] a[href*="/p/"]',
      '[class*="showcase"] a[href*="/p/"]',
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
