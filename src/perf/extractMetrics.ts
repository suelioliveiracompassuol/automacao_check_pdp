import {
  PerfMetrics,
  PerfLcpElement,
  PerfOpportunity,
} from "./types.js";

export type Lhr = {
  lighthouseVersion?: string;
  finalDisplayedUrl?: string;
  runtimeError?: { code: string; message: string };
  categories?: {
    performance?: { score: number | null };
  };
  audits: Record<
    string,
    {
      numericValue?: number;
      details?: Record<string, unknown> | null;
      title?: string;
    }
  >;
};

export function extractMetrics(lhr: Lhr): PerfMetrics {
  const score = lhr.categories?.performance?.score;
  const performanceScore =
    typeof score === "number" ? Math.round(score * 100) : null;

  const audits = lhr.audits || {};

  const lcpValue = audits["largest-contentful-paint"]?.numericValue;
  const lcp = typeof lcpValue === "number" ? Math.round(lcpValue) : null;

  const clsValue = audits["cumulative-layout-shift"]?.numericValue;
  const cls =
    typeof clsValue === "number" ? parseFloat(clsValue.toFixed(3)) : null;

  const tbtValue = audits["total-blocking-time"]?.numericValue;
  const tbt = typeof tbtValue === "number" ? Math.round(tbtValue) : null;

  const fcpValue = audits["first-contentful-paint"]?.numericValue;
  const fcp = typeof fcpValue === "number" ? Math.round(fcpValue) : null;

  const speedIndexValue = audits["speed-index"]?.numericValue;
  const speedIndex =
    typeof speedIndexValue === "number" ? Math.round(speedIndexValue) : null;

  const ttfbValue = audits["server-response-time"]?.numericValue;
  const ttfb = typeof ttfbValue === "number" ? Math.round(ttfbValue) : null;

  const totalByteWeightValue = audits["total-byte-weight"]?.numericValue;
  const totalByteWeight =
    typeof totalByteWeightValue === "number"
      ? Math.round(totalByteWeightValue)
      : null;

  const networkRequestsItems = audits["network-requests"]?.details?.items;
  const requestCount = Array.isArray(networkRequestsItems)
    ? networkRequestsItems.length
    : null;

  return {
    performanceScore,
    lcp,
    cls,
    tbt,
    fcp,
    speedIndex,
    ttfb,
    totalByteWeight,
    requestCount,
  };
}

export function extractLcpElement(lhr: Lhr): PerfLcpElement | null {
  const audits = lhr.audits || {};
  const details = audits["largest-contentful-paint-element"]?.details as
    | { items?: Array<{ items?: Array<{ node?: { nodeLabel?: string; selector?: string; snippet?: string } }>; node?: { nodeLabel?: string; selector?: string; snippet?: string } }> }
    | undefined;

  const item = details?.items?.[0];
  const node = item?.items?.[0]?.node ?? item?.node;

  if (!node) {
    return null;
  }

  return {
    nodeLabel: node.nodeLabel ?? null,
    selector: node.selector ?? null,
    snippet: node.snippet ?? null,
  };
}

export function extractOpportunities(
  lhr: Lhr,
  limit = 5,
): PerfOpportunity[] {
  const audits = lhr.audits || {};
  const opportunities: PerfOpportunity[] = [];

  for (const [id, audit] of Object.entries(audits)) {
    const details = audit?.details as
      | { type?: string; overallSavingsMs?: number }
      | undefined;

    if (
      details?.type === "opportunity" &&
      typeof details?.overallSavingsMs === "number" &&
      details.overallSavingsMs > 0
    ) {
      opportunities.push({
        id,
        title: audit.title || id,
        savingsMs: Math.round(details.overallSavingsMs),
      });
    }
  }

  opportunities.sort((a, b) => b.savingsMs - a.savingsMs);
  return opportunities.slice(0, limit);
}

export function isValidRun(
  lhr: Lhr,
  sku: string,
): { valid: boolean; reason?: string } {
  if (lhr.runtimeError) {
    return {
      valid: false,
      reason: `Erro de execução do Lighthouse: ${lhr.runtimeError.message || lhr.runtimeError.code}`,
    };
  }

  const score = lhr.categories?.performance?.score;
  if (score === null || score === undefined) {
    return {
      valid: false,
      reason: "Score de performance ausente ou nulo",
    };
  }

  if (
    !lhr.finalDisplayedUrl ||
    !lhr.finalDisplayedUrl.toLowerCase().includes(sku.toLowerCase())
  ) {
    return {
      valid: false,
      reason: `URL final exibida não contém o SKU ${sku}`,
    };
  }

  return { valid: true };
}

export function pickMedianIndex(scores: number[]): number {
  if (scores.length === 0) {
    return -1;
  }

  const items = scores.map((score, index) => ({ score, index }));
  items.sort((a, b) => a.score - b.score);

  const mid =
    items.length % 2 === 0
      ? items.length / 2 - 1
      : Math.floor(items.length / 2);

  return items[mid].index;
}
