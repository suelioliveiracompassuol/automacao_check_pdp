/**
 * Dashboard types — standalone, no Playwright dependency.
 * Mirrors the report JSON structure from the PDP Monitor.
 */

export type Status = 'pass' | 'fail' | 'disabled' | 'na' | 'error' | 'warning';

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
  htmlPath: string;
  jsonPath: string;
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
