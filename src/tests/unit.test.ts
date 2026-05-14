/**
 * Unit tests for pure functions — no browser required.
 *
 * Runs via `npm run test:unit` (npx playwright test src/tests/).
 * Playwright's test runner handles TypeScript natively; no compilation step needed.
 *
 * Covered:
 *   - getApplicableFeatures   (config.ts)
 *   - isFeatureSupported      (config.ts)
 *   - buildPdpUrl             (config.ts)
 *   - mergeCommerceFeatureFlags   (remoteConfig.ts)
 *   - PDP_ENDPOINT_RULES schema      (endpoints-rules.ts)
 *   - parseConcurrency               (concurrency.ts)
 */

import { test, expect } from "@playwright/test";
import {
  getApplicableFeatures,
  buildPdpUrl,
  isFeatureSupported,
} from "../checks/configs/config.js";
import {
  isFeatureEnabledByRemoteConfig,
  mergeCommerceFeatureFlags,
  RemoteConfigFlags,
  ProductReviewsConfig,
  CommerceFeatureFlags,
} from "../checks/remoteConfig.js";
import { PDP_ENDPOINT_RULES } from "../checks/configs/endpoints-rules.js";
import { parseConcurrency } from "../concurrency.js";
import type { SkuConfig, FeatureConfig } from "../types.js";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const naturaBR: SkuConfig = {
  sku: "12345",
  name: "Produto Teste",
  slug: "produto-teste",
  vendor: "natura",
  country: "BR",
};

const FULL_REVIEWS: ProductReviewsConfig = {
  enabled: true,
  ai_summary: true,
  filter: true,
  sort: true,
  photos: true,
  recommendation: { enabled: true, min_count: 4 },
};

function makeFlags(
  partial: Partial<RemoteConfigFlags> = {},
): RemoteConfigFlags {
  return { capturedAt: new Date().toISOString(), locale: "pt-BR", ...partial };
}

// ---------------------------------------------------------------------------
// mergeCommerceFeatureFlags
// ---------------------------------------------------------------------------

test.describe("mergeCommerceFeatureFlags", () => {
  test("returns null when both inputs are null", () => {
    expect(mergeCommerceFeatureFlags(null, null)).toBeNull();
  });

  test("returns the non-null side when the other is null", () => {
    const a: CommerceFeatureFlags = {
      capturedAt: "2026-01-01T00:00:00.000Z",
      businessModel: "B2C",
    };
    expect(mergeCommerceFeatureFlags(a, null)).toEqual(a);
    expect(mergeCommerceFeatureFlags(null, a)).toEqual(a);
  });

  test("prefers defined fields from primary and fills gaps from secondary", () => {
    const primary: CommerceFeatureFlags = {
      capturedAt: "primary-ts",
      businessModel: "B2C",
      _raw: { x: 1 },
    };
    const secondary: CommerceFeatureFlags = {
      capturedAt: "secondary-ts",
      businessModel: "B2B",
      nePagesPdV2: true,
      giftPackaging: false,
    };
    const m = mergeCommerceFeatureFlags(primary, secondary);
    expect(m?.capturedAt).toBe("primary-ts");
    expect(m?._raw).toEqual({ x: 1 });
    expect(m?.businessModel).toBe("B2C");
    expect(m?.nePagesPdV2).toBe(true);
    expect(m?.giftPackaging).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getApplicableFeatures
// ---------------------------------------------------------------------------

test.describe("getApplicableFeatures", () => {
  test("returns non-optional features available on natura-BR", () => {
    const result = getApplicableFeatures(naturaBR);
    const keys = result.map((f) => f.key);

    // These must be present (non-optional and in natura-BR availableFeatures)
    expect(keys).toContain("reviews");
    expect(keys).toContain("reviewFilter");
    expect(keys).toContain("reviewSort");
    expect(keys).toContain("reviewPhotos");
    expect(keys).toContain("reviewRecommendation");
    expect(keys).toContain("brandShowcase");
    expect(keys).toContain("recommendationShowcase");
    expect(keys).toContain("images");
    expect(keys).toContain("rating");
  });

  test("excludes optional features when not in sku.expectedFeatures", () => {
    const result = getApplicableFeatures(naturaBR);
    const keys = result.map((f) => f.key);

    expect(keys).not.toContain("shopTheSet");
    expect(keys).not.toContain("aiReviewSummary");
  });

  test("includes optional feature when present in sku.expectedFeatures", () => {
    const skuWithShopTheSet: SkuConfig = {
      ...naturaBR,
      expectedFeatures: ["shopTheSet"],
    };
    const result = getApplicableFeatures(skuWithShopTheSet);
    expect(result.map((f) => f.key)).toContain("shopTheSet");
  });

  test("excludes features not in domain availableFeatures", () => {
    // natura-BR has pricing and shipping commented out in availableFeatures
    const result = getApplicableFeatures(naturaBR);
    const keys = result.map((f) => f.key);

    expect(keys).not.toContain("pricing");
    expect(keys).not.toContain("shipping");
  });

  test("returns empty array for unknown vendor/country", () => {
    const unknownSku = {
      sku: "00000",
      name: "Unknown",
      vendor: "natura" as const,
      country: "XX" as "BR", // force unknown country
    };
    const result = getApplicableFeatures(unknownSku);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// isFeatureSupported
// ---------------------------------------------------------------------------

test.describe("isFeatureSupported", () => {
  test("returns true when supportedVendors is not set", () => {
    const feature: FeatureConfig = { key: "images", name: "Imagens" };
    expect(isFeatureSupported(feature, "natura")).toBe(true);
    expect(isFeatureSupported(feature, "avon")).toBe(true);
  });

  test("returns true when vendor is in supportedVendors", () => {
    const feature: FeatureConfig = {
      key: "reviews",
      name: "Avaliações",
      supportedVendors: ["natura"],
    };
    expect(isFeatureSupported(feature, "natura")).toBe(true);
  });

  test("returns false when vendor is not in supportedVendors", () => {
    const feature: FeatureConfig = {
      key: "reviews",
      name: "Avaliações",
      supportedVendors: ["natura"],
    };
    expect(isFeatureSupported(feature, "avon")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildPdpUrl
// ---------------------------------------------------------------------------

test.describe("buildPdpUrl", () => {
  test("builds URL with explicit slug", () => {
    const url = buildPdpUrl(naturaBR);
    expect(url).toContain("natura.com.br");
    expect(url).toContain("/p/");
    expect(url).toContain(naturaBR.slug!);
    expect(url).toContain(naturaBR.sku);
  });

  test("falls back to name-derived slug when slug is omitted", () => {
    const noSlugSku: SkuConfig = {
      sku: "99999",
      name: "Meu Produto Lindo",
      vendor: "natura",
      country: "BR",
    };
    const url = buildPdpUrl(noSlugSku);
    expect(url).toContain("meu-produto-lindo");
    expect(url).toContain("99999");
  });

  test("throws for unknown vendor/country combination", () => {
    const badSku = {
      sku: "00000",
      name: "Ghost",
      vendor: "natura" as const,
      country: "XX" as "BR",
    };
    expect(() => buildPdpUrl(badSku)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// isFeatureEnabledByRemoteConfig
// ---------------------------------------------------------------------------

test.describe("isFeatureEnabledByRemoteConfig", () => {
  test("returns enabled=true when flags is null (safe default)", () => {
    const result = isFeatureEnabledByRemoteConfig("reviews", null);
    expect(result.enabled).toBe(true);
  });

  test("returns enabled=true for feature with no mapping entry (e.g. images)", () => {
    const result = isFeatureEnabledByRemoteConfig("images", makeFlags());
    expect(result.enabled).toBe(true);
    expect(result.flagKey).toBeUndefined();
  });

  test("returns enabled=true when mapped flag key is absent from captured flags", () => {
    // product_reviews not in flags → assume enabled
    const result = isFeatureEnabledByRemoteConfig("reviews", makeFlags());
    expect(result.enabled).toBe(true);
  });

  test("returns enabled=true when product_reviews.enabled is true", () => {
    const flags = makeFlags({
      product_reviews: { ...FULL_REVIEWS, enabled: true },
    });
    const result = isFeatureEnabledByRemoteConfig("reviews", flags);
    expect(result.enabled).toBe(true);
    expect(result.flagValue).toBe(true);
  });

  test("returns enabled=false when product_reviews.enabled is false", () => {
    const flags = makeFlags({
      product_reviews: { ...FULL_REVIEWS, enabled: false },
    });
    const result = isFeatureEnabledByRemoteConfig("reviews", flags);
    expect(result.enabled).toBe(false);
    expect(result.flagValue).toBe(false);
    expect(result.flagKey).toBe("product_reviews.enabled");
  });

  test("resolves nested path: reviewRecommendation uses recommendation.enabled", () => {
    const disabledRec = makeFlags({
      product_reviews: {
        ...FULL_REVIEWS,
        recommendation: { enabled: false, min_count: 4 },
      },
    });
    const result = isFeatureEnabledByRemoteConfig(
      "reviewRecommendation",
      disabledRec,
    );
    expect(result.enabled).toBe(false);
    expect(result.flagKey).toBe("product_reviews.recommendation.enabled");
  });

  test("shopTheSet: enabled=true when enable_shoptheset_pdp is true", () => {
    const flags = makeFlags({ enable_shoptheset_pdp: true });
    expect(isFeatureEnabledByRemoteConfig("shopTheSet", flags).enabled).toBe(
      true,
    );
  });

  test("shopTheSet: enabled=false when enable_shoptheset_pdp is false", () => {
    const flags = makeFlags({ enable_shoptheset_pdp: false });
    const result = isFeatureEnabledByRemoteConfig("shopTheSet", flags);
    expect(result.enabled).toBe(false);
    expect(result.flagKey).toBe("enable_shoptheset_pdp");
  });
});

// ---------------------------------------------------------------------------
// PDP_ENDPOINT_RULES — schema validation
// ---------------------------------------------------------------------------

test.describe("PDP_ENDPOINT_RULES schema", () => {
  test("defines at least one rule", () => {
    expect(PDP_ENDPOINT_RULES.length).toBeGreaterThan(0);
  });

  test("every rule has a non-empty key, name and match", () => {
    for (const rule of PDP_ENDPOINT_RULES) {
      expect(typeof rule.key).toBe("string");
      expect(rule.key.length).toBeGreaterThan(0);
      expect(typeof rule.name).toBe("string");
      expect(rule.name.length).toBeGreaterThan(0);
      expect(typeof rule.match).toBe("string");
      expect(rule.match.length).toBeGreaterThan(0);
    }
  });

  test("rule keys are unique", () => {
    const keys = PDP_ENDPOINT_RULES.map((r) => r.key);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  test("nonEmptyFields entries are non-empty strings when present", () => {
    const rulesWithFields = PDP_ENDPOINT_RULES.filter((r) => r.nonEmptyFields);
    expect(rulesWithFields.length).toBeGreaterThan(0);
    for (const rule of rulesWithFields) {
      for (const field of rule.nonEmptyFields!) {
        expect(typeof field).toBe("string");
        expect(field.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// parseConcurrency
// ---------------------------------------------------------------------------

test.describe("parseConcurrency", () => {
  let saved: string | undefined;

  test.beforeEach(() => {
    saved = process.env.CONCURRENCY;
    delete process.env.CONCURRENCY;
  });

  test.afterEach(() => {
    if (saved === undefined) {
      delete process.env.CONCURRENCY;
    } else {
      process.env.CONCURRENCY = saved;
    }
  });

  test("returns defaultValue when env var is unset", () => {
    expect(parseConcurrency(3)).toBe(3);
    expect(parseConcurrency(1)).toBe(1);
  });

  test("parses a valid integer", () => {
    process.env.CONCURRENCY = "5";
    expect(parseConcurrency(3)).toBe(5);
  });

  test("clamps to 1 when value is 0 or negative", () => {
    process.env.CONCURRENCY = "0";
    expect(parseConcurrency(3)).toBe(1);

    process.env.CONCURRENCY = "-2";
    expect(parseConcurrency(3)).toBe(1);
  });

  test("clamps to 8 when value exceeds maximum", () => {
    process.env.CONCURRENCY = "20";
    expect(parseConcurrency(3)).toBe(8);
  });

  test("falls back to defaultValue for non-numeric input", () => {
    process.env.CONCURRENCY = "abc";
    expect(parseConcurrency(3)).toBe(3);
  });
});
