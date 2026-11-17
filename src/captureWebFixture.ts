/**
 * Saves a real Web PDP as a test fixture, so the Web checkers are tested against what the sites
 * really render and return instead of hand-written HTML that repeats the code's own assumptions
 * (the Web counterpart of `npm run fixtures:android`).
 *
 *   npm run fixtures:web -- <SKU>[:sc] [name]
 *
 * Opens the PDP the way the monitor does (same context, cookie banner, scroll), runs the
 * read-only checkers on the live page and writes to src/tests/fixtures/web/:
 * - <name>.dom.html.gz: the hydrated DOM, self-contained. Stylesheets and executable scripts are
 *   removed; each element's real visibility is baked into an inline style (hidden ones get
 *   `display:none`, zero-size ones `width:0;height:0`, visible ones a minimum size), so
 *   visibility checks behave as on the live page. Inline SSR payload scripts (RSC
 *   `self.__next_f`, `__NEXT_DATA__`, JSON-LD) are kept as non-executable text: the SSR
 *   captures read them from the document. Reviewers' names and texts are replaced.
 * - <name>.har.json.gz: the API responses the checkers read (product, reviews, Einstein, Remote
 *   Config, Commerce feature flags): URL, method, status, content type and body. No headers,
 *   cookies or tokens; reviews redacted.
 * - <name>.meta.json: SKU, URL, capture time and what each checker said on the LIVE page.
 *
 * src/tests/web-fixtures.test.ts replays them offline: verdicts must match the live page
 * (fidelity of the fixture) and agree with the APIs in the same capture (independent source).
 */
import "./loadEnv.js";
import { chromium, firefox, type Page, type Response } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";
import { createStandardContext } from "./browserSetup.js";
import { buildPdpUrl } from "./checks/configs/config.js";
import { loadSkusWithSource } from "./checks/configs/skus/skus.js";
import { PDP_ENDPOINT_RULES } from "./checks/configs/endpoints-rules.js";
import { setupEndpointMonitor } from "./checks/endpointResponse.js";
import { dismissCookieBanner, scrollAndLoadContent } from "./checks/featureRunner.js";
import { setupProductBadgesCapture, setupProductVariationsCapture } from "./checks/index.js";
import {
  REDACTED,
  redactPersonalFieldsInText,
  redactReviews,
  redactSecrets,
  sanitizeUrl,
} from "./fixtureRedaction.js";
import {
  WEB_FIXTURE_CHECKERS,
  isFixtureApi,
  type WebFixtureEntry,
  type WebFixtureMeta,
} from "./webFixtures.js";

const FIXTURES_DIR = path.join(process.cwd(), "src", "tests", "fixtures", "web");

function redactBody(url: string, body: string): string {
  return redactSecrets(redactPersonalFieldsInText(url.includes("/reviews/v2") ? redactReviews(body) : body));
}

/**
 * Self-contained copy of the hydrated DOM (see the file header). Runs in the page; elements of
 * the live document and of its clone are walked in the same order.
 */
async function snapshotDom(page: Page): Promise<string> {
  return page.evaluate((redacted) => {
    const live = document.documentElement;
    const clone = live.cloneNode(true) as HTMLElement;
    const liveEls = [live, ...Array.from(live.querySelectorAll("*"))];
    const cloneEls = [clone, ...Array.from(clone.querySelectorAll("*"))];
    const toRemove: Element[] = [];

    for (let i = 0; i < liveEls.length; i++) {
      const el = liveEls[i];
      const copy = cloneEls[i];
      const tag = el.tagName;

      if (tag === "SCRIPT") {
        const type = (el.getAttribute("type") ?? "").toLowerCase();
        const text = el.textContent ?? "";
        const isData = type === "application/ld+json" || type === "application/json";
        const isSsrPayload = !el.hasAttribute("src") && /__next_f|productId/.test(text);
        if (isData) {
          continue;
        }
        if (isSsrPayload) {
          // Kept for the SSR captures (they regex the document text), but never executed
          copy.setAttribute("type", "text/plain");
          copy.setAttribute("data-fixture-ssr", "");
          continue;
        }
        toRemove.push(copy);
        continue;
      }
      if (["STYLE", "NOSCRIPT", "IFRAME", "OBJECT", "EMBED", "VIDEO", "AUDIO", "CANVAS"].includes(tag)) {
        toRemove.push(copy);
        continue;
      }
      if (tag === "LINK") {
        const rel = (el.getAttribute("rel") ?? "").toLowerCase();
        if (!rel.includes("canonical") && !rel.includes("alternate")) {
          toRemove.push(copy);
        }
        continue;
      }
      if (["HTML", "HEAD", "META", "TITLE", "BASE"].includes(tag)) {
        continue;
      }

      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      let baked: string;
      if (style.display === "none") {
        baked = "display:none";
      } else if (style.visibility === "hidden") {
        baked = "visibility:hidden";
      } else if (rect.width > 0 && rect.height > 0) {
        const display = style.display === "inline" ? "inline-block" : style.display;
        baked = `display:${display};min-width:1px;min-height:1px`;
      } else {
        baked = "display:block;width:0;height:0;min-width:0;min-height:0;padding:0;border:0;overflow:hidden";
      }
      copy.setAttribute("style", baked);
    }

    for (const el of toRemove) {
      el.remove();
    }

    // Icons: the <svg> element (and its baked size) stays, its drawing goes
    for (const svg of Array.from(clone.querySelectorAll("svg"))) {
      svg.innerHTML = "";
    }

    // Reviewers' names, texts and photo captions
    // (a review card is a role="group" with its own stars; the AI summary group has none)
    const cards = clone.querySelectorAll(
      '#reviews [role="group"]:has([data-testid="filled-action-rating"], [data-testid="outlined-action-rating"]), [data-testid="review-card"], [class*="review-card"]',
    );
    for (const card of Array.from(cards)) {
      const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        if (/\p{L}{2,}/u.test(node.textContent ?? "")) {
          node.textContent = redacted;
        }
      }
      for (const el of [card, ...Array.from(card.querySelectorAll("*"))]) {
        for (const attr of ["alt", "title", "aria-label"]) {
          if (el.hasAttribute(attr)) {
            el.setAttribute(attr, redacted);
          }
        }
      }
    }

    return `<!DOCTYPE html>\n${clone.outerHTML}`;
  }, REDACTED);
}

async function main(): Promise<void> {
  const [skuArg, nameArg] = process.argv.slice(2);
  if (!skuArg) {
    console.error("Uso: npm run fixtures:web -- <SKU>[:sc] [nome]");
    process.exit(1);
  }
  const [skuCode, suffix] = skuArg.split(":");
  const channel = suffix === "sc" ? "socialcommerce" : "ecommerce";
  const { skus } = await loadSkusWithSource();
  const sku = skus.find((s) => s.sku === skuCode && (s.channel ?? "ecommerce") === channel);
  if (!sku) {
    console.error(`SKU ${skuArg} não está na lista de SKUs (Firestore / config/skus.json).`);
    process.exit(1);
  }

  const url = buildPdpUrl(sku);
  // Same browser choice as the monitor (src/index.ts)
  const useFirefox = sku.vendor === "natura" && sku.country !== "BR" && channel === "ecommerce";
  const browserType = useFirefox ? firefox : chromium;
  const browser = await browserType.launch({
    headless: process.env.HEADLESS !== "false",
    ...(useFirefox
      ? {}
      : { args: ["--disable-blink-features=AutomationControlled", "--no-sandbox", "--disable-dev-shm-usage"] }),
  });

  try {
    const context = await createStandardContext(browser, url);
    const page = await context.newPage();

    const entries: WebFixtureEntry[] = [];
    const pendingBodies: Promise<void>[] = [];
    page.on("response", (response: Response) => {
      const resUrl = response.url();
      const method = response.request().method();
      if (method === "OPTIONS" || !isFixtureApi(resUrl)) {
        return;
      }
      const entry: WebFixtureEntry = {
        url: sanitizeUrl(resUrl),
        method,
        status: response.status(),
        contentType: response.headers()["content-type"] ?? "",
      };
      entries.push(entry);
      pendingBodies.push(
        response
          .text()
          .then((body) => {
            entry.body = redactBody(resUrl, body);
          })
          .catch(() => {}),
      );
    });

    // Same pre-navigation captures as the monitor, for the live verdicts
    const collectEndpoints = setupEndpointMonitor(page, PDP_ENDPOINT_RULES);
    setupProductVariationsCapture(page, sku.sku);
    setupProductBadgesCapture(page, sku.sku);

    console.log(`🌐 Abrindo ${url} (${useFirefox ? "firefox" : "chromium"})...`);
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    if (!response || response.status() >= 400) {
      throw new Error(`HTTP ${response?.status() ?? "?"} ao abrir a PDP (bloqueio do WAF?)`);
    }
    await page.waitForLoadState("load", { timeout: 15000 }).catch(() => {});
    await dismissCookieBanner(page);
    await scrollAndLoadContent(page);

    console.log("🔎 Rodando os checkers na página real...");
    const live: WebFixtureMeta["live"] = {};
    const results = await Promise.all(
      Object.entries(WEB_FIXTURE_CHECKERS).map(async ([key, checker]) => [key, await checker(page)] as const),
    );
    for (const [key, r] of results) {
      live[key] = { status: r.status ?? (r.passed ? "pass" : "fail"), message: r.message };
    }
    for (const r of await collectEndpoints()) {
      live[r.featureKey] = { status: r.status ?? (r.passed ? "pass" : "fail"), message: r.message };
    }

    const html = redactSecrets(redactPersonalFieldsInText(await snapshotDom(page)));
    await Promise.allSettled(pendingBodies);

    const name = nameArg ?? `${sku.vendor}-${sku.country}_${sku.sku}${channel === "socialcommerce" ? "_sc" : ""}`.toLowerCase();
    const meta: WebFixtureMeta = {
      source: {
        sku: sku.sku,
        vendor: sku.vendor,
        country: sku.country,
        channel,
        url,
        browser: useFirefox ? "firefox" : "chromium",
        capturedAt: new Date().toISOString(),
      },
      live,
    };

    fs.mkdirSync(FIXTURES_DIR, { recursive: true });
    // DOM and responses are gzipped (~10x smaller); zcat/gunzip -k to read them
    const domPath = path.join(FIXTURES_DIR, `${name}.dom.html.gz`);
    const harPath = path.join(FIXTURES_DIR, `${name}.har.json.gz`);
    const metaPath = path.join(FIXTURES_DIR, `${name}.meta.json`);
    fs.writeFileSync(domPath, zlib.gzipSync(html, { level: 9 }));
    fs.writeFileSync(harPath, zlib.gzipSync(JSON.stringify({ entries }) + "\n", { level: 9 }));
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n");

    const kb = (p: string) => `${Math.round(fs.statSync(p).size / 1024)} KB`;
    console.log(`✅ DOM em ${domPath} (${kb(domPath)})`);
    console.log(`✅ ${entries.length} respostas de API em ${harPath} (${kb(harPath)})`);
    console.log(`✅ Veredito ao vivo de ${Object.keys(live).length} checks em ${metaPath}`);
    for (const [key, v] of Object.entries(live)) {
      console.log(`   ${key}: ${v.status} — ${v.message}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("Erro:", err);
  process.exit(1);
});
