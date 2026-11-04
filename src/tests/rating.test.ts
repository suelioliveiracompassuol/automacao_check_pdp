import { test, expect } from "@playwright/test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  extractRscPayload,
  findSsrProductRating,
  parseRscRows,
} from "../checks/ssrProduct.js";
import { captureCache, compareProductAndReviewsRating } from "../checks/ratingConsistency.js";
import { checkRating } from "../checks/rating.js";
import {
  applyRatingDivergenceGrace,
  currentRatingStates,
  isRatingComparison,
  loadPreviousRatingStates,
  RATING_DIVERGENCE_FAIL_AFTER_MS,
  RATING_DIVERGENCE_GRACE_MS,
  ratingResultKey,
} from "../ratingDivergence.js";
import {
  buildRunSummary,
  firestoreHistoryEnabled,
  firestoreHistoryWritable,
  ratingStateDocId,
  ratingStatesOf,
} from "../firestoreHistory.js";
import type { MonitoringReport, PdpCheckResult } from "../types.js";
import {
  applyAppReviewsApi,
  evaluateReviewsScreen,
  ReviewsScreen,
} from "../checks-android/reviews.js";

/** An App Router page whose RSC payload has the product (rating 4.3), a text row with
 * newlines, a variation entry and a showcase product. */
function rscPage(): string {
  const product = {
    productId: "NATBRA-122112",
    name: "Corretivo",
    shortDescription: "x",
    rating: 4.3,
    variations: [{ productId: "NATBRA-122112", rating: 9 }],
  };
  const text = "AQUA / ÁGUA,\nDICAPRYLYL ETHER\n";
  const payload =
    `1:${JSON.stringify(["$", "div", null, { showcase: [{ productId: "NATBRA-1", rating: 4.8 }] }])}\n` +
    `4d:T${Buffer.byteLength(text, "utf-8").toString(16)},${text}` +
    `5:${JSON.stringify(["$", "main", null, { product }])}\n`;
  // The page splits the payload in chunks
  const chunks = [payload.slice(0, 40), payload.slice(40)];
  const jsonLd = `<script type="application/ld+json">${JSON.stringify({ aggregateRating: { ratingValue: "4.4" } })}</script>`;
  return (
    `<html><head>${jsonLd}</head><body>` +
    chunks.map((c) => `<script>self.__next_f.push([1,${JSON.stringify(c)}])</script>`).join("") +
    "</body></html>"
  );
}

test.describe("Nota do produto (SFCC) × Konfidency", () => {
  test("reads the product's rating from the RSC payload, not JSON-LD or showcases", () => {
    const html = rscPage();
    expect(parseRscRows(extractRscPayload(html))).toHaveLength(2);
    expect(findSsrProductRating(html, "NATBRA-122112")).toBe(4.3);
    expect(findSsrProductRating(html, "NATBRA-999")).toBeUndefined();
  });

  test("falls back to __NEXT_DATA__ on Pages Router sites", () => {
    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: { pageProps: { product: { productId: "NATMEX-1", rating: 4.8, name: "x" } } },
    })}</script>`;
    expect(findSsrProductRating(html, "NATMEX-1")).toBe(4.8);
    // SKU code matched regardless of case/whitespace
    expect(findSsrProductRating(html, " natmex-1")).toBe(4.8);
  });

  test("compares product vs Konfidency, rounding the reviews' rating", () => {
    const same = compareProductAndReviewsRating({ productRating: 4.4, aggregatedRating: 4.37, productRatingSource: "ssr" });
    expect(same.status).toBe("pass");
    const diff = compareProductAndReviewsRating({ productRating: 4.3, aggregatedRating: 4.4, productRatingSource: "ssr" });
    expect(diff.status).toBe("fail");
    expect(diff.details?.divergent).toBe(true);
    // JSON-LD mirrors Konfidency: equal values prove nothing
    const jsonLd = compareProductAndReviewsRating({ productRating: 4.4, aggregatedRating: 4.4, productRatingSource: "json-ld" });
    expect(jsonLd.status).toBe("warning");
  });

  const divergent = () =>
    compareProductAndReviewsRating({ productRating: 4.3, aggregatedRating: 4.4, productRatingSource: "ssr" });
  const now = new Date("2026-11-04T08:00:00Z");

  test("a divergence up to a day old is a warning, older than that a fail", () => {
    const first = applyRatingDivergenceGrace(divergent(), undefined, now);
    expect(first.status).toBe("warning");
    expect(first.passed).toBe(true);
    expect(first.details?.divergentSince).toBe(now.toISOString());

    const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
    const recent = applyRatingDivergenceGrace(divergent(), { runTimestamp: hoursAgo(18), divergentSince: hoursAgo(18) }, now);
    expect(recent.status).toBe("warning");
    // The next daily run can reach the SKU a few minutes earlier: 23h56 already fails
    const nextDay = applyRatingDivergenceGrace(divergent(), { runTimestamp: hoursAgo(23.9), divergentSince: hoursAgo(23.9) }, now);
    expect(nextDay.status).toBe("fail");
    expect(RATING_DIVERGENCE_FAIL_AFTER_MS).toBe(20 * 3_600_000);

    const old = applyRatingDivergenceGrace(divergent(), { runTimestamp: hoursAgo(24), divergentSince: hoursAgo(25) }, now);
    expect(old.status).toBe("fail");
    expect(old.message).toContain("25h");
    expect(RATING_DIVERGENCE_GRACE_MS).toBe(24 * 3_600_000);

    // The previous run was consistent: the divergence starts now
    expect(applyRatingDivergenceGrace(divergent(), { runTimestamp: hoursAgo(30) }, now).status).toBe("warning");
    // Consistent results are left alone
    const ok = compareProductAndReviewsRating({ productRating: 4.4, aggregatedRating: 4.4, productRatingSource: "api" });
    expect(applyRatingDivergenceGrace(ok, undefined, now)).toEqual(ok);
  });

  test("loadPreviousRatingStates carries divergentSince from the latest run with the SKU", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rating-"));
    const run = (runId: string, startTime: string, results: unknown[]) => {
      fs.mkdirSync(path.join(dir, runId));
      fs.writeFileSync(path.join(dir, runId, "report.json"), JSON.stringify({ results }));
      return { runId, startTime };
    };
    const sku = (timestamp: string, details: Record<string, unknown>, message = "") => ({
      sku: "NATBRA-1",
      vendor: "natura",
      country: "BR",
      timestamp,
      features: [{ featureKey: "ratingConsistency", status: "warning", message, details }],
    });
    const index = [
      run("run_2", "2026-11-03T08:00:00Z", [sku("2026-11-03T08:01:00Z", { divergent: true, divergentSince: "2026-11-02T08:01:00Z" })]),
      run("run_1", "2026-11-02T08:00:00Z", [sku("2026-11-02T08:01:00Z", {}, "Inconsistência: produto=4.3 vs reviews=4.4")]),
    ];
    const expected = {
      runTimestamp: "2026-11-03T08:01:00Z",
      divergentSince: "2026-11-02T08:01:00Z",
    };
    // Real index format: { generatedAt, reports: [...] }
    fs.writeFileSync(path.join(dir, "index.json"), JSON.stringify({ generatedAt: "x", reports: index }));
    expect(loadPreviousRatingStates(undefined, dir).get("natura|BR|ecommerce|NATBRA-1")).toEqual(expected);
    // A bare array is accepted too
    fs.writeFileSync(path.join(dir, "index.json"), JSON.stringify(index));
    expect(loadPreviousRatingStates(undefined, dir).get("natura|BR|ecommerce|NATBRA-1")).toEqual(expected);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test("Firestore: rating states and run summary built from the run", () => {
    const result = (sku: string, feature: Record<string, unknown>) =>
      ({
        sku,
        name: "Produto",
        url: `https://x/p/a/${sku}`,
        vendor: "natura",
        country: "BR",
        timestamp: "2026-11-04T08:01:00Z",
        success: true,
        features: [{ featureKey: "ratingConsistency", feature: "Consistência", passed: true, message: "x".repeat(500), ...feature }],
      }) as unknown as PdpCheckResult;
    const results = [
      result("NATBRA-1", { status: "warning", details: { divergent: true, divergentSince: "2026-11-03T08:00:00Z" } }),
      result("NATBRA-2", { status: "pass" }),
      result("NATBRA-3", { status: "error" }),
    ];
    expect(ratingStatesOf(results, "web", ratingResultKey, (f) => f.status !== "error")).toEqual([
      { platform: "web", key: "natura|BR|ecommerce|NATBRA-1", runTimestamp: "2026-11-04T08:01:00Z", divergentSince: "2026-11-03T08:00:00Z" },
      // Consistent: no divergentSince, so the next divergence starts over
      { platform: "web", key: "natura|BR|ecommerce|NATBRA-2", runTimestamp: "2026-11-04T08:01:00Z" },
    ]);
    expect(ratingStateDocId("android", "natura|BR|ecommerce|A/B")).toBe("android|natura|BR|ecommerce|A_B");

    const entry = { runId: "run_1", startTime: "a", endTime: "b", durationMs: 1, summary: { total: 3, passed: 3, failed: 0, errors: 0 }, jsonPath: "reports/run_1/report.json" };
    const summary = buildRunSummary({ ...entry, results } as unknown as MonitoringReport, entry, "web");
    expect(summary.platform).toBe("web");
    expect(summary.results).toHaveLength(3);
    const feature = summary.results[0].features[0];
    expect(feature).not.toHaveProperty("details");
    expect(feature.message?.length).toBe(300);
    // Firestore rejects undefined fields
    expect(JSON.stringify(summary)).toBe(JSON.stringify(JSON.parse(JSON.stringify(summary))));
    expect(Object.values(summary.results[0]).includes(undefined)).toBe(false);

    expect(firestoreHistoryEnabled({ FIREBASE_PROJECT_ID: "p" })).toBe(true);
    expect(firestoreHistoryEnabled({ FIREBASE_PROJECT_ID: "p", FIRESTORE_HISTORY: "false" })).toBe(false);
    expect(firestoreHistoryEnabled({})).toBe(false);
    // Writes: CI only, or explicitly asked for locally
    expect(firestoreHistoryWritable({ FIREBASE_PROJECT_ID: "p" })).toBe(false);
    expect(firestoreHistoryWritable({ FIREBASE_PROJECT_ID: "p", GITHUB_ACTIONS: "true" })).toBe(true);
    expect(firestoreHistoryWritable({ FIREBASE_PROJECT_ID: "p", FIRESTORE_HISTORY: "true" })).toBe(true);
    expect(firestoreHistoryWritable({ FIREBASE_PROJECT_ID: "p", GITHUB_ACTIONS: "true", FIRESTORE_HISTORY: "false" })).toBe(false);
  });

  test("a run that didn't compare the ratings keeps the divergence's start", () => {
    const f = (status: string, details?: Record<string, unknown>, message = "") =>
      ({ featureKey: "ratingConsistency", feature: "x", passed: true, status, message, details }) as never;
    expect(isRatingComparison(f("pass"))).toBe(true);
    expect(isRatingComparison(f("fail", { divergent: true }))).toBe(true);
    expect(isRatingComparison(f("warning", { divergent: true, divergentSince: "2026-11-01T00:00:00Z" }))).toBe(true);
    expect(isRatingComparison(f("warning", {}, "Inconsistência: produto=4.3 vs reviews=4.4"))).toBe(true);
    // Product rating not captured / no reviews / N/A / error say nothing about the divergence
    expect(isRatingComparison(f("warning", {}, "Nota do produto (API /product) não capturada"))).toBe(false);
    expect(isRatingComparison(f("na"))).toBe(false);
    expect(isRatingComparison(f("error"))).toBe(false);

    const result = (sku: string, feature: unknown) =>
      ({ sku, vendor: "natura", country: "BR", timestamp: "t", features: [feature] }) as unknown as PdpCheckResult;
    expect(
      currentRatingStates([result("A", f("na")), result("B", f("pass"))], "web").map((s) => s.key),
    ).toEqual(["natura|BR|ecommerce|B"]);

    // In the reports: the older divergent run wins over a newer non-comparison
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rating-"));
    const run = (runId: string, startTime: string, feature: unknown) => {
      fs.mkdirSync(path.join(dir, runId));
      fs.writeFileSync(
        path.join(dir, runId, "report.json"),
        JSON.stringify({ results: [{ sku: "NATBRA-1", vendor: "natura", country: "BR", timestamp: startTime, features: [feature] }] }),
      );
      return { runId, startTime };
    };
    const reports = [
      run("run_2", "2026-11-03T08:00:00Z", f("warning", {}, "Nota do produto (API /product) não capturada")),
      run("run_1", "2026-11-02T08:00:00Z", f("warning", { divergent: true, divergentSince: "2026-11-01T08:00:00Z" })),
    ];
    fs.writeFileSync(path.join(dir, "index.json"), JSON.stringify({ reports }));
    expect(loadPreviousRatingStates(undefined, dir).get("natura|BR|ecommerce|NATBRA-1")?.divergentSince).toBe(
      "2026-11-01T08:00:00Z",
    );
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test("Web: the rating is compared with the product API from the header, not the reviews section", async ({ page }) => {
    const mock = `file://${path.join(process.cwd(), "src", "tests", "mocks", "pdp.html")}`;
    const pdp = (header: string) => `
      <div><span>${header}</span><button data-testid="go-to-reviews-button">(124) avaliações</button></div>
      <div style="height: 3000px"></div>
      <section id="reviews"><div data-testid="reviews-summary">4,4 de 5</div></section>`;
    await page.goto(mock);
    // The reviews section shows Konfidency's 4.4; the header shows SFCC's 4.3, same as the API
    await page.evaluate((body) => (document.body.innerHTML = body), pdp("4,3"));
    captureCache.set(page, { productRating: 4.3, productRatingSource: "ssr" });
    const same = await checkRating(page);
    expect(same.status).toBe("pass");
    expect(same.message).toBe("Nota 4.3 exibida (igual à API do produto)");

    await page.evaluate((body) => (document.body.innerHTML = body), pdp("4,1"));
    const diff = await checkRating(page);
    expect(diff.status).toBe("fail");
    expect(diff.message).toBe("Nota exibida 4.1 diferente da nota da API do produto (4.3)");
  });

  test("Android: header must show the product API rating; divergence uses the same rule", () => {
    const node = (id: string, text = "") => ({ id, text, desc: "" });
    const screen: ReviewsScreen = {
      sectionFound: true,
      headerFound: true,
      header: [node("tv_rt_value", "4,3"), node("tv_see_rating", "(124) avaliações")],
      section: [node("ratingTextView", "4.4"), node("tvTotalNumberReview", "124 avaliações"), node("main_container")],
      photosOnScreen: 0,
    };
    const onScreen = Object.fromEntries(evaluateReviewsScreen(screen).map((r) => [r.featureKey, r]));
    expect(onScreen.ratingConsistency.status).toBe("fail");
    expect(onScreen.ratingConsistency.details?.divergent).toBe(true);

    const api = {
      calls: [{ status: 200, url: "https://bff/reviews/v2/details?productId=NATBRA-122112" }],
      reviews: { aggregatedRating: 4.4, reviewsCount: 124, reviewsWithPictures: 0, pictureCount: 0 },
      product: { rating: 4.4 },
    };
    const withApi = Object.fromEntries(
      applyAppReviewsApi(evaluateReviewsScreen(screen), api, null).map((r) => [r.featureKey, r]),
    );
    expect(withApi.rating.status).toBe("fail");
    expect(withApi.rating.message).toBe("Nota exibida 4.3 diferente da nota da API do produto (4.4)");
    expect(withApi.ratingConsistency.status).toBe("pass");
  });
});
