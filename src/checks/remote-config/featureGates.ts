/**
 * Which flag gates each feature, and whether the captured flags let it run.
 */

import { FeatureKey } from "../../types.js";
import { getNestedValue } from "../../utils.js";
import type {
  CommerceFeatureFlags,
  FlagGateResult,
  RemoteConfigFlags,
  RemoteConfigMapping,
} from "./types.js";

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
  coupons: { configKey: "enable_coupons_pdp", requireCaptured: true },
  giftModule: {
    configKey: "gift_module_pdp",
    configPath: "enabled",
    requireCaptured: true,
    requiresAnyOf: [
      {
        configKey: "enable_module_gift_cart",
        configPath: "enable_module_gift_web.card_message",
      },
      {
        configKey: "enable_module_gift_cart",
        configPath: "enable_module_gift_web.search_bag",
      },
    ],
  },
};

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
): FlagGateResult {
  const mapping = FEATURE_REMOTE_CONFIG_MAP[featureKey];
  if (!mapping) {
    // No mapping for this feature - assume enabled
    return { enabled: true, flagValue: undefined };
  }

  // If no flags captured, assume feature is enabled (don't break existing behavior)
  if (!flags && !mapping.requireCaptured) {
    return { enabled: true, flagValue: undefined };
  }

  const flagKey = mapping.configPath
    ? `${mapping.configKey}.${mapping.configPath}`
    : mapping.configKey;

  const configValue = flags?.[mapping.configKey as keyof RemoteConfigFlags];
  if (configValue === undefined) {
    // Flag not captured - assume enabled (don't break existing behavior),
    // unless the feature only exists behind the flag
    return mapping.requireCaptured
      ? { enabled: false, flagValue: undefined, flagKey, notCaptured: true }
      : { enabled: true, flagValue: undefined, flagKey: mapping.configKey };
  }

  // If there's a path, get nested value
  let value: unknown;
  if (mapping.configPath) {
    value = getNestedValue(configValue, mapping.configPath);
  } else {
    value = configValue;
  }

  if (value === undefined && mapping.requireCaptured) {
    return { enabled: false, flagValue: undefined, flagKey, notCaptured: true };
  }

  const enabled = value === true;

  if (enabled && mapping.requiresAnyOf && flags) {
    const deps = mapping.requiresAnyOf.map((dep) => {
      const depConfig = flags[dep.configKey as keyof RemoteConfigFlags];
      return {
        key: dep.configPath
          ? `${dep.configKey}.${dep.configPath}`
          : dep.configKey,
        value: dep.configPath
          ? getNestedValue(depConfig, dep.configPath)
          : depConfig,
      };
    });
    const captured = deps.filter((d) => d.value !== undefined);
    if (captured.length === 0 && mapping.requireCaptured) {
      return {
        enabled: false,
        flagValue: undefined,
        flagKey: deps.map((d) => d.key).join(" | "),
        notCaptured: true,
      };
    }
    if (captured.length > 0 && !captured.some((d) => d.value === true)) {
      return {
        enabled: false,
        flagValue: Object.fromEntries(captured.map((d) => [d.key, d.value])),
        flagKey: captured.map((d) => d.key).join(" | "),
      };
    }
  }

  return { enabled, flagValue: value, flagKey };
}

/**
 * Maps monitor feature keys to the Commerce feature flag that also gates them
 */
export const FEATURE_COMMERCE_FLAG_MAP: Partial<
  Record<FeatureKey, keyof CommerceFeatureFlags>
> = {
  coupons: "couponCenter",
};

/**
 * Checks if a feature is enabled according to Commerce feature flags.
 * Only an explicit `false` disables it; a flag not captured assumes enabled.
 */
export function isFeatureEnabledByCommerceFlags(
  featureKey: FeatureKey,
  flags: CommerceFeatureFlags | null,
): FlagGateResult {
  const flagKey = FEATURE_COMMERCE_FLAG_MAP[featureKey];
  if (!flagKey) {
    return { enabled: true, flagValue: undefined };
  }
  const value = flags?.[flagKey];
  return { enabled: value !== false, flagValue: value, flagKey };
}
