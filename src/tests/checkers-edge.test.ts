/**
 * Branches of the Web checkers that a healthy real page doesn't exercise: endpoint errors,
 * products without reviews, exposed translation keys, a variation selector that only the DOM
 * knows about. The healthy paths are covered against real captures in web-fixtures.test.ts;
 * here each branch gets a minimal page that triggers it.
 */
import { test, expect, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";
import { setupEndpointMonitor, type EndpointRule } from "../checks/endpointResponse.js";
import { sleepMs } from "../utils.js";
import { checkI18nKeys } from "../checks/i18n.js";
import {
  checkProductVariations,
  countSsrVariations,
  setupProductVariationsCapture,
} from "../checks/productVariations.js";
import {
  checkReviewFilter,
  checkReviewPhotos,
  checkReviewRecommendation,
  checkReviewSort,
} from "../checks/reviewFeatures.js";

const ORIGIN = "https://pdp.test";

interface FakeResponse {
  status?: number;
  contentType?: string;
  body?: string;
}

/** Serves `html` at ORIGIN and the given API responses (by path); anything else is aborted. */
async function servePage(page: Page, html: string, api: Record<string, FakeResponse> = {}): Promise<void> {
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin === ORIGIN && url.pathname === "/") {
      return route.fulfill({ status: 200, contentType: "text/html", body: html });
    }
    const r = api[url.pathname + url.search] ?? api[url.pathname];
    if (url.origin === ORIGIN && r) {
      return route.fulfill({
        status: r.status ?? 200,
        contentType: r.contentType ?? "application/json",
        body: r.body ?? "",
      });
    }
    return route.abort();
  });
  await page.goto(`${ORIGIN}/`);
}

async function call(page: Page, url: string, method = "GET"): Promise<void> {
  await page.evaluate(
    ([u, m]) => fetch(u, { method: m }).then((r) => r.text()).catch(() => ""),
    [url, method],
  );
  await sleepMs(200);
}

// ---------------------------------------------------------------------------
// Endpoint monitor
// ---------------------------------------------------------------------------

test.describe("Endpoint monitor: regras", () => {
  const html = "<html><body>pdp</body></html>";

  async function evaluate(page: Page, rule: Omit<EndpointRule, "key" | "name">, api: Record<string, FakeResponse>, calls: [string, string?][]) {
    const collect = setupEndpointMonitor(page, [{ key: "x", name: "API X", ...rule }]);
    await servePage(page, html, api);
    for (const [p, method] of calls) {
      await call(page, `${ORIGIN}${p}`, method);
    }
    const [result] = await collect();
    return result;
  }

  test("sem chamada: falha dizendo o que procurou", async ({ page }) => {
    const r = await evaluate(page, { match: "/api/x" }, {}, []);
    expect(r.featureKey).toBe("endpoint_x");
    expect(r.status).toBe("fail");
    expect(r.message).toContain('"/api/x"');
  });

  test("status >= 400 falha e lista as chamadas com erro", async ({ page }) => {
    const r = await evaluate(
      page,
      { match: "/api/x" },
      { "/api/x?a=1": { body: "{}" }, "/api/x?a=2": { status: 500, body: "{}" } },
      [["/api/x?a=1"], ["/api/x?a=2"]],
    );
    expect(r.status).toBe("fail");
    expect(r.message).toContain("1/2");
    expect(r.details?.failedCalls).toEqual([{ method: "GET", status: 500, url: `${ORIGIN}/api/x?a=2` }]);
  });

  test("expectedStatuses: um 2xx fora da lista também falha", async ({ page }) => {
    const r = await evaluate(page, { match: "/api/x", expectedStatuses: [200] }, { "/api/x": { status: 201, body: "{}" } }, [["/api/x"]]);
    expect(r.status).toBe("fail");
    expect(r.message).toContain("201");
  });

  test("methods: chamadas de outro método não contam", async ({ page }) => {
    const r = await evaluate(page, { match: "/api/x", methods: ["GET"] }, { "/api/x": { body: "{}" } }, [["/api/x", "POST"]]);
    expect(r.message).toContain("Nenhuma chamada");
  });

  test("requiredFields: campo ausente falha com o caminho do endpoint", async ({ page }) => {
    const r = await evaluate(
      page,
      { match: "/api/x", requiredFields: ["data.productId"] },
      { "/api/x": { body: JSON.stringify({ data: {} }) } },
      [["/api/x"]],
    );
    expect(r.status).toBe("fail");
    expect(r.message).toContain('Campo obrigatório ausente: "data.productId" em /api/x');
  });

  test("nonEmptyFields: string vazia e lista vazia falham", async ({ page }) => {
    const r = await evaluate(
      page,
      { match: "/api/x", nonEmptyFields: ["productId", "variations"] },
      { "/api/x": { body: JSON.stringify({ productId: "", variations: [] }) } },
      [["/api/x"]],
    );
    expect(r.status).toBe("fail");
    expect(r.details?.bodyErrors).toEqual([
      'Campo vazio ou ausente: "productId" em /api/x',
      'Campo vazio ou ausente: "variations" em /api/x',
    ]);
  });

  test("validação de body sem JSON capturado falha (não passa em branco)", async ({ page }) => {
    const r = await evaluate(
      page,
      { match: "/api/x", nonEmptyFields: ["productId"] },
      { "/api/x": { contentType: "text/html", body: "<html></html>" } },
      [["/api/x"]],
    );
    expect(r.status).toBe("fail");
    expect(r.message).toContain("nenhum body JSON");
  });

  test("tudo certo: passa com os status vistos e uma amostra do body", async ({ page }) => {
    const r = await evaluate(
      page,
      { match: "/api/x", nonEmptyFields: ["productId"] },
      { "/api/x": { body: JSON.stringify({ productId: "NATBRA-1" }) } },
      [["/api/x"], ["/api/x"]],
    );
    expect(r.status).toBe("pass");
    expect(r.message).toBe("2 chamada(s) ok (status 200)");
    expect(String(r.details?.bodyPreview)).toContain("NATBRA-1");
  });
});

// ---------------------------------------------------------------------------
// i18n keys
// ---------------------------------------------------------------------------

test.describe("Feature: chaves de tradução (i18n)", () => {
  const page$ = (body: string) => `<html><body>${body}</body></html>`;

  test("detecta chave exposta no texto, com o contexto", async ({ page }) => {
    await servePage(page, page$("<p>product.reviews.recommendation</p>"));
    const r = await checkI18nKeys(page);
    expect(r.status).toBe("fail");
    expect(r.details?.keys).toEqual([{ key: "product.reviews.recommendation", context: "product.reviews.recommendation" }]);
  });

  test("detecta chave exposta em atributo visível", async ({ page }) => {
    await servePage(page, page$('<button aria-label="pdp.shipping.title">x</button>'));
    const r = await checkI18nKeys(page);
    expect(r.status).toBe("fail");
    expect(r.message).toContain("pdp.shipping.title");
  });

  test("ignora elementos ocultos e scripts", async ({ page }) => {
    await servePage(
      page,
      page$('<p style="display:none">product.hidden.key</p><p style="visibility:hidden">pdp.hidden.key</p><script>var a="pdp.script.key"</script>'),
    );
    expect((await checkI18nKeys(page)).status).toBe("pass");
  });

  test("não confunde domínios, arquivos e tokens de CSS com chaves", async ({ page }) => {
    await servePage(
      page,
      page$("<p>visite www.natura.com.br hoje</p><p>loja.natura.com.ar</p><p>foto.produto.png</p><p>font.size.large</p>"),
    );
    expect((await checkI18nKeys(page)).status).toBe("pass");
  });

  test("resume quando há mais de 5 chaves", async ({ page }) => {
    const keys = Array.from({ length: 7 }, (_, i) => `<p>product.key.k${i}</p>`).join("");
    await servePage(page, page$(keys));
    const r = await checkI18nKeys(page);
    expect(r.message).toContain("7 chave(s)");
    expect(r.message).toContain("(+2 mais)");
  });
});

// ---------------------------------------------------------------------------
// Reviews: filter / sort / photos / recommendation
// ---------------------------------------------------------------------------

/** Real markup (natura-br capture): go-to-reviews button + #reviews summary. */
function reviewsPage({ count, inner = "" }: { count: number | null; inner?: string }): string {
  const button =
    count === null
      ? ""
      : `<button data-testid="go-to-reviews-button">${count > 0 ? `(${count}) avaliações` : "avalie o produto"}</button>`;
  return `<html><body>${button}<section id="reviews"><div class="flex flex-col gap-1"><p>${count ?? 0} avaliações</p></div>${inner}</section></body></html>`;
}

const FILTER = '<button data-testid="reviews-filter"><i data-icon-name="outlined-action-filter"></i>filtrar</button>';

test.describe("Avaliações: produto sem avaliações e ramos de falha", () => {
  test("filtro, ordenação e fotos viram warning em produto sem avaliações", async ({ page }) => {
    await servePage(page, reviewsPage({ count: 0 }));
    for (const check of [checkReviewFilter, checkReviewSort, checkReviewPhotos]) {
      const r = await check(page);
      expect(r.status, r.featureKey).toBe("warning");
      expect(r.message).toContain("sem avaliações");
    }
  });

  test("fotos: filtro de mídia sem fotos na primeira página é warning", async ({ page }) => {
    await servePage(page, reviewsPage({ count: 12, inner: FILTER }));
    const r = await checkReviewPhotos(page);
    expect(r.status).toBe("warning");
    expect(r.details).toEqual({ photoCount: 0, filterPresent: true });
  });

  test("fotos: miniaturas das avaliações contam como fotos", async ({ page }) => {
    const thumbs = '<img class="h-32 w-32" src="data:,"><img class="rounded-micro" src="data:,">';
    await servePage(page, reviewsPage({ count: 12, inner: FILTER + thumbs }));
    const r = await checkReviewPhotos(page);
    expect(r.status).toBe("pass");
    expect(r.details?.photoCount).toBe(2);
  });

  test("container #reviews ausente com avaliações no botão é falha (não carregou a tempo)", async ({ page }) => {
    test.setTimeout(60_000);
    await servePage(page, '<html><body><button data-testid="go-to-reviews-button">(8) avaliações</button></body></html>');
    const r = await checkReviewFilter(page);
    expect(r.status).toBe("fail");
    expect(r.message).toContain("8 avaliação(ões)");
  });

  test("recomendação: chip lido pelo aria-label quando não há .bg-success", async ({ page }) => {
    test.setTimeout(60_000);
    await servePage(page, reviewsPage({ count: 30, inner: '<div aria-label="92% recomendam este produto">92%</div>' }));
    const r = await checkReviewRecommendation(page);
    expect(r.status).toBe("pass");
    expect(r.details?.percentage).toBe(92);
  });

  test("recomendação: sem chip com até 4 avaliações é warning (mínimo do Remote Config)", async ({ page }) => {
    test.setTimeout(60_000);
    await servePage(page, reviewsPage({ count: 3 }));
    const r = await checkReviewRecommendation(page);
    expect(r.status).toBe("warning");
    expect(r.details).toEqual({ reviewCount: 3, minRequired: 4 });
  });
});

// ---------------------------------------------------------------------------
// Product variations
// ---------------------------------------------------------------------------

test.describe("Variações: fonte da contagem", () => {
  const swatch = '<button data-testid="color-option">cor</button>';

  test("SSR (RSC) de uma captura real: conta as variações do SKU", () => {
    const dir = path.join(process.cwd(), "src", "tests", "fixtures", "web");
    const html = zlib.gunzipSync(fs.readFileSync(path.join(dir, "natura-br_natbra-110181.dom.html.gz"))).toString();
    expect(countSsrVariations(html, "NATBRA-110181")).toBe(23);
    expect(countSsrVariations(html, "NATBRA-NAO-EXISTE")).toBeUndefined();
  });

  test("__NEXT_DATA__ (Pages Router) ainda é lido", () => {
    const nextData = { props: { pageProps: { product: { productId: "X", variations: [{}, {}, {}] } } } };
    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script>`;
    expect(countSsrVariations(html)).toBe(3);
  });

  test("API do produto chamada no browser vence e é a fonte do relatório", async ({ page }) => {
    setupProductVariationsCapture(page, "NATBRA-1");
    await servePage(page, `<html><body>${swatch}${swatch}</body></html>`, {
      "/pages/v2/product/NATBRA-1": { body: JSON.stringify({ productId: "NATBRA-1", variations: [{}, {}] }) },
    });
    await call(page, `${ORIGIN}/pages/v2/product/NATBRA-1`);
    const r = await checkProductVariations(page);
    expect(r.status).toBe("pass");
    expect(r.details).toMatchObject({ variationsCount: 2, source: "api", apiUrl: `${ORIGIN}/pages/v2/product/NATBRA-1` });
  });

  test("sem dado de rede, conta pelo DOM (2 = passa, 1 = N/A)", async ({ page }) => {
    await servePage(page, `<html><body>${swatch}${swatch}</body></html>`);
    expect(await checkProductVariations(page)).toMatchObject({ status: "pass", details: { source: "dom", variationsCount: 2 } });
    await page.evaluate((s) => (document.body.innerHTML = s), swatch);
    expect((await checkProductVariations(page)).status).toBe("na");
  });
});
