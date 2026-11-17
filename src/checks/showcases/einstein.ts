/**
 * Einstein personalization API behind the PDP showcases: the response captured during page
 * load (set up before navigation) and a diagnostic re-fetch of the call the page made.
 */

import { Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Network capture for Einstein recommendation showcase
// Set up BEFORE page.goto() so the response is captured during initial load.
// ---------------------------------------------------------------------------

/**
 * Extract product/item count from an Einstein campaign payload.
 * Different country BFFs may use different field names for the product array.
 */
export function extractProductsFromPayload(payloadObj: unknown): number {
  if (!payloadObj || typeof payloadObj !== "object") {
    return 0;
  }
  const obj = payloadObj as Record<string, unknown>;
  // Try well-known field names first
  for (const key of [
    "products",
    "recs",
    "items",
    "productList",
    "recommendations",
    "result",
  ]) {
    if (Array.isArray(obj[key])) {
      return (obj[key] as unknown[]).length;
    }
  }
  // Fallback: return the length of the first non-empty array property found.
  // Covers any other field name used by country-specific BFFs.
  for (const val of Object.values(obj)) {
    if (Array.isArray(val) && val.length > 0) {
      return val.length;
    }
  }
  return 0;
}

/**
 * Products in an Einstein `campaignResponses` list (payloads may come as JSON strings). When no
 * payload has a product array but campaigns exist, the campaign count is used, so a response
 * whose products sit under an unknown field isn't reported as empty.
 */
export function countEinsteinProducts(campaignResponses: unknown[]): number {
  let count = 0;
  for (const campaign of campaignResponses as Record<string, unknown>[]) {
    let payloadObj = campaign?.payload;
    if (typeof payloadObj === "string") {
      try {
        payloadObj = JSON.parse(payloadObj);
      } catch {
        // payload not JSON
      }
    }
    count += extractProductsFromPayload(payloadObj);
  }
  return count === 0 ? campaignResponses.length : count;
}

interface EinsteinCapturedData {
  campaignCount: number;
  /** HTTP status of the original page-load response */
  httpStatus: number;
  /** Original request headers to replay in diagnostic check */
  reqHeaders?: Record<string, string>;
}

/** Per-page cache populated by {@link setupEinsteinShowcaseCapture}. */
export const einsteinShowcaseCache = new WeakMap<Page, EinsteinCapturedData>();

/**
 * Install a `response` listener that captures the Einstein recommendation API
 * response for the recommendation showcase (VITRINE_PDP_EXPERIENCIA).
 * Must be called BEFORE `page.goto()`.
 */
export function setupEinsteinShowcaseCapture(page: Page): void {
  page.on("response", (response) => {
    const url = response.url();
    // Capture any recommendation vitrine call: covers EXPERIENCIA, EXPERIENCIA_V2, etc.
    // Excludes the brand showcase (MAIS_PRODUTOS_DA_MARCA) which has its own check.
    if (
      !url.includes("einstein/personalization/campaign/products") ||
      !url.includes("VITRINE_PDP") ||
      url.includes("MAIS_PRODUTOS")
    ) {
      return;
    }
    const status = response.status();
    const reqHeaders = response.request().headers();
    void response
      .body()
      .then((buffer) => {
        const body = JSON.parse(buffer.toString("utf-8")) as Record<
          string,
          unknown
        >;
        const count = Array.isArray(body?.campaignResponses)
          ? countEinsteinProducts(body.campaignResponses as unknown[])
          : 0;
        // Keep the highest campaign count seen across multiple calls
        const existing = einsteinShowcaseCache.get(page);
        if (!existing || count > existing.campaignCount) {
          einsteinShowcaseCache.set(page, {
            campaignCount: count,
            httpStatus: status,
            reqHeaders,
          });
        }
      })
      .catch(() => {
        // Body unavailable or not JSON — record -1 so callers can distinguish
        // from a genuine empty-campaigns response (0)
        if (!einsteinShowcaseCache.has(page)) {
          einsteinShowcaseCache.set(page, {
            campaignCount: -1,
            httpStatus: status,
            reqHeaders,
          });
        }
      });
  });
}

// ---------------------------------------------------------------------------
// Einstein Personalization API helper
// ---------------------------------------------------------------------------

interface EinsteinApiResult {
  /** Whether a matching request was found in the page's performance timeline */
  called: boolean;
  /** The full URL that was called */
  url: string | null;
  /** The contentZones parameter value */
  contentZone: string | null;
  /** Number of campaign responses returned (0 = empty) */
  campaignCount: number;
  /** HTTP status of the API response, or null if not fetched */
  httpStatus: number | null;
  /** Error message if the re-fetch failed */
  fetchError: string | null;
  /** Fallback expected content zone (derived from country + suffix) */
  expectedContentZone: string | null;
}

/**
 * Finds an Einstein Personalization call made during page load
 * (via PerformanceResourceTiming), re-fetches it from the browser
 * context (same cookies/session), and returns diagnostic data.
 *
 * @param contentZoneHint - optional substring to match against the contentZones param
 */
export async function checkEinsteinApi(
  page: Page,
  contentZoneHint?: string,
  expectedZoneSuffix?: string,
): Promise<EinsteinApiResult> {
  const empty: EinsteinApiResult = {
    called: false,
    url: null,
    contentZone: null,
    campaignCount: 0,
    httpStatus: null,
    fetchError: null,
    expectedContentZone: null,
  };

  try {
    const generatedContentZone = await page
      .evaluate((suffix) => {
        if (!suffix) {
          return null;
        }
        const countryCodeMatch = window.location.hostname.match(
          /(?:\.com\.)?([a-z]{2})$/i,
        );
        const countryCode = countryCodeMatch?.[1]?.toUpperCase();
        if (!countryCode) {
          return null;
        }
        return `CZ_${countryCode}_VITRINE_PDP_${suffix}`;
      }, expectedZoneSuffix ?? null)
      .catch(() => null);

    // Prefer content zone returned by product API payload when available
    const productApiContentZone = await page
      .evaluate(async () => {
        try {
          const entries = performance.getEntriesByType(
            "resource",
          ) as PerformanceResourceTiming[];
          const productEntry = entries.find((e) =>
            e.name.includes("/pages/v2/product/"),
          );
          if (!productEntry) {
            return null;
          }

          const res = await fetch(productEntry.name, {
            credentials: "include",
          });
          const body = await res.json().catch(() => null);
          if (!body || typeof body !== "object") {
            return null;
          }

          const fromPersonalization = (body as Record<string, unknown>)
            .personalizationShowcase as { contentZones?: string } | undefined;
          if (fromPersonalization?.contentZones) {
            return fromPersonalization.contentZones;
          }

          const components = (body as Record<string, unknown>)
            .productComponents;
          if (!Array.isArray(components)) {
            return null;
          }

          for (const comp of components) {
            if (!comp || typeof comp !== "object") {
              continue;
            }
            const obj = comp as Record<string, unknown>;
            const list = obj.productListPersonalization as
              | { contentZones?: string }
              | undefined;
            if (list?.contentZones) {
              return list.contentZones;
            }
          }

          return null;
        } catch {
          return null;
        }
      })
      .catch(() => null);

    const expectedContentZone =
      contentZoneHint === "EXPERIENCIA"
        ? (productApiContentZone ?? generatedContentZone)
        : generatedContentZone;

    // Find the Einstein URL from the page's resource timing entries.
    // Falls back to any VITRINE_PDP call when the specific hint finds nothing
    // (handles wl_target_personalization_pdp_showcase_v2 which may use a different zone).
    const einsteinUrl: string | null = await page.evaluate((hint) => {
      const entries = performance.getEntriesByType(
        "resource",
      ) as PerformanceResourceTiming[];
      // Primary: match by specific hint (e.g. "EXPERIENCIA")
      let match = entries.find((e) => {
        if (!e.name.includes("einstein/personalization")) {
          return false;
        }
        if (hint) {
          try {
            const params = new URL(e.name).searchParams.get("contentZones");
            return params?.includes(hint) ?? false;
          } catch {
            return false;
          }
        }
        return true;
      });
      // Fallback: any recommendation vitrine call (excludes brand showcase)
      if (!match) {
        match = entries.find(
          (e) =>
            e.name.includes("einstein/personalization") &&
            e.name.includes("VITRINE_PDP") &&
            !e.name.includes("MAIS_PRODUTOS"),
        );
      }
      return match?.name ?? null;
    }, contentZoneHint ?? null);

    if (!einsteinUrl) {
      return {
        ...empty,
        expectedContentZone,
      };
    }

    let contentZone: string | null = null;
    try {
      contentZone = new URL(einsteinUrl).searchParams.get("contentZones");
    } catch {
      /* ignore */
    }

    // Check if we already have the data in the cache from the initial page load
    const cachedData = einsteinShowcaseCache.get(page);

    // Only re-fetch if we don't have valid cached data.
    // Also re-fetch when count === 0: an early/preflight response can arrive
    // before the real personalised payload, leaving a stale 0 in the cache.
    let apiResult = {
      status: cachedData?.httpStatus ?? null,
      campaignCount: cachedData?.campaignCount ?? -1,
      error: null as string | null,
    };

    if (!cachedData || cachedData.campaignCount < 1) {
      const reqHeaders = cachedData?.reqHeaders ?? {};

      // Re-fetch using Playwright's APIRequestContext (Node.js level — no browser
      // header restrictions, properly forwards x-api-key and other custom headers).
      // Retries up to 3 times with a 2 s delay so transient CDN/Einstein misses are
      // covered without flooding the API.
      const RETRIES = 3;
      const RETRY_DELAY_MS = 2000;

      for (let attempt = 0; attempt < RETRIES; attempt++) {
        if (attempt > 0) {
          await new Promise<void>((r) => setTimeout(r, RETRY_DELAY_MS));
        }
        try {
          const apiResponse = await page.context().request.get(einsteinUrl, {
            headers: reqHeaders,
            timeout: 15000,
          });
          const body = (await apiResponse.json().catch(() => null)) as Record<
            string,
            unknown
          > | null;

          if (
            !body ||
            !Array.isArray(
              (body as { campaignResponses?: unknown[] }).campaignResponses,
            )
          ) {
            apiResult = {
              status: apiResponse.status(),
              campaignCount: -1,
              error: null,
            };
            continue;
          }

          const productCount = countEinsteinProducts(
            (body as { campaignResponses: unknown[] }).campaignResponses,
          );

          apiResult = {
            status: apiResponse.status(),
            campaignCount: productCount,
            error: null,
          };

          if (productCount > 0) {
            break; // got data — stop retrying
          }
        } catch (e) {
          apiResult = { status: null, campaignCount: -1, error: String(e) };
        }
      }
    }

    return {
      called: true,
      url: einsteinUrl,
      contentZone,
      campaignCount: apiResult.campaignCount,
      httpStatus: apiResult.status,
      fetchError: apiResult.error,
      expectedContentZone,
    };
  } catch {
    return empty;
  }
}
