/**
 * What a Web run checks: env-driven filters (set by workflow_dispatch inputs or locally) and the
 * SKU selection they produce. Pure; the orchestrator (src/index.ts) passes process.env.
 */

import type { SkuConfig } from "../types.js";

/** Features checked in MODE=smoke (quick healthcheck). */
export const SMOKE_FEATURES = ["images", "addToCart"];

export interface RunOptions {
  /** FEATURES_FILTER: feature keys to check (null = all applicable). */
  featuresFilter: Set<string> | null;
  /** OPERATIONS_FILTER: operation keys as {@link operationKey} (e.g. "natura-BR", "natura-BR-social"). */
  operationsFilter: string[] | null;
  /** SKU_FILTER: SKU codes. */
  skuFilter: string[] | null;
  /** ENDPOINT_MATCH: legacy single-substring endpoint check. */
  endpointMatch: string | null;
  /** Structured endpoint validation (MONITOR_ENDPOINTS=false turns it off). */
  monitorEndpoints: boolean;
  /** MODE=smoke: 1 SKU per operation, {@link SMOKE_FEATURES} only. */
  isSmokeMode: boolean;
}

const commaList = (value: string | undefined): string[] | null =>
  value?.trim()
    ? value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
    : null;

export function parseRunOptions(env: NodeJS.ProcessEnv): RunOptions {
  const features = commaList(env.FEATURES_FILTER);
  return {
    featuresFilter: features ? new Set(features) : null,
    operationsFilter: commaList(env.OPERATIONS_FILTER),
    skuFilter: commaList(env.SKU_FILTER),
    endpointMatch: env.ENDPOINT_MATCH?.trim() ? env.ENDPOINT_MATCH.trim() : null,
    monitorEndpoints: env.MONITOR_ENDPOINTS !== "false",
    isSmokeMode: env.MODE === "smoke",
  };
}

/** Operation of a SKU as used by OPERATIONS_FILTER and the per-domain groups: "natura-BR", "natura-BR-social". */
export function operationKey(sku: SkuConfig): string {
  return `${sku.vendor}-${sku.country}${(sku.channel || "ecommerce") === "socialcommerce" ? "-social" : ""}`;
}

/**
 * SKUs to check and the features filter in effect, after the operations / SKU filters and smoke
 * mode (which narrows the features to {@link SMOKE_FEATURES}, intersected with FEATURES_FILTER,
 * and keeps the first SKU of each operation).
 */
export function selectSkus(
  skus: SkuConfig[],
  options: RunOptions,
): { skus: SkuConfig[]; featuresFilter: Set<string> | null } {
  const { operationsFilter, skuFilter, isSmokeMode } = options;
  let selected = operationsFilter ? skus.filter((sku) => operationsFilter.includes(operationKey(sku))) : skus;
  if (skuFilter) {
    selected = selected.filter((sku) => skuFilter.includes(sku.sku));
  }

  let featuresFilter = options.featuresFilter;
  if (isSmokeMode) {
    featuresFilter = featuresFilter
      ? new Set(SMOKE_FEATURES.filter((f) => featuresFilter!.has(f)))
      : new Set(SMOKE_FEATURES);
    const seen = new Set<string>();
    selected = selected.filter((sku) => {
      const key = operationKey(sku);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  return { skus: selected, featuresFilter };
}

/** SKUs grouped by operation, in first-seen order (same-origin requests stay serial per group). */
export function groupByOperation(skus: SkuConfig[]): Map<string, SkuConfig[]> {
  const groups = new Map<string, SkuConfig[]>();
  for (const sku of skus) {
    const key = operationKey(sku);
    groups.set(key, [...(groups.get(key) ?? []), sku]);
  }
  return groups;
}

/**
 * Natura LATAM e-commerce runs on Firefox (HTTP2 issues with headless Chromium on those
 * sites); everything else on Chromium.
 */
export function usesFirefox(sku: SkuConfig): boolean {
  return sku.vendor === "natura" && sku.country !== "BR" && (sku.channel || "ecommerce") === "ecommerce";
}
