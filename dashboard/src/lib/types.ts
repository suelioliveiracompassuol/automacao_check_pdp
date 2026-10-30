/**
 * Dashboard types — standalone, no Playwright dependency.
 * Mirrors the report JSON structure from the PDP Monitor.
 */

export type Status = 'pass' | 'fail' | 'disabled' | 'na' | 'error' | 'warning';

/** Defaults to 'web' when omitted on a report/index entry (legacy reports predate this field). */
export type Platform = 'web' | 'android' | 'ios';

export interface CheckResult {
  feature: string;
  featureKey: string;
  passed: boolean;
  status: Status;
  message: string;
  details?: Record<string, unknown>;
  flagKey?: string;
  flagValue?: unknown;
}

export interface PdpCheckResult {
  sku: string;
  name: string;
  url: string;
  vendor: string;
  country: string;
  channel?: string;
  /** Platform the check ran on. Defaults to 'web' when omitted (legacy reports). */
  platform?: Platform;
  timestamp: string;
  success: boolean;
  loadTime?: number;
  features: CheckResult[];
  error?: string;
  pageScreenshot?: string;
  /** Android: one screenshot per step of the check, in order */
  stepScreenshots?: StepScreenshot[];
  remoteConfigFlags?: Record<string, unknown>;
  commerceFeatureFlags?: Record<string, unknown>;
}

export interface StepScreenshot {
  label: string;
  /** Relative to the run folder, e.g. "screenshots/NATBRA-1/01-pdp-aberta.png" */
  path: string;
}

/** De onde veio a lista de SKUs da execução: Firestore, ou o fallback config/skus.json. */
export type SkuSource = 'firestore' | 'json';

export interface MonitoringReport {
  runId: string;
  startTime: string;
  endTime: string;
  durationMs: number;
  /** Ausente em execuções anteriores a este campo. */
  skuSource?: SkuSource;
  summary: {
    total: number;
    passed: number;
    failed: number;
    errors: number;
  };
  results: PdpCheckResult[];
}

export interface ReportIndexEntry {
  runId: string;
  startTime: string;
  endTime: string;
  durationMs: number;
  skuSource?: SkuSource;
  summary: {
    total: number;
    passed: number;
    failed: number;
    errors: number;
  };
  /** Present for web runs (static report.html); Android runs are JSON-only. */
  htmlPath?: string;
  jsonPath: string;
  /** Defaults to 'web' when omitted (legacy reports). */
  platform?: Platform;
}

export interface ReportIndex {
  reports: ReportIndexEntry[];
}

export type Vendor = 'natura' | 'avon';
export type Country = 'BR' | 'AR' | 'CL' | 'CO' | 'MX' | 'PE';
export type Channel = 'ecommerce' | 'socialcommerce';

export type FeatureKey =
  | 'reviews'
  | 'aiReviewSummary'
  | 'reviewFilter'
  | 'reviewSort'
  | 'reviewPhotos'
  | 'reviewRecommendation'
  | 'brandShowcase'
  | 'recommendationShowcase'
  | 'shopTheSet'
  | 'images'
  | 'ratingConsistency'
  | 'rating'
  | 'addToCart'
  | 'favoriteButton'
  | 'productVariations'
  | 'contentBanners'
  | 'coupons'
  | 'giftModule'
  | 'topRatedBadge'
  | 'minStockBadge';

export interface SkuEntry {
  id: string;
  sku: string;
  name: string;
  slug?: string;
  vendor: Vendor;
  country: Country;
  channel: Channel;
  expectedFeatures: FeatureKey[];
}

export interface PerfMetrics {
  performanceScore: number | null; // 0-100
  startRender?: number | null; // ms, equivalente ao StartRender do WebPageTest (ausente em rodadas antigas)
  lcp: number | null; // ms
  cls: number | null;
  tbt: number | null; // ms
  fcp: number | null; // ms
  speedIndex: number | null; // ms
  ttfb: number | null; // ms
  totalByteWeight: number | null; // bytes
  requestCount: number | null;
}

export interface PerfLcpElement {
  nodeLabel: string | null;
  selector: string | null;
  snippet: string | null;
}

export interface PerfOpportunity {
  id: string;
  title: string;
  savingsMs: number;
}

/** Tipo de PDP, igual ao da automação de Web Vitals do site geral (WebPageTest). */
export type PerfPageType = 'PDPFull' | 'PDPLow';

export interface PerfSkuResult {
  sku: string;
  name: string;
  pageType?: PerfPageType;
  url: string;
  success: boolean;
  error?: string;
  median: PerfMetrics | null; // métricas da execução mediana
  runs: PerfMetrics[]; // todas as execuções válidas
  lcpElement: PerfLcpElement | null;
  opportunities: PerfOpportunity[];
  /** Relatório completo do Lighthouse (LHR), relativo a docs/perf, ex.: "run_123/NATBRA-108403.json".
   * Ausente em rodadas antigas (que geravam HTML) e removido pelo workflow após 10 dias. */
  reportJsonPath?: string | null;
  lighthouseVersion: string | null;
}

export interface PerfRun {
  runId: string; // "run_<Date.now()>"
  timestamp: string; // ISO
  formFactor: 'desktop';
  runsPerSku: number;
  /** Condições do teste, equivalentes ao WebPageTest (ausente em rodadas antigas). */
  conditions?: {
    connectivity: string;
    downKbps: number;
    upKbps: number;
    rttMs: number;
    viewport: string;
    consentCookie: boolean;
  };
  results: PerfSkuResult[];
}

export interface PerfIndexEntry {
  runId: string;
  timestamp: string;
  skus: {
    sku: string;
    name: string;
    pageType?: PerfPageType;
    success: boolean;
    metrics: PerfMetrics | null;
  }[];
}

export interface PerfIndex {
  runs: PerfIndexEntry[]; // mais recente primeiro, máx. 365
}
