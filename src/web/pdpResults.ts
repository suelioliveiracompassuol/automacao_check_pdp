/**
 * Verdicts of a PDP that don't come from a checker: the legacy single-substring endpoint check
 * (ENDPOINT_MATCH) and whether the PDP as a whole passed. Pure.
 */

import { FEATURES } from "../checks/configs/features.js";
import type { CheckResult } from "../types.js";

export interface EndpointCall {
  url: string;
  method: string;
  status: number;
}

/** Result of the ENDPOINT_MATCH check from the calls captured for it. */
export function legacyEndpointResult(endpointMatch: string, calls: EndpointCall[]): CheckResult {
  const base = { feature: "Resposta de endpoint", featureKey: "endpointResponse" };
  const failedCalls = calls.filter((c) => c.status >= 400);

  if (calls.length === 0) {
    return {
      ...base,
      passed: false,
      status: "fail",
      message: `Nenhuma chamada capturada para o endpoint contendo "${endpointMatch}"`,
    };
  }
  if (failedCalls.length > 0) {
    return {
      ...base,
      passed: false,
      status: "fail",
      message: `${failedCalls.length}/${calls.length} chamada(s) com erro (>= 400) para "${endpointMatch}"`,
      details: {
        endpointMatch,
        totalCalls: calls.length,
        failedCalls: failedCalls.map((c) => ({ method: c.method, status: c.status, url: c.url })),
      },
    };
  }
  return {
    ...base,
    passed: true,
    status: "pass",
    message: `${calls.length} chamada(s) ok para endpoint contendo "${endpointMatch}"`,
    details: {
      endpointMatch,
      totalCalls: calls.length,
      calls: calls.slice(0, 10).map((c) => ({ method: c.method, status: c.status, url: c.url })),
    },
  };
}

/**
 * Whether a result counts for the PDP verdict: non-optional catalog features, the structured
 * endpoint results, the i18n check and (when ENDPOINT_MATCH is set) the legacy endpoint check.
 */
export function isRequiredResult(result: CheckResult, legacyEndpointCheck: boolean): boolean {
  if (result.featureKey.startsWith("endpoint_") || result.featureKey === "i18nKeys") {
    return true;
  }
  if (legacyEndpointCheck && result.featureKey === "endpointResponse") {
    return true;
  }
  const config = FEATURES.find((fc) => fc.key === result.featureKey);
  return !!config && !config.optional;
}

/** A PDP passes when every required result passed, is N/A or is disabled by a flag. */
export function isPdpSuccessful(features: CheckResult[], legacyEndpointCheck: boolean): boolean {
  return features
    .filter((f) => isRequiredResult(f, legacyEndpointCheck))
    .every((f) => f.passed || f.status === "na" || f.status === "disabled");
}
