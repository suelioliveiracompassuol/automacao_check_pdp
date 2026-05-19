import { Page } from "@playwright/test";
import {
  RemoteConfigFlags,
  CommerceFeatureFlags,
} from "./checks/remoteConfig.js";

/**
 * Result of a single feature check
 */
export interface CheckResult {
  feature: string;
  featureKey: string;
  passed: boolean;
  /**
   * Status of the check:
   * - 'pass' = feature present and working
   * - 'fail' = feature expected but not found (bug)
   * - 'disabled' = feature disabled via Remote Config (not a bug)
   * - 'na' = not applicable for this vendor/product
   * - 'warning' = partially verified or optional missing
   * - 'error' = check threw an exception
   */
  status: "pass" | "fail" | "disabled" | "na" | "error" | "warning";
  message: string;
  /** Screenshot path if failed */
  screenshot?: string;
  /** Additional details for debugging */
  details?: Record<string, unknown>;
  /** Remote Config flag key that controls this feature */
  flagKey?: string;
  /** Current value of the Remote Config flag */
  flagValue?: unknown;
}

/**
 * Result of checking a single PDP
 */
export interface PdpCheckResult {
  sku: string;
  name: string;
  url: string;
  vendor: string;
  country: string;
  /** Channel: ecommerce (default) or socialcommerce (Minha Loja) */
  channel?: Channel;
  timestamp: string;
  /** Overall status: true if all required checks passed */
  success: boolean;
  /** Page load time in ms */
  loadTime?: number;
  /** Individual feature results */
  features: CheckResult[];
  /** Error if page failed to load */
  error?: string;
  /** Full page screenshot on failure */
  pageScreenshot?: string;
  /** Playwright trace .zip when PLAYWRIGHT_TRACE is enabled */
  playwrightTracePath?: string;
  /** Captured Remote Config flags for this domain */
  remoteConfigFlags?: RemoteConfigFlags;
  /** Captured Commerce Feature Flags from /feature-flag endpoint */
  commerceFeatureFlags?: CommerceFeatureFlags;
}

export { RemoteConfigFlags, CommerceFeatureFlags };

/**
 * Full monitoring report
 */
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

/**
 * Base interface for feature checker functions
 */
export type FeatureChecker = (page: Page) => Promise<CheckResult>;
export type Vendor = "natura" | "avon";
export type Country = "BR" | "AR" | "CL" | "CO" | "MX" | "PE";
export type Channel = "ecommerce" | "socialcommerce";

export type FeatureKey =
  | "reviews"
  | "aiReviewSummary"
  | "reviewFilter"
  | "reviewSort"
  | "reviewPhotos"
  | "reviewRecommendation"
  | "brandShowcase"
  | "recommendationShowcase"
  | "shopTheSet"
  | "images"
  | "pricing"
  | "shipping"
  | "rating";

export interface SkuConfig {
  sku: string;
  name: string;
  /** URL slug for the product (part between /p/ and /{SKU}) */
  slug?: string;
  vendor: Vendor;
  country: Country;
  /** Channel: ecommerce (default) or socialcommerce (Minha Loja) */
  channel?: Channel;
  /** Optional: specific features expected for this SKU (e.g., perfume should have "gota olfativa") */
  expectedFeatures?: FeatureKey[];
}

export interface DomainConfig {
  vendor: Vendor;
  country: Country;
  /** Channel: ecommerce (default) or socialcommerce */
  channel?: Channel;
  domain: string;
  locale: string;
  /** Query params appended to PDP URLs (e.g., Social Commerce consultoria) */
  queryParams?: string;
  /**
   * Features available on this operation.
   * Only features listed here will be checked. Others are skipped as N/A.
   * This avoids false positives when a feature doesn't exist on an operation.
   */
  availableFeatures: FeatureKey[];
}

export interface FeatureConfig {
  key: FeatureKey;
  name: string;
  /** Some features are vendor-specific */
  supportedVendors?: Vendor[];
  /** Some features are product-category specific */
  optional?: boolean;
}
