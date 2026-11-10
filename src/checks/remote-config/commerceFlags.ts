/**
 * Commerce feature flags (BFF /feature-flag): captured from the network, with the flags
 * embedded in the page as a fallback.
 */

import { Page } from "@playwright/test";
import type { CommerceFeatureFlags } from "./types.js";

/** Keys merged by {@link mergeCommerceFeatureFlags} (excludes metadata). */
const COMMERCE_FLAG_DATA_KEYS: (keyof CommerceFeatureFlags)[] = [
  "businessModel",
  "displayStockOnProductDetailPage",
  "newExperiencePdpEnable",
  "enablePdpFreightCalculation",
  "enableDisplayFreeShippingPdp",
  "freeShippingValue",
  "nePagesPdV2",
  "giftPackaging",
  "enableGiftOnSite",
  "giftSku",
  "productRecommendation",
  "location",
  "newExperienceEnable",
  "socialCommerce",
  "socialCommerceMinhaLoja",
  "couponCenter",
];

/** Non-boolean entries of {@link COMMERCE_FLAG_DATA_KEYS}. */
const COMMERCE_NON_BOOLEAN_KEYS = new Set<keyof CommerceFeatureFlags>([
  "businessModel",
  "freeShippingValue",
  "giftSku",
]);

/** Boolean flags scraped from the HTML when no feature-flag object is found (extras stay in `_raw`). */
const COMMERCE_HTML_BOOLEAN_FLAGS: string[] = [
  ...COMMERCE_FLAG_DATA_KEYS.filter((k) => !COMMERCE_NON_BOOLEAN_KEYS.has(k)),
  "cnBlockSelfBuy",
  "cnRecommendation",
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

/** Maps a raw /feature-flag JSON body to {@link CommerceFeatureFlags}. */
export function parseCommerceFeatureFlags(
  body: Record<string, unknown>,
): CommerceFeatureFlags {
  const flags: CommerceFeatureFlags = {
    capturedAt: new Date().toISOString(),
    _raw: body,
  };
  for (const k of COMMERCE_FLAG_DATA_KEYS) {
    if (body[k] !== undefined) {
      (flags as unknown as Record<string, unknown>)[k] = body[k];
    }
  }
  return flags;
}

/** True if URL is likely the commerce BFF feature-flag JSON (not Firebase). */
export function matchesCommerceFeatureFlagUrl(url: string): boolean {
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
 * Commerce flags embedded in the page when the /feature-flag call wasn't seen: __NEXT_DATA__,
 * window globals, the RSC payload (plain or escaped) or loose flags in the HTML.
 */
export async function readCommerceFlagsFromPage(
  page: Page,
): Promise<CommerceFeatureFlags | null> {
  try {
    const pageFlags = await page.evaluate((booleanFlags) => {
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
    }, COMMERCE_HTML_BOOLEAN_FLAGS);

    if (pageFlags && typeof pageFlags === "object") {
      return parseCommerceFeatureFlags(pageFlags as Record<string, unknown>);
    }
  } catch {
    // Page evaluation failed
  }

  return null;
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
      capturedFlags = parseCommerceFeatureFlags(body);
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

    // Flags embedded in __NEXT_DATA__, the RSC payload or window globals
    return readCommerceFlagsFromPage(page);
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
  if (flags.couponCenter !== undefined) {
    otherFlags.couponCenter = flags.couponCenter;
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
