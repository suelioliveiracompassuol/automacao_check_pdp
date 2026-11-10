/**
 * The Web checkers against REAL PDP captures (src/tests/fixtures/web, made with
 * `npm run fixtures:web`). Each fixture is served offline (every other request is aborted): the
 * hydrated DOM as the document, the captured API responses replayed through the page so the
 * pre-navigation captures see them as on the live site.
 *
 * Three kinds of assertion:
 * - Fidelity: each checker says on the fixture what it said on the live page (.meta.json). Keeps
 *   the snapshot honest, so the other assertions are about the site, not about the snapshot.
 * - Independent source: the verdict agrees with the APIs of the same capture (variations in the
 *   SSR product payload, review count / photos / recommendation in the reviews API). The checker
 *   reads the DOM; these read the network, so a selector that drifts away from the real markup
 *   shows up here instead of as a wrong verdict in production.
 * - Privacy: no reviewer's name or text and no API key made it into the committed files.
 *
 * New capture → new fixture → covered here with no test changes.
 */
import { test, expect, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";
import { PDP_ENDPOINT_RULES } from "../checks/configs/endpoints-rules.js";
import { setupEndpointMonitor } from "../checks/endpointResponse.js";
import { checkProductVariations, setupProductVariationsCapture } from "../checks/productVariations.js";
import { setupProductBadgesCapture } from "../checks/productBadges.js";
import { setupRemoteConfigCapture, COUNTRY_TO_LOCALE, type RemoteConfigFlags } from "../checks/remoteConfig.js";
import { extractRscPayload, findSsrProduct, parseRscRows } from "../checks/ssrProduct.js";
import { PERSONAL_REVIEW_FIELDS, REDACTED } from "../fixtureRedaction.js";
import type { CheckResult } from "../types.js";
import { sleepMs } from "../utils.js";
import { WEB_FIXTURE_CHECKERS, type WebFixtureEntry, type WebFixtureMeta } from "../webFixtures.js";

const DIR = path.join(process.cwd(), "src", "tests", "fixtures", "web");

interface WebFixture {
  name: string;
  meta: WebFixtureMeta;
  entries: WebFixtureEntry[];
  html: string;
}

const gunzip = (file: string) => zlib.gunzipSync(fs.readFileSync(path.join(DIR, file))).toString("utf-8");

const fixtures: WebFixture[] = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith(".meta.json"))
  .map((f) => {
    const name = f.replace(/\.meta\.json$/, "");
    return {
      name,
      meta: JSON.parse(fs.readFileSync(path.join(DIR, f), "utf-8")) as WebFixtureMeta,
      entries: (JSON.parse(gunzip(`${name}.har.json.gz`)) as { entries: WebFixtureEntry[] }).entries,
      html: gunzip(`${name}.dom.html.gz`),
    };
  });

const normalizeUrl = (url: string) => {
  try {
    return new URL(url).href;
  } catch {
    return url;
  }
};

/**
 * Opens a fixture: the monitor's pre-navigation captures, the DOM as the PDP document, then the
 * captured API calls replayed from the page. `html` overrides the DOM (to simulate a change).
 */
async function openFixture(
  page: Page,
  fx: WebFixture,
  html = fx.html,
): Promise<{ collectEndpoints: () => Promise<CheckResult[]>; collectRemoteConfig: () => Promise<RemoteConfigFlags | null> }> {
  const collectEndpoints = setupEndpointMonitor(page, PDP_ENDPOINT_RULES);
  const collectRemoteConfig = setupRemoteConfigCapture(page, COUNTRY_TO_LOCALE[fx.meta.source.country] ?? "pt-BR");
  setupProductVariationsCapture(page, fx.meta.source.sku);
  setupProductBadgesCapture(page, fx.meta.source.sku);

  const pageUrl = normalizeUrl(fx.meta.source.url);
  const byUrl = new Map<string, WebFixtureEntry[]>();
  for (const e of fx.entries) {
    const key = `${e.method} ${normalizeUrl(e.url)}`;
    byUrl.set(key, [...(byUrl.get(key) ?? []), e]);
  }
  const served = new Map<string, number>();

  await page.route("**/*", async (route) => {
    const req = route.request();
    const url = normalizeUrl(req.url());
    if (req.isNavigationRequest() && url === pageUrl) {
      return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html });
    }
    const key = `${req.method()} ${url}`;
    const list = byUrl.get(key);
    if (!list) {
      return route.abort();
    }
    // Same URL captured more than once (refetches): served in capture order, then the last one
    const n = served.get(key) ?? 0;
    served.set(key, n + 1);
    const e = list[Math.min(n, list.length - 1)];
    return route.fulfill({
      status: e.status,
      contentType: e.contentType || "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: e.body ?? "",
    });
  });

  await page.goto(fx.meta.source.url, { waitUntil: "load" });
  await page.evaluate(
    (calls) => Promise.all(calls.map((c) => fetch(c.url, { method: c.method }).then((r) => r.text()).catch(() => ""))),
    fx.entries.map((e) => ({ url: e.url, method: e.method })),
  );
  // The response listeners read bodies asynchronously
  await sleepMs(500);
  return { collectEndpoints, collectRemoteConfig: () => collectRemoteConfig(500) };
}

/** Every checker of the fixture list on the page, in parallel like the monitor's read-only phase. */
async function runCheckers(page: Page): Promise<Record<string, CheckResult>> {
  const results = await Promise.all(
    Object.entries(WEB_FIXTURE_CHECKERS).map(async ([key, checker]) => [key, await checker(page)] as const),
  );
  return Object.fromEntries(results);
}

const statusOf = (r: CheckResult | undefined) => (r ? (r.status ?? (r.passed ? "pass" : "fail")) : "ausente");

// ---------------------------------------------------------------------------
// Facts read from the capture's network, independently of the checkers
// ---------------------------------------------------------------------------

interface ReviewsApiBody {
  reviewsCount?: number;
  recommendedPercentage?: number;
  reviews?: { pictures?: unknown[] }[];
}

/** The reviews list the PDP shows first (default sort, no media filter). */
function defaultReviewsCall(fx: WebFixture): ReviewsApiBody | undefined {
  const e = fx.entries.find(
    (x) => x.url.includes("/reviews/v2/details") && !x.url.includes("filterMedia") && x.status === 200 && x.body,
  );
  return e ? (JSON.parse(e.body!) as ReviewsApiBody) : undefined;
}

function picturesOnFirstPage(body: ReviewsApiBody): number {
  return (body.reviews ?? []).reduce((n, r) => n + (Array.isArray(r.pictures) ? r.pictures.length : 0), 0);
}

/** Variations of the product the server rendered (SSR payload), or undefined when not found. */
function ssrVariationsCount(fx: WebFixture): number | undefined {
  const variations = findSsrProduct(fx.html, fx.meta.source.sku)?.variations;
  return Array.isArray(variations) ? variations.length : undefined;
}

/**
 * Verdicts by feature key, as the fields to compare: `status`, `passes` (status is "pass"),
 * `noCalls` (endpoint rule saw nothing) or a `details` field. Expected and observed use the same
 * fields, so one toEqual compares them and a mismatch shows every feature at once.
 */
type Verdicts = Record<string, Record<string, unknown>>;

function fieldOf(r: CheckResult | undefined, field: string): unknown {
  if (field === "status") {
    return statusOf(r);
  }
  if (field === "passes") {
    return statusOf(r) === "pass";
  }
  if (field === "noCalls") {
    return r?.message.includes("Nenhuma chamada") ?? false;
  }
  return r?.details?.[field];
}

function observe(expected: Verdicts, results: Record<string, CheckResult>): Verdicts {
  return Object.fromEntries(
    Object.entries(expected).map(([key, fields]) => [
      key,
      Object.fromEntries(Object.keys(fields).map((f) => [f, fieldOf(results[key], f)])),
    ]),
  );
}

/** What the capture's network says each verdict must be (only what it can tell). */
function expectedFromNetwork(
  fx: WebFixture,
  reviews: ReviewsApiBody,
  reviewsFlags: RemoteConfigFlags["product_reviews"] | undefined,
): Verdicts {
  const expected: Verdicts = {};

  // Variations: the SSR product payload is the truth; the selector has to find them all
  const variations = ssrVariationsCount(fx) ?? 0;
  expected.productVariations = variations > 1 ? { status: "pass", variationsCount: variations } : { status: "na" };

  // Filter / sort: a product with reviews never gets the "sem avaliações" verdict
  const count = reviews.reviewsCount ?? 0;
  if (count > 0 && reviewsFlags?.filter !== false) {
    expected.reviewFilter = { status: "pass" };
  }
  if (count > 0 && reviewsFlags?.sort !== false) {
    expected.reviewSort = { status: "pass" };
  }

  // Photos: thumbnails on screen = pictures of the first page of reviews
  const pictures = picturesOnFirstPage(reviews);
  expected.reviewPhotos = pictures > 0 ? { status: "pass", photoCount: pictures } : { passes: false };

  // Recommendation: the percentage on screen is the API's, rounded
  const pct = reviews.recommendedPercentage ?? 0;
  if (count > 4 && pct > 0) {
    expected.reviewRecommendation = { status: "pass", percentage: Math.round(pct) };
  }

  // Real pages expose no translation keys (guards the i18n regex against false positives)
  expected.i18nKeys = { status: "pass" };
  return expected;
}

/** Each endpoint rule against the calls in the capture. */
function expectedEndpoints(fx: WebFixture): Verdicts {
  return Object.fromEntries(
    PDP_ENDPOINT_RULES.map((rule) => {
      const calls = fx.entries.filter((e) => e.url.includes(rule.match));
      return [
        `endpoint_${rule.key}`,
        calls.length === 0
          ? { noCalls: true }
          : { status: calls.every((c) => c.status < 400) ? "pass" : "fail", totalCalls: calls.length },
      ];
    }),
  );
}

/** Personal review fields left with real content in the reviews API bodies or the RSC payload. */
function personalLeaks(fx: WebFixture): string[] {
  const personal = new Set(PERSONAL_REVIEW_FIELDS.filter((f) => f !== "title"));
  const leaks: string[] = [];
  const walk = (value: unknown, where: string) => {
    if (!value || typeof value !== "object") {
      return;
    }
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (personal.has(k) && typeof v === "string" && v !== "" && v !== REDACTED) {
        leaks.push(`${where}: ${k}`);
      }
      walk(v, where);
    }
  };
  for (const e of fx.entries.filter((x) => x.url.includes("/reviews/v2") && x.body)) {
    walk(JSON.parse(e.body!), e.url);
  }
  for (const row of parseRscRows(extractRscPayload(fx.html))) {
    walk(row, "RSC");
  }
  return leaks;
}

// ---------------------------------------------------------------------------

test.describe("Web: checkers contra capturas reais", () => {
  test.describe.configure({ timeout: 180_000 });

  test("há fixtures de mais de uma operação", () => {
    const operations = new Set(fixtures.map((f) => `${f.meta.source.vendor}-${f.meta.source.country}-${f.meta.source.channel}`));
    expect(fixtures.length).toBeGreaterThan(0);
    expect(operations.size).toBeGreaterThan(1);
  });

  for (const fx of fixtures) {
    test.describe(fx.name, () => {
      test("fidelidade: cada checker dá na fixture o mesmo veredito da página real", async ({ page }) => {
        const { collectEndpoints } = await openFixture(page, fx);
        const results = await runCheckers(page);
        for (const r of await collectEndpoints()) {
          results[r.featureKey] = r;
        }

        const observed = Object.fromEntries(Object.keys(fx.meta.live).map((k) => [k, statusOf(results[k])]));
        const expected = Object.fromEntries(Object.entries(fx.meta.live).map(([k, v]) => [k, v.status]));
        expect(observed).toEqual(expected);
      });

      test("fonte independente: vereditos batem com as APIs da mesma captura", async ({ page }) => {
        const reviews = defaultReviewsCall(fx);
        expect(ssrVariationsCount(fx), "produto não encontrado no payload SSR").toBeDefined();
        expect(reviews, "chamada de avaliações não capturada").toBeDefined();

        const { collectRemoteConfig } = await openFixture(page, fx);
        const results = await runCheckers(page);
        const flags = await collectRemoteConfig();

        const expected = expectedFromNetwork(fx, reviews!, flags?.product_reviews);
        expect(observe(expected, results)).toEqual(expected);
      });

      test("endpoints: cada regra reflete as chamadas da captura", async ({ page }) => {
        const { collectEndpoints } = await openFixture(page, fx);
        const results = Object.fromEntries((await collectEndpoints()).map((r) => [r.featureKey, r]));
        const expected = expectedEndpoints(fx);
        expect(observe(expected, results)).toEqual(expected);
      });

      test("privacidade: sem nome/texto de avaliador nem chave de API nos arquivos", () => {
        expect(personalLeaks(fx)).toEqual([]);
        expect(fx.html + JSON.stringify(fx.entries)).not.toMatch(/AIza[0-9A-Za-z_-]{35}/);
      });
    });
  }

  // A selector that drifts away from the real markup must fail, not turn into "N/A"
  test("variações: seletor quebrado com variações no SSR falha (não vira N/A)", async ({ page }) => {
    const fx = fixtures.find((f) => (ssrVariationsCount(f) ?? 0) > 1);
    expect(fx, "nenhuma fixture com variações").toBeDefined();

    const broken = fx!.html.replace(/data-testid="color-option"/g, 'data-testid="renamed-option"');
    await openFixture(page, fx!, broken);
    const result = await checkProductVariations(page);
    expect({ status: statusOf(result), ...result.details }).toMatchObject({
      status: "fail",
      variationsCount: ssrVariationsCount(fx!),
      source: "ssr",
    });
  });
});
