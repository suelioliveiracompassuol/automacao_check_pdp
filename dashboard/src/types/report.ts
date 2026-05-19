export interface ReportSummary {
  total: number;
  passed: number;
  failed: number;
  errors: number;
}

export interface FeatureResult {
  feature: string;
  featureKey: string;
  passed: boolean;
  status: "pass" | "fail" | "warning" | "error" | "skip";
  message: string;
  details?: Record<string, unknown>;
  flagKey?: string;
  flagValue?: unknown;
  screenshot?: string;
}

export interface SkuResult {
  sku: string;
  name: string;
  url: string;
  vendor: string;
  country: string;
  channel?: string;
  timestamp: string;
  success: boolean;
  loadTime: number;
  features: FeatureResult[];
  remoteConfigFlags?: Record<string, unknown>;
  commerceFeatureFlags?: Record<string, unknown>;
}

export interface ReportData {
  runId: string;
  startTime: string;
  endTime: string;
  durationMs: number;
  summary: ReportSummary;
  results: SkuResult[];
}
