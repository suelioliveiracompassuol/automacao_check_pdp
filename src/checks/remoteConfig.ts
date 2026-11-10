/**
 * Feature flags read by the Web monitor: Firebase Remote Config and Commerce feature flags.
 *
 * Split by responsibility under ./remote-config/ (this file keeps the import path used across
 * the monitor, the Android checks and the tests):
 * - types.ts: shapes of the captured flags and of the feature → flag mapping
 * - featureGates.ts: FEATURE_REMOTE_CONFIG_MAP / FEATURE_COMMERCE_FLAG_MAP and the gates
 * - firebase.ts: Remote Config capture and per-locale parsing
 * - commerceFlags.ts: Commerce /feature-flag capture, DOM fallback and merge
 * - logging.ts: flag summaries for the run log
 */

export * from "./remote-config/types.js";
export * from "./remote-config/featureGates.js";
export * from "./remote-config/firebase.js";
export * from "./remote-config/commerceFlags.js";
export * from "./remote-config/logging.js";
