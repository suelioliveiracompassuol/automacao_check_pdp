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
  remoteConfigFlags?: Record<string, unknown>;
  commerceFeatureFlags?: Record<string, unknown>;
}

export interface MonitoringReport {
  runId: string;
  startTime: string;
  endTime: string;
  durationMs: number;
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

/** Single source of truth for country display labels — used across the /visao-geral page. */
export const COUNTRY_INFO: Record<Country, { label: string }> = {
  AR: { label: 'Argentina' },
  BR: { label: 'Brasil' },
  CL: { label: 'Chile' },
  CO: { label: 'Colômbia' },
  MX: { label: 'México' },
  PE: { label: 'Peru' },
};

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
  | 'pricing'
  | 'shipping'
  | 'ratingConsistency'
  | 'rating'
  | 'addToCart'
  | 'favoriteButton'
  | 'productVariations'
  | 'contentBanners';

/** Runtime list of every FeatureKey — single source of truth for "how many checks we run". */
export const ALL_FEATURE_KEYS: FeatureKey[] = [
  'reviews',
  'aiReviewSummary',
  'reviewFilter',
  'reviewSort',
  'reviewPhotos',
  'reviewRecommendation',
  'brandShowcase',
  'recommendationShowcase',
  'shopTheSet',
  'images',
  'pricing',
  'shipping',
  'ratingConsistency',
  'rating',
  'addToCart',
  'favoriteButton',
  'productVariations',
  'contentBanners',
];

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
  reportHtmlPath: string | null; // relativo a docs/perf, ex.: "run_123/NATBRA-108403.html"
  lighthouseVersion: string | null;
}

export interface PerfRun {
  runId: string; // "run_<Date.now()>"
  timestamp: string; // ISO
  formFactor: 'desktop';
  runsPerSku: number;
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
