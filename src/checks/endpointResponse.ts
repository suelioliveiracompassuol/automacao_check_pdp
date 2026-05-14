/**
 * Endpoint Response Monitor
 *
 * Intercepts network calls made during PDP navigation and validates
 * their HTTP status + optionally validates the response body.
 */

import { Page } from "@playwright/test";
import { CheckResult } from "../types.js";

export interface EndpointRule {
  /** Unique key for this rule, used in CheckResult.featureKey */
  key: string;
  /** Display name shown in report */
  name: string;
  /** Substring or regex string to match the URL */
  match: string;
  /** Optional: HTTP methods to capture. Defaults to any. */
  methods?: string[];
  /** Optional: expected HTTP status code(s). Default: any < 400 is ok. */
  expectedStatuses?: number[];
  /** Optional: field path(s) that must exist in the JSON body (e.g. "data.productId") */
  requiredFields?: string[];
  /** Optional: field path that must be non-empty / truthy */
  nonEmptyFields?: string[];
}

interface CapturedCall {
  url: string;
  method: string;
  status: number;
  bodyJson?: unknown;
  bodyError?: string;
}

/**
 * Utility: access nested object value by dot-path ("data.product.id")
 */
function getNestedValue(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc !== null && acc !== undefined && typeof acc === "object") {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Sets up response listeners for the given rules.
 * Must be called BEFORE page.goto() to capture all calls.
 * Returns a function that, when called, produces the CheckResults.
 */
export function setupEndpointMonitor(
  page: Page,
  rules: EndpointRule[],
): () => Promise<CheckResult[]> {
  const captured: Map<string, CapturedCall[]> = new Map(
    rules.map((r) => [r.key, []]),
  );

  page.on("response", async (response) => {
    const url = response.url();
    const method = response.request().method();
    const status = response.status();

    for (const rule of rules) {
      if (!url.includes(rule.match)) continue;
      if (rule.methods && !rule.methods.includes(method)) continue;

      let bodyJson: unknown = undefined;
      let bodyError: string | undefined = undefined;

      const contentType = response.headers()["content-type"] ?? "";
      if (
        contentType.includes("application/json") ||
        contentType.includes("text/plain")
      ) {
        try {
          bodyJson = await response.json().catch(async () => {
            const text = await response.text().catch(() => "");
            try {
              return JSON.parse(text);
            } catch {
              bodyError = text.slice(0, 200) || "empty body";
              return undefined;
            }
          });
        } catch {
          bodyError = "failed to parse response body";
        }
      }

      captured
        .get(rule.key)!
        .push({ url, method, status, bodyJson, bodyError });
    }
  });

  return async (): Promise<CheckResult[]> => {
    const results: CheckResult[] = [];

    for (const rule of rules) {
      const calls = captured.get(rule.key) ?? [];
      const result = evaluateRule(rule, calls);
      results.push(result);
    }

    return results;
  };
}

function evaluateRule(rule: EndpointRule, calls: CapturedCall[]): CheckResult {
  const featureKey = `endpoint_${rule.key}`;
  const feature = `🌐 ${rule.name}`;

  if (calls.length === 0) {
    return {
      feature,
      featureKey,
      passed: false,
      status: "fail",
      message: `Nenhuma chamada capturada para endpoint contendo "${rule.match}"`,
    };
  }

  const failedStatus = calls.filter((c) => {
    const expected = rule.expectedStatuses;
    if (expected) return !expected.includes(c.status);
    return c.status >= 400;
  });

  if (failedStatus.length > 0) {
    return {
      feature,
      featureKey,
      passed: false,
      status: "fail",
      message: `${failedStatus.length}/${calls.length} chamada(s) retornaram status inesperado: ${failedStatus.map((c) => c.status).join(", ")}`,
      details: {
        match: rule.match,
        totalCalls: calls.length,
        failedCalls: failedStatus.map((c) => ({
          method: c.method,
          status: c.status,
          url: c.url,
        })),
      },
    };
  }

  // Validate body fields (check the first successful call with a body)
  if (rule.requiredFields || rule.nonEmptyFields) {
    const callsWithBody = calls.filter((c) => c.bodyJson !== undefined);

    if (callsWithBody.length === 0) {
      return {
        feature,
        featureKey,
        passed: false,
        status: "fail",
        message: `${calls.length} chamada(s) ok, mas nenhum body JSON capturado para validação`,
        details: { match: rule.match, totalCalls: calls.length },
      };
    }

    const bodyErrors: string[] = [];

    for (const call of callsWithBody) {
      if (rule.requiredFields) {
        for (const field of rule.requiredFields) {
          const value = getNestedValue(call.bodyJson, field);
          if (value === undefined || value === null) {
            bodyErrors.push(
              `Campo obrigatório ausente: "${field}" em ${new URL(call.url).pathname}`,
            );
          }
        }
      }

      if (rule.nonEmptyFields) {
        for (const field of rule.nonEmptyFields) {
          const value = getNestedValue(call.bodyJson, field);
          const isEmpty =
            value === undefined ||
            value === null ||
            value === "" ||
            (Array.isArray(value) && value.length === 0);
          if (isEmpty) {
            bodyErrors.push(
              `Campo vazio ou ausente: "${field}" em ${new URL(call.url).pathname}`,
            );
          }
        }
      }
    }

    if (bodyErrors.length > 0) {
      return {
        feature,
        featureKey,
        passed: false,
        status: "fail",
        message: `Body inválido: ${bodyErrors.slice(0, 2).join("; ")}`,
        details: {
          match: rule.match,
          totalCalls: calls.length,
          bodyErrors,
          sample: JSON.stringify(callsWithBody[0]?.bodyJson).slice(0, 400),
        },
      };
    }
  }

  const sampleCall = calls[0];
  const bodyPreview =
    sampleCall.bodyJson !== undefined
      ? JSON.stringify(sampleCall.bodyJson).slice(0, 200)
      : (sampleCall.bodyError ?? "sem body");

  return {
    feature,
    featureKey,
    passed: true,
    status: "pass",
    message: `${calls.length} chamada(s) ok (status ${[...new Set(calls.map((c) => c.status))].join(", ")})`,
    details: {
      match: rule.match,
      totalCalls: calls.length,
      calls: calls
        .slice(0, 5)
        .map((c) => ({ method: c.method, status: c.status, url: c.url })),
      bodyPreview,
    },
  };
}
