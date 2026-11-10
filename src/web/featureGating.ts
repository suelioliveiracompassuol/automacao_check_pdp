/**
 * Which of a SKU's applicable features actually run, and the verdict of the ones that don't
 * (N/A for the vendor, disabled or N/A by Remote Config, disabled by a Commerce flag). Pure.
 */

import { isFeatureSupported } from "../checks/configs/config.js";
import { FEATURE_CHECKERS } from "../checks/featureRunner.js";
import {
  isFeatureEnabledByCommerceFlags,
  isFeatureEnabledByRemoteConfig,
  type CommerceFeatureFlags,
  type FlagGateResult,
  type RemoteConfigFlags,
} from "../checks/remoteConfig.js";
import type { CheckResult, FeatureConfig, SkuConfig } from "../types.js";

export interface RunnableCheck {
  featureConfig: FeatureConfig;
  checker: (typeof FEATURE_CHECKERS)[string];
  /** Remote Config gate of the feature (its flag is copied to the result). */
  rcCheck: FlagGateResult;
}

export interface GatedFeatures {
  /** Checks to run on the page. */
  runnable: RunnableCheck[];
  /** Features decided without running a checker. */
  decided: CheckResult[];
  /** Applicable features without a registered checker (logged by the caller). */
  missingCheckers: string[];
}

export function gateFeatures(
  applicableFeatures: FeatureConfig[],
  sku: SkuConfig,
  remoteConfigFlags: RemoteConfigFlags | null,
  commerceFeatureFlags: CommerceFeatureFlags | null,
  checkers: Record<string, RunnableCheck["checker"]> = FEATURE_CHECKERS,
): GatedFeatures {
  const runnable: RunnableCheck[] = [];
  const decided: CheckResult[] = [];
  const missingCheckers: string[] = [];

  for (const featureConfig of applicableFeatures) {
    const checker = checkers[featureConfig.key];
    if (!checker) {
      missingCheckers.push(featureConfig.key);
      continue;
    }
    const base = { feature: featureConfig.name, featureKey: featureConfig.key, passed: true };

    if (!isFeatureSupported(featureConfig, sku.vendor)) {
      decided.push({ ...base, status: "na", message: `N/A para ${sku.vendor}` });
      continue;
    }

    const rcCheck = isFeatureEnabledByRemoteConfig(featureConfig.key, remoteConfigFlags);
    if (rcCheck.notCaptured) {
      // Feature only exists behind a flag that wasn't captured - can't tell if it should show
      decided.push({
        ...base,
        status: "na",
        message: `Flag ${rcCheck.flagKey} não capturada no Remote Config — verificação não se aplica`,
        flagKey: rcCheck.flagKey,
      });
      continue;
    }
    if (!rcCheck.enabled && rcCheck.flagKey) {
      // Feature is disabled by remote config - not an error
      decided.push({
        ...base,
        status: "disabled",
        message: `Desabilitado via Remote Config (${rcCheck.flagKey}=${JSON.stringify(rcCheck.flagValue)})`,
        flagKey: rcCheck.flagKey,
        flagValue: rcCheck.flagValue,
      });
      continue;
    }

    // Some features are also gated by a Commerce feature flag (e.g. coupons → couponCenter)
    const commerceCheck = isFeatureEnabledByCommerceFlags(featureConfig.key, commerceFeatureFlags);
    if (!commerceCheck.enabled && commerceCheck.flagKey) {
      decided.push({
        ...base,
        status: "disabled",
        message: `Desabilitado via Commerce Feature Flag (${commerceCheck.flagKey}=${JSON.stringify(commerceCheck.flagValue)})`,
        flagKey: commerceCheck.flagKey,
        flagValue: commerceCheck.flagValue,
      });
      continue;
    }

    runnable.push({ featureConfig, checker, rcCheck });
  }

  return { runnable, decided, missingCheckers };
}
