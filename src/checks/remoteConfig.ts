/* eslint-disable no-empty */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Firebase Remote Config Capture Module
 *
 * Intercepts Firebase Remote Config requests during page navigation
 * and extracts feature flags for PDP feature validation.
 */

import { Page } from "@playwright/test";
import { FeatureKey } from "../types.js";
import { getNestedValue } from "../utils.js";

// =============================================================================
// BFF ENDPOINT MAPPING
// =============================================================================

// =============================================================================
// DOM-BASED FEATURE FLAG EXTRACTION
// =============================================================================

/**
 * Unified function to extract Commerce Feature Flags from the page content.
 * This runs in the browser context and tries multiple strategies to find the flags
 * when they are not available from a network endpoint.
 *
 * @param page Playwright Page object
 * @returns Promise resolving to the feature flags object or null
 */
export async function getCommerceFeatureFlagsFromPage(
  page: Page,
): Promise<CommerceFeatureFlags | null> {
  try {
    const flags = await page.evaluate(() => {
      // Helper to check if an object looks like a feature flags object
      const isFeatureFlagsObject = (obj: unknown): boolean => {
        if (!obj || typeof obj !== "object") {
          return false;
        }
        const keys = Object.keys(obj as Record<string, unknown>);
        const primaryKeys = [
          "businessModel",
          "newExperiencePdpEnable",
          "displayStockOnProductDetailPage",
          "enablePdpFreightCalculation",
        ];
        const legacyKeys = ["guestCheckout", "enablePix", "omniEnabled"];
        return (
          primaryKeys.filter((k) => keys.includes(k)).length >= 2 ||
          legacyKeys.filter((k) => keys.includes(k)).length >= 2
        );
      };

      // Helper to recursively search for the first valid feature flags object
      const findFeatureFlags = (
        obj: unknown,
        depth = 0,
      ): Record<string, unknown> | null => {
        if (depth > 10 || !obj || typeof obj !== "object") {
          return null;
        }
        if (isFeatureFlagsObject(obj)) {
          return obj as Record<string, unknown>;
        }
        for (const value of Object.values(obj as Record<string, unknown>)) {
          const found = findFeatureFlags(value, depth + 1);
          if (found) {
            return found;
          }
        }
        return null;
      };

      // Strategy 1: Look in `window.__NEXT_DATA__` (Pages Router)
      const nextData = (window as any).__NEXT_DATA__;
      if (nextData?.props?.pageProps) {
        const found = findFeatureFlags(nextData.props.pageProps);
        if (found) {
          return found;
        }
      }

      // Strategy 2: Look in JSON script tags
      const scripts = document.querySelectorAll(
        'script[type="application/json"]',
      );
      for (const script of Array.from(scripts)) {
        try {
          const data = JSON.parse(script.textContent || "");
          const found = findFeatureFlags(data);
          if (found) {
            return found;
          }
        } catch {}
      }

      // Strategy 3: Look in React Fiber tree (App Router)
      const reactRoot = document.getElementById("__next");
      if (reactRoot) {
        const fiberKey = Object.keys(reactRoot).find((k) =>
          k.startsWith("__reactFiber"),
        );
        if (fiberKey) {
          const searchFiber = (
            fiber: any,
            depth = 0,
          ): Record<string, unknown> | null => {
            if (depth > 25 || !fiber) {
              return null;
            }
            if (fiber.memoizedProps) {
              const found = findFeatureFlags(fiber.memoizedProps);
              if (found) {
                return found;
              }
            }
            if (fiber.child) {
              const found = searchFiber(fiber.child, depth + 1);
              if (found) {
                return found;
              }
            }
            if (fiber.sibling) {
              const found = searchFiber(fiber.sibling, depth + 1);
              if (found) {
                return found;
              }
            }
            return null;
          };
          const rootFiber = (reactRoot as any)[fiberKey];
          const found = searchFiber(rootFiber);
          if (found) {
            return found;
          }
        }
      }

      // Strategy 4: Look for RSC flight data in `self.__next_f`
      const nextFlight = (window as any).self?.__next_f;
      if (Array.isArray(nextFlight)) {
        for (const entry of nextFlight) {
          if (typeof entry[1] !== "string") {
            continue;
          }
          // Find JSON objects within the string that look like feature flags
          const jsonMatches = entry[1].match(
            /\{[^{}]*"(?:guestCheckout|businessModel|newExperiencePdpEnable)"[^{}]*\}/g,
          );
          if (jsonMatches) {
            for (const match of jsonMatches) {
              try {
                const parsed = JSON.parse(match);
                if (isFeatureFlagsObject(parsed)) {
                  return parsed;
                }
              } catch {}
            }
          }
        }
      }

      // Strategy 5: Look for global variables
      const win = window as any;
      if (
        win.__FEATURE_FLAGS__ &&
        isFeatureFlagsObject(win.__FEATURE_FLAGS__)
      ) {
        return win.__FEATURE_FLAGS__;
      }
      if (win.featureFlags && isFeatureFlagsObject(win.featureFlags)) {
        return win.featureFlags;
      }

      return null;
    });

    if (!flags) {
      return null;
    }

    // Normalize the found flags object into the CommerceFeatureFlags structure
    return {
      capturedAt: new Date().toISOString(),
      _raw: flags,
      businessModel: flags.businessModel as string | undefined,
      businessModelB2B2C: flags.businessModelB2B2C as boolean | undefined,
      businessModelB2C: flags.businessModelB2C as boolean | undefined,
      businessModelB2C_B2B2C: flags.businessModelB2C_B2B2C as
        | boolean
        | undefined,
      displayStockOnProductDetailPage: flags.displayStockOnProductDetailPage as
        | boolean
        | undefined,
      newExperiencePdpEnable: flags.newExperiencePdpEnable as
        | boolean
        | undefined,
      enablePdpFreightCalculation: flags.enablePdpFreightCalculation as
        | boolean
        | undefined,
      enableDisplayFreeShippingPdp: flags.enableDisplayFreeShippingPdp as
        | boolean
        | undefined,
      freeShippingValue: flags.freeShippingValue as number | undefined,
      nePagesPdV2: flags.nePagesPdV2 as boolean | undefined,
      newExperienceEnableGiftPdp: flags.newExperienceEnableGiftPdp as
        | boolean
        | undefined,
      giftPackaging: flags.giftPackaging as boolean | undefined,
      enableGiftOnSite: flags.enableGiftOnSite as boolean | undefined,
      giftSku: flags.giftSku as string | undefined,

      productRecommendation: flags.productRecommendation as boolean | undefined,
      location: flags.location as boolean | undefined,
      newExperienceEnable: flags.newExperienceEnable as boolean | undefined,
      socialCommerce: flags.socialCommerce as boolean | undefined,
      socialCommerceMinhaLoja: flags.socialCommerceMinhaLoja as
        | boolean
        | undefined,
    };
  } catch (error) {
    console.log(
      `      ⚠️ Error during DOM extraction of feature flags: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

// =============================================================================
// TYPES
// =============================================================================

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

  // // =========================================================================
  // // REVIEWS FLAGS (individual)
  // // =========================================================================
  // enable_konfidency_review?: boolean;
  // enable_review_ai_summary?: boolean;
  // enable_review_feedback?: boolean;
  // enable_reviews_filter?: boolean;
  // enable_reviews_sorting?: boolean;
  // enable_image_and_upload_review?: boolean;

  // =========================================================================
  // PRODUCT CARD FLAGS
  // =========================================================================
  enable_product_card_rating?: boolean;
  wl_show_rating_on_product_card?: boolean;
}

// =============================================================================
// COMMERCE FEATURE FLAGS (from /feature-flag endpoint)
// =============================================================================

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
  businessModelB2B2C?: boolean;
  businessModelB2C?: boolean;
  businessModelB2C_B2B2C?: boolean;

  // PDP Features
  displayStockOnProductDetailPage?: boolean;
  newExperiencePdpEnable?: boolean;
  enablePdpFreightCalculation?: boolean;
  enableDisplayFreeShippingPdp?: boolean;
  freeShippingValue?: number;
  nePagesPdV2?: boolean;
  newExperienceEnableGiftPdp?: boolean;

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
}

/** Keys merged by {@link mergeCommerceFeatureFlags} (excludes metadata). */
const COMMERCE_FLAG_DATA_KEYS: (keyof CommerceFeatureFlags)[] = [
  "businessModel",
  "businessModelB2B2C",
  "businessModelB2C",
  "businessModelB2C_B2B2C",
  "displayStockOnProductDetailPage",
  "newExperiencePdpEnable",
  "enablePdpFreightCalculation",
  "enableDisplayFreeShippingPdp",
  "freeShippingValue",
  "nePagesPdV2",
  "newExperienceEnableGiftPdp",
  "giftPackaging",
  "enableGiftOnSite",
  "giftSku",
  "productRecommendation",
  "location",
  "newExperienceEnable",
  "socialCommerce",
  "socialCommerceMinhaLoja",
];

/**
 * Merges network-captured commerce flags with DOM-extracted flags.
 * Prefer defined values from `primary` (typically /feature-flag), then `secondary`.
 */
export function mergeCommerceFeatureFlags(
  primary: CommerceFeatureFlags | null,
  secondary: CommerceFeatureFlags | null,
): CommerceFeatureFlags | null {
  if (!primary && !secondary) {
    return null;
  }
  if (!primary) {
    return secondary;
  }
  if (!secondary) {
    return primary;
  }

  const out: CommerceFeatureFlags = {
    capturedAt: primary.capturedAt || secondary.capturedAt,
    _raw: primary._raw ?? secondary._raw,
  };

  for (const k of COMMERCE_FLAG_DATA_KEYS) {
    const pv = primary[k];
    const sv = secondary[k];
    if (pv !== undefined) {
      (out as unknown as Record<string, unknown>)[k] = pv;
    } else if (sv !== undefined) {
      (out as unknown as Record<string, unknown>)[k] = sv;
    }
  }

  return out;
}

/**
 * Mapping of feature keys to their Remote Config paths
 */
export interface RemoteConfigMapping {
  /** Remote Config key (e.g., "product_reviews") */
  configKey: string;
  /** Path within the config object (e.g., "filter" or "recommendation.enabled") */
  configPath?: string;
}

// =============================================================================
// FEATURE → REMOTE CONFIG MAPPING
// =============================================================================

/**
 * Maps monitor feature keys to their corresponding Remote Config flags
 */
export const FEATURE_REMOTE_CONFIG_MAP: Partial<
  Record<FeatureKey, RemoteConfigMapping>
> = {
  reviews: { configKey: "product_reviews", configPath: "enabled" },
  aiReviewSummary: { configKey: "product_reviews", configPath: "ai_summary" },
  reviewFilter: { configKey: "product_reviews", configPath: "filter" },
  reviewSort: { configKey: "product_reviews", configPath: "sort" },
  reviewPhotos: { configKey: "product_reviews", configPath: "photos" },
  reviewRecommendation: {
    configKey: "product_reviews",
    configPath: "recommendation.enabled",
  },
  shopTheSet: { configKey: "enable_shoptheset_pdp" },
};

// =============================================================================
// LOCALE MAPPING
// =============================================================================

/**
 * Maps country codes to Firebase Remote Config locales
 */
export const COUNTRY_TO_LOCALE: Record<string, string> = {
  BR: "pt-BR",
  AR: "es-AR",
  CL: "es-CL",
  CO: "es-CO",
  MX: "es-MX",
  PE: "es-PE",
};

// =============================================================================
// CAPTURE FUNCTION
// =============================================================================

/**
 * Sets up Firebase Remote Config capture BEFORE navigation.
 * Returns a function to collect results after page load.
 *
 * @param page - Playwright page instance
 * @param locale - Locale string (e.g., "pt-BR", "es-AR")
 * @returns Function that when called returns captured flags
 */
export function setupRemoteConfigCapture(
  page: Page,
  locale: string,
): () => Promise<RemoteConfigFlags | null> {
  const capturedFlags: RemoteConfigFlags = {
    capturedAt: new Date().toISOString(),
    locale,
  };
  let captured = false;

  const responseHandler = async (response: {
    url: () => string;
    status: () => number;
    json: () => Promise<unknown>;
  }) => {
    const url = response.url();

    // Check for Firebase Remote Config responses
    if (url.includes("firebaseremoteconfig") || url.includes("remoteconfig")) {
      try {
        const body = (await response.json()) as {
          entries?: Record<string, string>;
        };

        if (body.entries) {
          const flags = parseRemoteConfigEntries(body.entries, locale);
          Object.assign(capturedFlags, flags);
          capturedFlags._raw = body.entries as unknown as Record<
            string,
            unknown
          >;
          captured = true;
        }
      } catch {
        // Response not JSON or parsing failed - continue
      }
    }
  };

  page.on("response", responseHandler);

  // Return collector function
  return async (): Promise<RemoteConfigFlags | null> => {
    // Give a small delay to ensure any pending responses are processed
    await new Promise((resolve) => setTimeout(resolve, 500));
    page.off("response", responseHandler);

    if (captured && Object.keys(capturedFlags).length > 2) {
      return capturedFlags;
    }
    return null;
  };
}

/** True if URL is likely the commerce BFF feature-flag JSON (not Firebase). */
function matchesCommerceFeatureFlagUrl(url: string): boolean {
  const u = url.toLowerCase();
  if (u.includes("firebase")) {
    return false;
  }
  return (
    u.includes("feature-flag") ||
    u.includes("feature-flags") ||
    u.includes("featureflags")
  );
}

/**
 * Sets up Commerce Feature Flags capture BEFORE navigation.
 * Captures responses from /feature-flag endpoint.
 *
 * @param page - Playwright page instance
 * @returns Function that when called returns captured commerce flags
 */
export function setupCommerceFeatureFlagCapture(
  page: Page,
): () => Promise<CommerceFeatureFlags | null> {
  let capturedFlags: CommerceFeatureFlags | null = null;
  const pending = new Set<Promise<void>>();

  const processCommerceJson = async (response: {
    json: () => Promise<unknown>;
  }) => {
    try {
      const body = (await response.json()) as Record<string, unknown>;

      capturedFlags = {
        capturedAt: new Date().toISOString(),
        _raw: body,
        // Business Model
        businessModel: body.businessModel as string | undefined,
        businessModelB2B2C: body.businessModelB2B2C as boolean | undefined,
        businessModelB2C: body.businessModelB2C as boolean | undefined,
        businessModelB2C_B2B2C: body.businessModelB2C_B2B2C as
          | boolean
          | undefined,
        // PDP Features
        displayStockOnProductDetailPage:
          body.displayStockOnProductDetailPage as boolean | undefined,
        newExperiencePdpEnable: body.newExperiencePdpEnable as
          | boolean
          | undefined,
        enablePdpFreightCalculation: body.enablePdpFreightCalculation as
          | boolean
          | undefined,
        enableDisplayFreeShippingPdp: body.enableDisplayFreeShippingPdp as
          | boolean
          | undefined,
        freeShippingValue: body.freeShippingValue as number | undefined,
        nePagesPdV2: body.nePagesPdV2 as boolean | undefined,
        newExperienceEnableGiftPdp: body.newExperienceEnableGiftPdp as
          | boolean
          | undefined,
        // Gift & Packaging
        giftPackaging: body.giftPackaging as boolean | undefined,
        enableGiftOnSite: body.enableGiftOnSite as boolean | undefined,
        giftSku: body.giftSku as string | undefined,

        productRecommendation: body.productRecommendation as
          | boolean
          | undefined,
        location: body.location as boolean | undefined,
        newExperienceEnable: body.newExperienceEnable as boolean | undefined,
        socialCommerce: body.socialCommerce as boolean | undefined,
        socialCommerceMinhaLoja: body.socialCommerceMinhaLoja as
          | boolean
          | undefined,
      };
    } catch {
      // Response not JSON or parsing failed - continue
    }
  };

  const responseHandler = (response: {
    url: () => string;
    status: () => number;
    json: () => Promise<unknown>;
  }) => {
    if (
      !matchesCommerceFeatureFlagUrl(response.url()) ||
      response.status() !== 200
    ) {
      return;
    }
    const p = processCommerceJson(response);
    pending.add(p);
    void p.finally(() => pending.delete(p));
  };

  page.on("response", responseHandler);

  // Return collector function
  return async (): Promise<CommerceFeatureFlags | null> => {
    // Allow in-flight response handlers (async json()) to finish before we read capturedFlags
    await new Promise((resolve) => setTimeout(resolve, 800));
    await Promise.allSettled([...pending]);
    page.off("response", responseHandler);

    // If we captured from network, return it
    if (capturedFlags) {
      return capturedFlags;
    }

    // Try to extract feature flags from the page content
    // The flags might be embedded in __NEXT_DATA__, RSC payload, or React context
    try {
      const pageFlags = await page.evaluate(() => {
        // 1. Try __NEXT_DATA__ script tag (Next.js pages router)
        const nextDataScript = document.getElementById("__NEXT_DATA__");
        if (nextDataScript) {
          try {
            const nextData = JSON.parse(nextDataScript.textContent || "{}");
            if (nextData?.props?.pageProps?.featureFlags) {
              return nextData.props.pageProps.featureFlags;
            }
            if (nextData?.props?.featureFlags) {
              return nextData.props.featureFlags;
            }
          } catch {
            // JSON parse failed
          }
        }

        // 2. Try window globals
        const win = window as unknown as {
          __FEATURE_FLAGS__?: Record<string, unknown>;
          featureFlags?: Record<string, unknown>;
        };
        if (win.__FEATURE_FLAGS__) {
          return win.__FEATURE_FLAGS__;
        }
        if (win.featureFlags) {
          return win.featureFlags;
        }

        // 3. Try to extract from RSC (React Server Components) payload
        // Next.js 13+ App Router serializes data in self.__next_f.push() calls
        const scripts = Array.from(document.querySelectorAll("script"));
        for (const script of scripts) {
          const content = script.textContent || "";
          // Look for featureFlags in RSC payload
          if (
            content.includes("featureFlags") ||
            content.includes("businessModel")
          ) {
            // Try to extract JSON-like structures
            const patterns = [
              /"featureFlags":\s*(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})/,
              /"businessModel":\s*"([^"]+)"/,
              /\["featureFlags",\s*(\{[^}]+\})\]/,
            ];

            for (const pattern of patterns) {
              const match = content.match(pattern);
              if (match && match[1]) {
                try {
                  // If it looks like JSON, parse it
                  if (match[1].startsWith("{")) {
                    return JSON.parse(match[1]);
                  }
                } catch {
                  // Not valid JSON, continue
                }
              }
            }

            // 3b. Escaped RSC format used by Next.js App Router social commerce sites
            // Script textContent contains: \"featureFlags\":{\"key\":value,...}
            const escapedMarker = '\\"featureFlags\\":{';
            const markerIdx = content.indexOf(escapedMarker);
            if (markerIdx >= 0) {
              const braceStart = content.indexOf("{", markerIdx);
              if (braceStart >= 0) {
                let depth = 0;
                let braceEnd = -1;
                for (let k = braceStart; k < content.length; k++) {
                  if (content[k] === "\\" && k + 1 < content.length) {
                    k++; // skip escaped character
                    continue;
                  }
                  if (content[k] === "{") {
                    depth++;
                  } else if (content[k] === "}") {
                    depth--;
                    if (depth === 0) {
                      braceEnd = k;
                      break;
                    }
                  }
                }
                if (braceEnd > braceStart) {
                  const escapedObj = content.substring(
                    braceStart,
                    braceEnd + 1,
                  );
                  // Unescape: \" -> "  and  \\ -> \
                  const unescaped = escapedObj
                    .replace(/\\"/g, '"')
                    .replace(/\\\\/g, "\\");
                  try {
                    return JSON.parse(unescaped);
                  } catch {
                    // Not valid JSON after unescape, continue
                  }
                }
              }
            }
          }
        }

        // 4. Try to find in HTML data attributes or inline scripts
        const htmlContent = document.documentElement.innerHTML;

        // Look for feature flags patterns in HTML
        const businessModelMatch = htmlContent.match(
          /"businessModel"\s*:\s*"([^"]+)"/,
        );
        const guestCheckoutMatch = htmlContent.match(
          /"guestCheckout"\s*:\s*(true|false)/,
        );

        if (businessModelMatch || guestCheckoutMatch) {
          // Try to build a partial flags object from HTML
          const partialFlags: Record<string, unknown> = {};

          const booleanFlags = [
            "newExperiencePdpEnable",
            "displayStockOnProductDetailPage",
            "giftPackaging",
            "enableGiftOnSite",
            "cnBlockSelfBuy",
            "cnRecommendation",
            "productRecommendation",
            "newExperienceEnable",
          ];

          for (const flag of booleanFlags) {
            const regex = new RegExp(`"${flag}"\\s*:\\s*(true|false)`);
            const match = htmlContent.match(regex);
            if (match) {
              partialFlags[flag] = match[1] === "true";
            }
          }

          if (businessModelMatch) {
            partialFlags.businessModel = businessModelMatch[1];
          }

          if (Object.keys(partialFlags).length > 0) {
            return partialFlags;
          }
        }

        return null;
      });

      if (pageFlags && typeof pageFlags === "object") {
        const body = pageFlags as Record<string, unknown>;
        return {
          capturedAt: new Date().toISOString(),
          _raw: body,
          businessModel: body.businessModel as string | undefined,
          businessModelB2B2C: body.businessModelB2B2C as boolean | undefined,
          businessModelB2C: body.businessModelB2C as boolean | undefined,
          businessModelB2C_B2B2C: body.businessModelB2C_B2B2C as
            | boolean
            | undefined,
          displayStockOnProductDetailPage:
            body.displayStockOnProductDetailPage as boolean | undefined,
          newExperiencePdpEnable: body.newExperiencePdpEnable as
            | boolean
            | undefined,
          enablePdpFreightCalculation: body.enablePdpFreightCalculation as
            | boolean
            | undefined,
          enableDisplayFreeShippingPdp: body.enableDisplayFreeShippingPdp as
            | boolean
            | undefined,
          freeShippingValue: body.freeShippingValue as number | undefined,
          nePagesPdV2: body.nePagesPdV2 as boolean | undefined,
          newExperienceEnableGiftPdp: body.newExperienceEnableGiftPdp as
            | boolean
            | undefined,
          giftPackaging: body.giftPackaging as boolean | undefined,
          enableGiftOnSite: body.enableGiftOnSite as boolean | undefined,
          giftSku: body.giftSku as string | undefined,

          productRecommendation: body.productRecommendation as
            | boolean
            | undefined,
          location: body.location as boolean | undefined,
          newExperienceEnable: body.newExperienceEnable as boolean | undefined,
        };
      }
    } catch {
      // Page evaluation failed
    }

    return null;
  };
}

/**
 * Groups commerce flags by category for detailed display
 */
export function getCommerceFlagsByCategory(
  flags: CommerceFeatureFlags | null,
): Record<string, Record<string, unknown>> {
  if (!flags) {
    return {};
  }

  const categories: Record<string, Record<string, unknown>> = {};

  // PDP Features
  const pdpFlags: Record<string, unknown> = {};
  if (flags.displayStockOnProductDetailPage !== undefined) {
    pdpFlags.displayStockOnProductDetailPage =
      flags.displayStockOnProductDetailPage;
  }
  if (flags.newExperiencePdpEnable !== undefined) {
    pdpFlags.newExperiencePdpEnable = flags.newExperiencePdpEnable;
  }
  if (flags.enablePdpFreightCalculation !== undefined) {
    pdpFlags.enablePdpFreightCalculation = flags.enablePdpFreightCalculation;
  }
  if (flags.enableDisplayFreeShippingPdp !== undefined) {
    pdpFlags.enableDisplayFreeShippingPdp = flags.enableDisplayFreeShippingPdp;
  }
  if (flags.freeShippingValue !== undefined) {
    pdpFlags.freeShippingValue = flags.freeShippingValue;
  }
  if (flags.nePagesPdV2 !== undefined) {
    pdpFlags.nePagesPdV2 = flags.nePagesPdV2;
  }
  if (flags.newExperienceEnableGiftPdp !== undefined) {
    pdpFlags.newExperienceEnableGiftPdp = flags.newExperienceEnableGiftPdp;
  }
  if (Object.keys(pdpFlags).length > 0) {
    categories["🛍️ PDP Features"] = pdpFlags;
  }

  // Gift & Packaging
  const giftFlags: Record<string, unknown> = {};
  if (flags.giftPackaging !== undefined) {
    giftFlags.giftPackaging = flags.giftPackaging;
  }
  if (flags.enableGiftOnSite !== undefined) {
    giftFlags.enableGiftOnSite = flags.enableGiftOnSite;
  }
  if (flags.giftSku !== undefined) {
    giftFlags.giftSku = flags.giftSku;
  }
  if (Object.keys(giftFlags).length > 0) {
    categories["🎁 Gift & Packaging"] = giftFlags;
  }

  // Other
  const otherFlags: Record<string, unknown> = {};

  if (flags.newExperienceEnable !== undefined) {
    otherFlags.newExperienceEnable = flags.newExperienceEnable;
  }
  if (Object.keys(otherFlags).length > 0) {
    categories["🔧 Other Commerce"] = otherFlags;
  }

  return categories;
}

/**
 * Counts total captured commerce flags
 */
export function countCommerceFlags(flags: CommerceFeatureFlags | null): number {
  if (!flags) {
    return 0;
  }

  const flagKeys = Object.keys(flags).filter(
    (k) =>
      k !== "_raw" &&
      k !== "capturedAt" &&
      flags[k as keyof CommerceFeatureFlags] !== undefined,
  );

  return flagKeys.length;
}

/**
 * @deprecated Use setupRemoteConfigCapture instead (sets up listener BEFORE navigation)
 *
 * Captures Firebase Remote Config during page navigation.
 * Note: This only works if called before navigation happens.
 */
export async function captureRemoteConfig(
  page: Page,
  locale: string,
  timeoutMs = 10000,
): Promise<RemoteConfigFlags | null> {
  return new Promise((resolve) => {
    let resolved = false;
    const capturedFlags: RemoteConfigFlags = {
      capturedAt: new Date().toISOString(),
      locale,
    };

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        // Return what we have, even if incomplete
        if (Object.keys(capturedFlags).length > 2) {
          resolve(capturedFlags);
        } else {
          resolve(null);
        }
      }
    }, timeoutMs);

    const responseHandler = async (response: {
      url: () => string;
      status: () => number;
      json: () => Promise<unknown>;
    }) => {
      const url = response.url();

      // Check for Firebase Remote Config responses
      if (
        url.includes("firebaseremoteconfig") ||
        url.includes("remoteconfig")
      ) {
        try {
          const body = (await response.json()) as {
            entries?: Record<string, string>;
          };

          if (body.entries) {
            const flags = parseRemoteConfigEntries(body.entries, locale);
            Object.assign(capturedFlags, flags);
            capturedFlags._raw = body.entries as unknown as Record<
              string,
              unknown
            >;

            // We got the config, resolve
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              page.off("response", responseHandler);
              resolve(capturedFlags);
            }
          }
        } catch {
          // Response not JSON or parsing failed - continue waiting
        }
      }
    };

    page.on("response", responseHandler);
  });
}

/**
 * Parses Firebase Remote Config entries and extracts locale-specific values
 */
function parseRemoteConfigEntries(
  entries: Record<string, string>,
  locale: string,
): Partial<RemoteConfigFlags> {
  const flags: Partial<RemoteConfigFlags> = {};

  // Parse product_reviews
  if (entries.product_reviews) {
    try {
      const parsed = JSON.parse(entries.product_reviews);
      const localeValue = parsed[locale] || parsed["pt-BR"]; // fallback to pt-BR
      if (localeValue) {
        flags.product_reviews = localeValue;
      }
    } catch {
      // Invalid JSON
    }
  }

  // Parse ALL boolean flags (including locale-specific ones)
  const booleanFlags = [
    // PDP flags
    "pdp_new_experience",
    "disable_omni_pickup_tab_on_pdp",
    "enable_descount_amount_tag_pdp",
    "enable_gift_pdp_new_experience",
    "enable_pdp_review",
    "enable_vto_pdp",
    "enable_shoptheset_pdp",
    "enable_shoptheset_pdp_einstein",
    "wl_target_personalization_pdp_showcase",
    "wl_target_personalization_pdp_showcase_v2",
    // Reviews flags
    // "enable_konfidency_review",
    // "enable_review_ai_summary",
    // "enable_review_feedback",
    // "enable_reviews_filter",
    // "enable_reviews_sorting",
    // "enable_image_and_upload_review",
    // Product card flags
    "enable_product_card_rating",
    "wl_show_rating_on_product_card",
  ] as const;

  for (const key of booleanFlags) {
    if (entries[key]) {
      try {
        const parsed = JSON.parse(entries[key]);
        // Could be a boolean or locale-keyed object
        if (typeof parsed === "boolean") {
          flags[key] = parsed;
        } else if (typeof parsed === "object" && parsed !== null) {
          flags[key] = parsed[locale] ?? parsed["pt-BR"] ?? false;
        }
      } catch {
        // Try direct boolean
        flags[key] = entries[key] === "true";
      }
    }
  }

  return flags;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Checks if a feature is enabled according to Remote Config flags
 *
 * @param featureKey - The monitor feature key
 * @param flags - Captured remote config flags (or null if not captured)
 * @returns Object with `enabled` boolean and `flagValue` for the report
 */
export function isFeatureEnabledByRemoteConfig(
  featureKey: FeatureKey,
  flags: RemoteConfigFlags | null,
): { enabled: boolean; flagValue: unknown; flagKey?: string } {
  // If no flags captured, assume feature is enabled (don't break existing behavior)
  if (!flags) {
    return { enabled: true, flagValue: undefined };
  }

  const mapping = FEATURE_REMOTE_CONFIG_MAP[featureKey];
  if (!mapping) {
    // No mapping for this feature - assume enabled
    return { enabled: true, flagValue: undefined };
  }

  const configValue = flags[mapping.configKey as keyof RemoteConfigFlags];
  if (configValue === undefined) {
    // Flag not captured - assume enabled
    return { enabled: true, flagValue: undefined, flagKey: mapping.configKey };
  }

  // If there's a path, get nested value
  let value: unknown;
  if (mapping.configPath) {
    value = getNestedValue(configValue, mapping.configPath);
  } else {
    value = configValue;
  }

  const enabled = value === true;
  const flagKey = mapping.configPath
    ? `${mapping.configKey}.${mapping.configPath}`
    : mapping.configKey;

  return { enabled, flagValue: value, flagKey };
}

/**
 * Gets recommendation min_count from Remote Config
 */
export function getRecommendationMinCount(
  flags: RemoteConfigFlags | null,
): number {
  if (!flags?.product_reviews?.recommendation?.min_count) {
    return 4; // Default fallback
  }
  return flags.product_reviews.recommendation.min_count;
}

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
  if (Object.keys(pdpFlags).length > 0) {
    categories["🛍️ PDP Features"] = pdpFlags;
  }

  // // Individual Reviews Flags
  // const reviewFlags: Record<string, unknown> = {};
  // if (flags.enable_konfidency_review !== undefined) {
  //   reviewFlags.enable_konfidency_review = flags.enable_konfidency_review;
  // }
  // if (flags.enable_review_ai_summary !== undefined) {
  //   reviewFlags.enable_review_ai_summary = flags.enable_review_ai_summary;
  // }
  // if (flags.enable_review_feedback !== undefined) {
  //   reviewFlags.enable_review_feedback = flags.enable_review_feedback;
  // }
  // if (flags.enable_reviews_filter !== undefined) {
  //   reviewFlags.enable_reviews_filter = flags.enable_reviews_filter;
  // }
  // if (flags.enable_reviews_sorting !== undefined) {
  //   reviewFlags.enable_reviews_sorting = flags.enable_reviews_sorting;
  // }
  // if (flags.enable_image_and_upload_review !== undefined) {
  //   reviewFlags.enable_image_and_upload_review =
  //     flags.enable_image_and_upload_review;
  // }
  // if (Object.keys(reviewFlags).length > 0) {
  //   categories["⭐ Reviews (individual)"] = reviewFlags;
  // }

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
