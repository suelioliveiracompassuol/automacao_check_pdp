/**
 * Firebase Remote Config: captured from the page's own fetch (set up before navigation) and
 * parsed for the page's locale.
 */

import { Page } from "@playwright/test";
import { TIMING } from "../configs/config.js";
import { FEATURE_REMOTE_CONFIG_MAP } from "./featureGates.js";
import type { RemoteConfigFlags } from "./types.js";

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

/**
 * Remote Config keys behind `requireCaptured` features: read only for the page's locale, so a
 * LATAM operation doesn't inherit Brazil's value and check a module that isn't there.
 */
const STRICT_LOCALE_KEYS = new Set(
  Object.values(FEATURE_REMOTE_CONFIG_MAP)
    .filter((m) => m?.requireCaptured)
    .flatMap((m) => [
      m!.configKey,
      ...(m!.requiresAnyOf ?? []).map((d) => d.configKey),
    ]),
);

/** Value of a locale-keyed Remote Config object (pt-BR fallback unless the key is strict). */
function localeValue(
  parsed: Record<string, unknown>,
  key: string,
  locale: string,
): unknown {
  return STRICT_LOCALE_KEYS.has(key)
    ? parsed[locale]
    : (parsed[locale] ?? parsed["pt-BR"]);
}

/**
 * Sets up Firebase Remote Config capture BEFORE navigation.
 * Returns a function to collect results after page load.
 *
 * @param page - Playwright page instance
 * @param locale - Locale string (e.g., "pt-BR", "es-AR")
 * @returns Function that when called returns captured flags, waiting up to `maxWaitMs`
 *   for the first Remote Config response
 */
export function setupRemoteConfigCapture(
  page: Page,
  locale: string,
): (maxWaitMs?: number) => Promise<RemoteConfigFlags | null> {
  const capturedFlags: RemoteConfigFlags = {
    capturedAt: new Date().toISOString(),
    locale,
  };
  let captured = false;
  const pending = new Set<Promise<void>>();
  let markCaptured: () => void = () => {};
  const capturedSignal = new Promise<void>((resolve) => {
    markCaptured = resolve;
  });

  const processRemoteConfigJson = async (response: {
    json: () => Promise<unknown>;
  }) => {
    try {
      const body = (await response.json()) as {
        entries?: Record<string, string>;
      };

      if (body.entries) {
        // Several responses (templates / refetches) are merged
        const flags = parseRemoteConfigEntries(body.entries, locale);
        Object.assign(capturedFlags, flags);
        capturedFlags._raw = {
          ...capturedFlags._raw,
          ...(body.entries as unknown as Record<string, unknown>),
        };
        captured = true;
        markCaptured();
      }
    } catch {
      // Response not JSON or parsing failed - continue
    }
  };

  const responseHandler = (response: {
    url: () => string;
    status: () => number;
    json: () => Promise<unknown>;
  }) => {
    const url = response.url();

    // Check for Firebase Remote Config responses
    if (url.includes("firebaseremoteconfig") || url.includes("remoteconfig")) {
      const p = processRemoteConfigJson(response);
      pending.add(p);
      void p.finally(() => pending.delete(p));
    }
  };

  page.on("response", responseHandler);

  // Return collector function
  return async (
    maxWaitMs: number = TIMING.remoteConfigWait,
  ): Promise<RemoteConfigFlags | null> => {
    // Some sites (e.g. Natura AR) only fetch Remote Config ~12 s after navigation,
    // after the scroll pass is over — wait for it instead of a fixed short delay
    let timer: NodeJS.Timeout | undefined;
    await Promise.race([
      capturedSignal,
      new Promise((resolve) => {
        timer = setTimeout(resolve, maxWaitMs);
      }),
    ]);
    clearTimeout(timer);
    // Short grace for follow-up responses (a second template or a refetch) and in-flight json()
    await new Promise((resolve) =>
      setTimeout(resolve, TIMING.remoteConfigGrace),
    );
    await Promise.allSettled([...pending]);
    page.off("response", responseHandler);

    if (captured && Object.keys(capturedFlags).length > 2) {
      return capturedFlags;
    }
    return null;
  };
}

/**
 * Parses Firebase Remote Config entries and extracts locale-specific values
 */
export function parseRemoteConfigEntries(
  entries: Record<string, string>,
  locale: string,
): Partial<RemoteConfigFlags> {
  const flags: Partial<RemoteConfigFlags> = {};

  // Parse locale-keyed config objects
  const objectFlags = [
    "product_reviews",
    "gift_search_category_cart",
    "gift_module_pdp",
    "enable_module_gift_cart",
  ] as const;

  for (const key of objectFlags) {
    if (entries[key]) {
      try {
        const value = localeValue(JSON.parse(entries[key]), key, locale);
        if (value) {
          (flags as Record<string, unknown>)[key] = value;
        }
      } catch {
        // Invalid JSON
      }
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
    "enable_image_zoom_pdp_web_responsive",
    "enable_media_video_carousel_pdp",
    "free_freight_tag",
    "enable_coupons_pdp",
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
          const value = localeValue(parsed, key, locale);
          if (value !== undefined || !STRICT_LOCALE_KEYS.has(key)) {
            flags[key] = (value ?? false) as boolean;
          }
        }
      } catch {
        // Try direct boolean
        flags[key] = entries[key] === "true";
      }
    }
  }

  return flags;
}
