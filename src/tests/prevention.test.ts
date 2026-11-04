/**
 * Guards against wrong verdicts: contradicting results become inconclusive (contradictions.ts),
 * failures carry what was seen (reviews endpoint evidence), and new failures are told apart from
 * ongoing ones (reportHistory.ts).
 */
import { test, expect } from "@playwright/test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { flagContradictions } from "../contradictions.js";
import {
  buildFeatureHistory,
  markNewFailures,
  readPreviousRuns,
  type PreviousRun,
} from "../reportHistory.js";
import { applyAppReviewsApi } from "../checks-android/reviews.js";
import type { CheckResult, PdpCheckResult } from "../types.js";

const check = (featureKey: string, status: CheckResult["status"], details?: Record<string, unknown>, message = "msg"): CheckResult => ({
  feature: featureKey,
  featureKey,
  passed: status !== "fail" && status !== "error",
  status,
  message,
  ...(details ? { details } : {}),
});

test.describe("Contradições viram inconclusivo", () => {
  test('"API de avaliações não chamada" com avaliações na tela vira error', () => {
    const [reviews, endpoint] = flagContradictions([
      check("reviews", "pass", { reviewCount: 12 }),
      check("endpoint_reviews", "fail", { notCalled: true }, "O app não chamou a API"),
    ]);
    expect(reviews.status).toBe("pass");
    expect(endpoint.status).toBe("error");
    expect(endpoint.message).toMatch(/^Inconclusivo \(verificar a automação\): a tela mostrou 12 avaliação/);
    expect(endpoint.details?.inconclusive).toMatchObject({ originalStatus: "fail", originalMessage: "O app não chamou a API" });
  });

  test("sem avaliações na tela, a falha do endpoint fica", () => {
    const out = flagContradictions([
      check("reviews", "pass", { reviewCount: 0 }),
      check("rating", "na"),
      check("endpoint_reviews", "fail", { notCalled: true }),
    ]);
    expect(out[2].status).toBe("fail");
  });

  test("falha por status HTTP (sem notCalled) nunca é tocada", () => {
    const out = flagContradictions([
      check("reviews", "pass", { reviewCount: 5 }),
      check("endpoint_reviews", "fail", { failedCalls: [{ status: 500 }] }),
    ]);
    expect(out[1].status).toBe("fail");
  });

  test("carrossel não encontrado com imagens baixadas pelo app vira error; sem download fica fail", () => {
    const downloaded = flagContradictions([check("images", "fail", { hasCarousel: false, api: { downloadedCount: 3 } })]);
    expect(downloaded[0].status).toBe("error");
    const none = flagContradictions([check("images", "fail", { hasCarousel: false, api: { downloadedCount: 0 } })]);
    expect(none[0].status).toBe("fail");
  });

  test("banners fora da tela com imagens baixadas vira error", () => {
    const out = flagContradictions([check("contentBanners", "fail", { notOnScreen: true, api: { downloadedCount: 2 } })]);
    expect(out[0].status).toBe("error");
  });
});

test.describe("Evidência nas falhas", () => {
  test('"não chamou a API de avaliações" lista o que foi procurado e o que a sessão chamou', () => {
    const out = applyAppReviewsApi(
      [check("reviews", "pass", { reviewCount: 0 }), check("topRatedBadge", "pass")],
      {
        calls: [],
        matchedIds: ["NATARG-00068", "NATARG-110181"],
        otherSessionCalls: [{ productId: "NATARG-81950", status: 200 }],
      },
      null,
    );
    const endpoint = out.find((f) => f.featureKey === "endpoint_reviews")!;
    expect(endpoint.status).toBe("fail");
    expect(endpoint.message).toContain("procurado productId: NATARG-00068, NATARG-110181");
    expect(endpoint.message).toContain("productId=NATARG-81950 (200)");
    expect(endpoint.details).toMatchObject({ notCalled: true, otherSessionCalls: [{ productId: "NATARG-81950", status: 200 }] });
  });
});

const result = (sku: string, features: CheckResult[], timestamp: string): PdpCheckResult => ({
  sku,
  name: sku,
  url: "",
  vendor: "natura",
  country: "BR",
  timestamp,
  success: true,
  features,
});

test.describe("Falha nova × falha que persiste", () => {
  // Newest first, like readPreviousRuns
  const runs: PreviousRun[] = [
    { runId: "r3", startTime: "2026-11-03", results: [result("A", [check("reviews", "fail"), check("images", "pass")], "2026-11-03T08:00:00Z")] },
    { runId: "r2", startTime: "2026-11-02", results: [result("A", [check("reviews", "error"), check("images", "fail")], "2026-11-02T08:00:00Z")] },
    { runId: "r1", startTime: "2026-11-01", results: [result("A", [check("reviews", "pass")], "2026-11-01T08:00:00Z")] },
  ];

  test("marca nova quando o run anterior não falhava, e desde quando quando persiste", () => {
    const current = [
      result("A", [check("reviews", "fail"), check("images", "fail"), check("rating", "fail"), check("brand", "pass")], "2026-11-04T08:00:00Z"),
    ];
    const count = markNewFailures(current, buildFeatureHistory(runs));
    const byKey = Object.fromEntries(current[0].features.map((f) => [f.featureKey, f]));
    // reviews: failing in r3 and r2 (error counts), passing in r1 → since r2
    expect(byKey.reviews).toMatchObject({ newFailure: false, failingSince: "2026-11-02T08:00:00Z" });
    // images: passed in the newest previous run → new, even though it failed before
    expect(byKey.images.newFailure).toBe(true);
    // rating: never checked before → new
    expect(byKey.rating.newFailure).toBe(true);
    expect(byKey.brand.newFailure).toBeUndefined();
    expect(count).toBe(2);
  });

  test("readPreviousRuns lê o índice do mais novo para o mais antigo e pula runs sem report", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hist-"));
    fs.writeFileSync(
      path.join(dir, "index.json"),
      JSON.stringify({ reports: [
        { runId: "old", startTime: "2026-11-01T00:00:00Z" },
        { runId: "missing", startTime: "2026-11-03T00:00:00Z" },
        { runId: "new", startTime: "2026-11-02T00:00:00Z" },
      ] }),
    );
    for (const id of ["old", "new"]) {
      fs.mkdirSync(path.join(dir, id));
      fs.writeFileSync(path.join(dir, id, "report.json"), JSON.stringify({ results: [] }));
    }
    expect(readPreviousRuns(undefined, dir).map((r) => r.runId)).toEqual(["new", "old"]);
    expect(readPreviousRuns(undefined, dir, "new").map((r) => r.runId)).toEqual(["old"]);
  });
});
