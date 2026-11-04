/**
 * Saves a real Android session's network capture as a test fixture, so the network matchers
 * (appNetworkFlags.ts) are tested against what the app really sends instead of hand-written
 * examples that repeat the code's own assumptions.
 *
 *   npm run fixtures:android -- <lambdatestSessionId> <runId> [name]
 *
 * Writes to src/tests/fixtures/android/:
 * - <name>.har.json: only the PDP API, reviews API and image download entries (URL, status,
 *   body; no headers, cookies or tokens). Reviewers' names and texts are replaced.
 * - <name>.screen.json: per SKU, what the app SHOWED in that run (docs/reports/<runId>/report.json:
 *   review count, header and section ratings, image count). The tests cross what the matchers read
 *   from the network with this independent source (src/tests/android-fixtures.test.ts).
 */
import "./loadEnv.js";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  extractNetworkEntries,
  extractPdpContentBanners,
  extractPdpImageUrls,
  fetchLambdaTestNetworkLog,
} from "./checks-android/appNetworkFlags.js";
import type { PdpCheckResult } from "./types.js";

const FIXTURES_DIR = path.join(process.cwd(), "src", "tests", "fixtures", "android");
const REDACTED = "[removido]";
const PERSONAL_REVIEW_FIELDS = ["customerName", "comment", "originalComment", "title", "nickname", "email"];

const PDP_API = /\/pages\/v2\/product\/([^/?]+)/;
const withoutQuery = (url: string) => url.split("?")[0];

/** Query params with the logged-in test account's data (the app sends ?email= on the PDP API). */
const PERSONAL_QUERY_PARAMS = ["email", "cpf", "phone", "customerId", "token", "access_token"];

function sanitizeUrl(url: string): string {
  try {
    const u = new URL(url);
    for (const param of PERSONAL_QUERY_PARAMS) {
      if (u.searchParams.has(param)) {
        u.searchParams.set(param, REDACTED);
      }
    }
    return u.toString();
  } catch {
    return url.replace(/([?&](?:email|cpf|phone|token)=)[^&]*/gi, `$1${REDACTED}`);
  }
}

function redactReviews(body: string): string {
  try {
    const json = JSON.parse(body) as Record<string, unknown>;
    const data = (json.reviews ? json : (json.data as Record<string, unknown>)) ?? json;
    for (const review of Array.isArray(data.reviews) ? data.reviews : []) {
      for (const field of PERSONAL_REVIEW_FIELDS) {
        if (review && typeof review === "object" && field in review) {
          (review as Record<string, unknown>)[field] = REDACTED;
        }
      }
    }
    if ("aiSummary" in data) {
      data.aiSummary = REDACTED;
    }
    return JSON.stringify(json);
  } catch {
    return body;
  }
}

function screenFacts(result: PdpCheckResult) {
  const byKey = new Map(result.features.map((f) => [f.featureKey, f]));
  const ratings = (byKey.get("rating")?.details?.ratings ?? {}) as { header?: number; section?: number };
  const reviewCount = byKey.get("reviews")?.details?.reviewCount;
  const imageCount = byKey.get("images")?.details?.imageCount;
  return {
    name: result.name,
    vendor: result.vendor,
    country: result.country,
    ...(typeof reviewCount === "number" ? { reviewCount } : {}),
    ...(ratings.header !== undefined ? { headerRating: ratings.header } : {}),
    ...(ratings.section !== undefined ? { sectionRating: ratings.section } : {}),
    ...(typeof imageCount === "number" ? { imageCount } : {}),
  };
}

async function main(): Promise<void> {
  const [sessionId, runArg, nameArg] = process.argv.slice(2);
  if (!sessionId || !runArg) {
    console.error("Uso: npm run fixtures:android -- <lambdatestSessionId> <runId | caminho do report.json> [nome]");
    process.exit(1);
  }
  // A run of another branch can be passed as a path (e.g. git show origin/master:docs/reports/<runId>/report.json > r.json)
  const reportPath = runArg.endsWith(".json")
    ? path.resolve(runArg)
    : path.join(process.cwd(), "docs", "reports", runArg, "report.json");
  const runId = runArg.endsWith(".json") ? path.basename(path.dirname(reportPath)) : runArg;
  const report = JSON.parse(fs.readFileSync(reportPath, "utf-8")) as { results: PdpCheckResult[] };

  console.log(`⬇️  Baixando o log de rede da sessão ${sessionId}...`);
  const entries = extractNetworkEntries(await fetchLambdaTestNetworkLog(sessionId));

  // SKUs of this session: the ones whose PDP API the app called
  const skus = [...new Set(entries.map((e) => PDP_API.exec(e.url)?.[1]).filter((s): s is string => !!s))];
  const results = report.results.filter((r) => skus.includes(r.sku));
  if (results.length === 0) {
    console.error(`Nenhum SKU do run ${runId} aparece no log da sessão (SKUs no log: ${skus.join(", ") || "nenhum"}).`);
    process.exit(1);
  }

  // Image URLs the PDP API listed (product carousel and content banners): their downloads are kept
  const imageUrls = new Set<string>();
  for (const e of entries.filter((x) => PDP_API.test(x.url) && x.body)) {
    try {
      const body = JSON.parse(e.body!) as Record<string, unknown>;
      const sku = PDP_API.exec(e.url)![1];
      for (const url of extractPdpImageUrls(body, sku).urls) {imageUrls.add(withoutQuery(url));}
      for (const c of extractPdpContentBanners(body)) {for (const url of c.urls) {imageUrls.add(withoutQuery(url));}}
    } catch {
      // body not JSON
    }
  }

  const kept = entries
    .filter((e) => PDP_API.test(e.url) || e.url.includes("/reviews/v2/") || imageUrls.has(withoutQuery(e.url)))
    .map((e) => {
      const isImage = imageUrls.has(withoutQuery(e.url));
      const body = isImage || !e.body ? undefined : e.url.includes("/reviews/v2/") ? redactReviews(e.body) : e.body;
      return {
        request: { url: sanitizeUrl(e.url) },
        response: { ...(e.status !== undefined ? { status: e.status } : {}), ...(body ? { content: { text: body } } : {}) },
      };
    });

  const name = nameArg ?? `${runId}_${results[0].vendor}-${results[0].country}`.toLowerCase();
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  const harPath = path.join(FIXTURES_DIR, `${name}.har.json`);
  const screenPath = path.join(FIXTURES_DIR, `${name}.screen.json`);
  fs.writeFileSync(harPath, JSON.stringify({ log: { entries: kept } }));
  fs.writeFileSync(
    screenPath,
    JSON.stringify(
      {
        source: { runId, sessionId, capturedAt: new Date().toISOString() },
        skus: Object.fromEntries(results.map((r) => [r.sku, screenFacts(r)])),
      },
      null,
      2,
    ) + "\n",
  );
  const kb = (p: string) => `${Math.round(fs.statSync(p).size / 1024)} KB`;
  console.log(`✅ ${kept.length} de ${entries.length} requisições salvas em ${harPath} (${kb(harPath)})`);
  console.log(`✅ Fatos da tela de ${results.length} SKU(s) em ${screenPath}`);
}

main().catch((err) => {
  console.error("Erro:", err);
  process.exit(1);
});
