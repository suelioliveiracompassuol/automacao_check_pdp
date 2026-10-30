/**
 * Testes unitários para checkers de feature que ainda não tinham cobertura.
 *
 * Usa a mesma estratégia de features.test.ts: carrega o mock HTML local
 * e substitui o body via page.evaluate() para simular diferentes estados da PDP.
 */

import { test, expect, type Page } from "@playwright/test";
import * as path from "node:path";
import { checkCoupons } from "../checks/coupons.js";
import { checkGiftModule } from "../checks/giftModule.js";
import {
  checkMinStockBadge,
  checkTopRatedBadge,
  parseProductBadgesFromApi,
  parseProductBadgesFromHtml,
  productBadgesCache,
} from "../checks/productBadges.js";
import {
  isFeatureEnabledByCommerceFlags,
  isFeatureEnabledByRemoteConfig,
  parseRemoteConfigEntries,
} from "../checks/remoteConfig.js";

const MOCK_PDP_URL = `file://${path.join(process.cwd(), "src", "tests", "mocks", "pdp.html")}`;

async function loadWithContent(page: Page, html: string): Promise<void> {
  await page.goto(MOCK_PDP_URL);
  await page.evaluate((body) => {
    document.body.innerHTML = body;
  }, html);
}

// ---------------------------------------------------------------------------
// checkCoupons + gate por flags (enable_coupons_pdp / couponCenter)
// ---------------------------------------------------------------------------

const couponsBanner = (label: string) =>
  `<button aria-label="${label}"><div><i data-icon-name="outlined-finance-tagdiscount"></i></div><span>${label}</span></button>`;

test.describe("Feature: Coupons", () => {
  test("deve passar quando o card de cupons está em tela (qualquer idioma)", async ({
    page,
  }) => {
    await loadWithContent(page, couponsBanner("ahorrá con cupones para vos"));
    const result = await checkCoupons(page);
    expect(result.passed).toBe(true);
    expect(result.status).toBe("pass");
  });

  test("deve falhar quando o card de cupons expõe a chave de tradução", async ({
    page,
  }) => {
    await loadWithContent(page, couponsBanner("product.coupons.bannerText"));
    const result = await checkCoupons(page);
    expect(result.passed).toBe(false);
  });

  test("não deve confundir com o card de cupons do menu (div, não button)", async ({
    page,
  }) => {
    await loadWithContent(
      page,
      `<header><div><div><i data-icon-name="outlined-finance-tagdiscount"></i></div><a href="/cupons">meus cupons</a></div></header>`,
    );
    const result = await checkCoupons(page);
    expect(result.passed).toBe(false);
    expect(result.status).toBe("fail");
  });

  test("enable_coupons_pdp é lido do Remote Config (boolean ou por locale)", () => {
    expect(
      parseRemoteConfigEntries({ enable_coupons_pdp: "true" }, "es-AR")
        .enable_coupons_pdp,
    ).toBe(true);
    expect(
      parseRemoteConfigEntries(
        { enable_coupons_pdp: '{"es-AR":false,"pt-BR":true}' },
        "es-AR",
      ).enable_coupons_pdp,
    ).toBe(false);
    // Sem o locale da operação não herda o valor do Brasil (fica não capturado)
    expect(
      parseRemoteConfigEntries(
        { enable_coupons_pdp: '{"pt-BR":true}' },
        "es-AR",
      ).enable_coupons_pdp,
    ).toBeUndefined();
  });

  test("gate do Remote Config: true roda, false desabilita, ausente não roda", () => {
    const base = { capturedAt: "", locale: "pt-BR" };
    expect(
      isFeatureEnabledByRemoteConfig("coupons", {
        ...base,
        enable_coupons_pdp: true,
      }).enabled,
    ).toBe(true);
    expect(
      isFeatureEnabledByRemoteConfig("coupons", {
        ...base,
        enable_coupons_pdp: false,
      }),
    ).toMatchObject({
      enabled: false,
      flagValue: false,
      flagKey: "enable_coupons_pdp",
    });
    expect(isFeatureEnabledByRemoteConfig("coupons", base)).toMatchObject({
      enabled: false,
      flagValue: undefined,
      flagKey: "enable_coupons_pdp",
      notCaptured: true,
    });
    expect(isFeatureEnabledByRemoteConfig("coupons", null).enabled).toBe(false);
    // Demais features mantêm o comportamento antigo (flag não capturada = roda)
    expect(isFeatureEnabledByRemoteConfig("shopTheSet", null).enabled).toBe(
      true,
    );
    // ...e caminho aninhado ausente continua "disabled", não N/A
    const reviewFilter = isFeatureEnabledByRemoteConfig("reviewFilter", {
      ...base,
      product_reviews: {} as never,
    });
    expect(reviewFilter.enabled).toBe(false);
    expect(reviewFilter.notCaptured).toBeUndefined();
  });

  test("gate do Commerce: só couponCenter=false desabilita", () => {
    const off = { capturedAt: "", couponCenter: false };
    expect(isFeatureEnabledByCommerceFlags("coupons", off).enabled).toBe(false);
    expect(
      isFeatureEnabledByCommerceFlags("coupons", {
        capturedAt: "",
        couponCenter: true,
      }).enabled,
    ).toBe(true);
    expect(isFeatureEnabledByCommerceFlags("coupons", null).enabled).toBe(true);
    expect(isFeatureEnabledByCommerceFlags("addToCart", off).enabled).toBe(
      true,
    );
  });
});

// ---------------------------------------------------------------------------
// checkGiftModule + gate (gift_module_pdp.enabled / enable_module_gift_cart web)
// ---------------------------------------------------------------------------

/** Acordeão como no ncf-ssr: trigger com testid + ícone, opções aparecem ao abrir. */
const giftAccordion = (options: string) => `
  <button data-testid="accordion-component" aria-expanded="false"
    onclick="const open = this.getAttribute('aria-expanded') === 'true';
             this.setAttribute('aria-expanded', String(!open));
             document.getElementById('gift-content').style.display = open ? 'none' : 'block';">
    <div><i data-icon-name="outlined-content-gift"></i></div><span>¿este pedido es para regalo?</span>
  </button>
  <div id="gift-content" style="display:none">${options}</div>`;

const giftFlags = (gift: unknown, web?: Record<string, boolean>) => ({
  capturedAt: "",
  locale: "es-AR",
  gift_module_pdp: gift as { enabled: boolean },
  ...(web && {
    enable_module_gift_cart: { enable_module_gift_web: web as never },
  }),
});

test.describe("Feature: Gift module", () => {
  test("deve passar com o módulo em tela e as opções ao abrir (qualquer idioma)", async ({
    page,
  }) => {
    await loadWithContent(
      page,
      giftAccordion(
        `<button data-testid="card-message-button">nosotros entregamos</button>
         <button data-testid="search-bag-button">vos entregás</button>`,
      ),
    );
    const result = await checkGiftModule(page);
    expect(result.status).toBe("pass");
    expect(result.details).toEqual({ cardMessage: true, searchBag: true });
    // Acordeão volta ao estado original
    await expect(page.getByTestId("accordion-component")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  test("deve falhar quando o acordeão abre sem opções de entrega", async ({
    page,
  }) => {
    await loadWithContent(page, giftAccordion(""));
    const result = await checkGiftModule(page);
    expect(result.status).toBe("fail");
  });

  test("não deve confundir com outro acordeão (sem ícone de presente)", async ({
    page,
  }) => {
    await loadWithContent(
      page,
      `<button data-testid="accordion-component" aria-expanded="false"><span>beneficios</span></button>`,
    );
    const result = await checkGiftModule(page);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("não está em tela");
  });

  test("gift_module_pdp é lido por locale", () => {
    const entries = {
      gift_module_pdp: JSON.stringify({
        "pt-BR": { enabled: true, bundle_tags: ["presente"] },
        "es-AR": { enabled: false, bundle_tags: [] },
      }),
    };
    expect(parseRemoteConfigEntries(entries, "pt-BR").gift_module_pdp).toEqual({
      enabled: true,
      bundle_tags: ["presente"],
    });
    expect(
      parseRemoteConfigEntries(entries, "es-AR").gift_module_pdp?.enabled,
    ).toBe(false);
    // Locale ausente não cai no pt-BR
    expect(
      parseRemoteConfigEntries(entries, "es-CO").gift_module_pdp,
    ).toBeUndefined();
  });

  test("gate: enabled + ao menos uma opção web", () => {
    const run = (gift: unknown, web?: Record<string, boolean>) =>
      isFeatureEnabledByRemoteConfig("giftModule", giftFlags(gift, web));

    expect(
      run({ enabled: true }, { card_message: true, search_bag: false }).enabled,
    ).toBe(true);
    expect(
      run({ enabled: true }, { card_message: false, search_bag: true }).enabled,
    ).toBe(true);
    expect(
      run({ enabled: false }, { card_message: true, search_bag: true }),
    ).toMatchObject({
      enabled: false,
      flagValue: false,
      flagKey: "gift_module_pdp.enabled",
    });
    // Sem nenhuma opção web o módulo não renderiza
    const noOptions = run(
      { enabled: true },
      { card_message: false, search_bag: false },
    );
    expect(noOptions.enabled).toBe(false);
    expect(noOptions.flagKey).toContain("enable_module_gift_web");
    // Opções web não capturadas: não dá para saber se o módulo aparece (N/A no runner)
    expect(run({ enabled: true })).toMatchObject({
      enabled: false,
      notCaptured: true,
    });
    // gift_module_pdp não capturado: não roda (vira N/A no runner)
    expect(
      isFeatureEnabledByRemoteConfig("giftModule", {
        capturedAt: "",
        locale: "pt-BR",
      }),
    ).toMatchObject({ enabled: false, flagValue: undefined, notCaptured: true });
  });

  test("sem aria-expanded e sem opções em tela vira warning", async ({
    page,
  }) => {
    await loadWithContent(
      page,
      `<button data-testid="accordion-component"><div><i data-icon-name="outlined-content-gift"></i></div><span>presente?</span></button>`,
    );
    const result = await checkGiftModule(page);
    expect(result.status).toBe("warning");
  });
});

// ---------------------------------------------------------------------------
// checkTopRatedBadge / checkMinStockBadge
// ---------------------------------------------------------------------------

const TOP_RATED_TAG = `<div role="listitem" data-testid="tag-product" aria-label="melhor avaliado"><i data-icon-name="outlined-action-rating"></i><span>melhor avaliado</span></div>`;
const MIN_STOCK_TAG = `<div role="listitem" data-testid="tag-product" aria-label="últimas unidades"><span>últimas unidades</span><img alt="últimas unidades" src="https://example.com/badgeIcons/outlined-action-runningclock.png"></div>`;
const OTHER_TAG = `<div role="listitem" data-testid="tag-product" aria-label="lançamento"><span>lançamento</span></div>`;

/** Card do produto principal (section.bg-white) com os selos e o código exibido. */
const mainProduct = (tags: string, code = "NATBRA-1") =>
  `<section class="bg-white"><div role="list">${tags}</div><p>cod. ${code}</p></section>`;
/** Card de vitrine, que reutiliza data-testid="tag-product". */
const showcaseCard = (tags: string) =>
  `<section class="bg-background"><article id="product-card-NATBRA-9"><div role="list">${tags}</div></article></section>`;

const MIN_STOCK_ALERT = {
  type: "minStockAlert",
  text: "últimas unidades",
  color: "#68408A",
  background: "#F3EEFA",
};

/** Dados capturados de um produto sem variações (NATBRA-1). */
const badgeData = (
  isTopRated: boolean,
  minStock?: typeof MIN_STOCK_ALERT,
  source: "api" | "ssr" = "api",
) => ({
  sku: "NATBRA-1",
  isTopRated,
  minStockByProductId: { "NATBRA-1": minStock },
  source,
});

test.describe("Product badges: parse do payload", () => {
  // Payload RSC como vem no HTML: JSON com aspas escapadas
  const html = (json: string) =>
    `<script>self.__next_f.push([1,"${json.replace(/"/g, '\\"')}"])</script>`;
  const badge = JSON.stringify(MIN_STOCK_ALERT);

  test("lê isTopRated e minStockBadge do produto principal", () => {
    const data = parseProductBadgesFromHtml(
      html(`{"productId":"NATBRA-1","isTopRated":true,"minStockBadge":${badge}}`),
      "NATBRA-1",
    );
    expect(data?.isTopRated).toBe(true);
    expect(data?.minStockByProductId["NATBRA-1"]?.type).toBe("minStockAlert");
    expect(data?.minStockByProductId["NATBRA-1"]?.text).toBe("últimas unidades");
  });

  test("campos omitidos pela BFF valem como ausentes", () => {
    const data = parseProductBadgesFromHtml(
      html(`{"productId":"NATBRA-1","name":"x"}`),
      "NATBRA-1",
    );
    expect(data).toEqual({
      isTopRated: false,
      minStockByProductId: { "NATBRA-1": undefined },
    });
  });

  test("separa os selos de cada variação e de produtos aninhados", () => {
    const data = parseProductBadgesFromHtml(
      html(
        `{"productId":"NATARG-00068","variations":[{"productId":"NATARG-110181","minStockBadge":${badge}},{"productId":"NATARG-110200"}],"productComponents":[{"productId":"NATARG-2","isTopRated":true}]}`,
      ),
      "NATARG-00068",
    );
    expect(data?.isTopRated).toBe(false);
    expect(data?.minStockByProductId["NATARG-00068"]).toBeUndefined();
    expect(data?.minStockByProductId["NATARG-110181"]?.type).toBe("minStockAlert");
    expect(data?.minStockByProductId["NATARG-110200"]).toBeUndefined();
  });

  test("lê as variações da API JSON", () => {
    const data = parseProductBadgesFromApi({
      productId: "NATARG-00068",
      isTopRated: true,
      variations: [
        { productId: "NATARG-110181", minStockBadge: MIN_STOCK_ALERT },
        { productId: "NATARG-110200" },
      ],
    });
    expect(data.isTopRated).toBe(true);
    expect(data.minStockByProductId).toEqual({
      "NATARG-00068": undefined,
      "NATARG-110181": MIN_STOCK_ALERT,
      "NATARG-110200": undefined,
    });
  });

  test("retorna undefined quando o produto não está no HTML", () => {
    expect(
      parseProductBadgesFromHtml(html(`{"productId":"NATBRA-1"}`), "NATBRA-2"),
    ).toBeUndefined();
  });
});

test.describe("Feature: Top rated badge", () => {
  test("deve passar quando isTopRated é true e o selo está visível", async ({
    page,
  }) => {
    await loadWithContent(page, mainProduct(TOP_RATED_TAG));
    productBadgesCache.set(page, badgeData(true));
    const result = await checkTopRatedBadge(page);
    expect(result.passed).toBe(true);
    expect(result.status).toBe("pass");
  });

  test("deve falhar quando isTopRated é true e o selo não aparece", async ({
    page,
  }) => {
    await loadWithContent(page, mainProduct(OTHER_TAG));
    productBadgesCache.set(page, badgeData(true));
    const result = await checkTopRatedBadge(page);
    expect(result.passed).toBe(false);
    expect(result.status).toBe("fail");
  });

  test("deve falhar quando isTopRated é false e o selo aparece", async ({
    page,
  }) => {
    await loadWithContent(page, mainProduct(TOP_RATED_TAG));
    productBadgesCache.set(page, badgeData(false));
    const result = await checkTopRatedBadge(page);
    expect(result.passed).toBe(false);
    expect(result.status).toBe("fail");
  });

  test("deve passar quando isTopRated é false e o selo não aparece", async ({
    page,
  }) => {
    await loadWithContent(page, mainProduct(OTHER_TAG));
    productBadgesCache.set(page, badgeData(false));
    const result = await checkTopRatedBadge(page);
    expect(result.passed).toBe(true);
    expect(result.status).toBe("pass");
  });

  test("ignora o selo em cards de vitrine", async ({ page }) => {
    await loadWithContent(
      page,
      mainProduct(OTHER_TAG) + showcaseCard(TOP_RATED_TAG),
    );
    productBadgesCache.set(page, badgeData(false, undefined, "ssr"));
    const result = await checkTopRatedBadge(page);
    expect(result.status).toBe("pass");
  });

  test("deve ser N/A quando os dados do produto não foram capturados e não há selo", async ({
    page,
  }) => {
    await loadWithContent(page, mainProduct(OTHER_TAG));
    const result = await checkTopRatedBadge(page);
    expect(result.status).toBe("na");
  });

  test("deve ser warning quando o selo aparece sem dados do produto", async ({
    page,
  }) => {
    await loadWithContent(page, mainProduct(TOP_RATED_TAG));
    const result = await checkTopRatedBadge(page);
    expect(result.status).toBe("warning");
  });
});

test.describe("Feature: Min stock badge", () => {
  test("deve passar quando a API retorna minStockAlert e o selo está visível", async ({
    page,
  }) => {
    await loadWithContent(page, mainProduct(TOP_RATED_TAG + MIN_STOCK_TAG));
    productBadgesCache.set(page, badgeData(true, MIN_STOCK_ALERT, "ssr"));
    const result = await checkMinStockBadge(page);
    expect(result.passed).toBe(true);
    expect(result.status).toBe("pass");
  });

  test("encontra o selo pelo texto da API quando o ícone muda", async ({
    page,
  }) => {
    await loadWithContent(
      page,
      mainProduct(
        `<div role="listitem" data-testid="tag-product" aria-label="últimas unidades"><span>últimas unidades</span></div>`,
      ),
    );
    productBadgesCache.set(page, badgeData(false, MIN_STOCK_ALERT));
    const result = await checkMinStockBadge(page);
    expect(result.status).toBe("pass");
  });

  test("deve falhar quando a API retorna minStockAlert e o selo não aparece", async ({
    page,
  }) => {
    await loadWithContent(page, mainProduct(OTHER_TAG));
    productBadgesCache.set(page, badgeData(false, MIN_STOCK_ALERT));
    const result = await checkMinStockBadge(page);
    expect(result.passed).toBe(false);
    expect(result.status).toBe("fail");
  });

  test("deve falhar quando a API não retorna minStockBadge e o selo aparece", async ({
    page,
  }) => {
    await loadWithContent(page, mainProduct(MIN_STOCK_TAG));
    productBadgesCache.set(page, badgeData(false, undefined, "ssr"));
    const result = await checkMinStockBadge(page);
    expect(result.passed).toBe(false);
    expect(result.status).toBe("fail");
  });

  test("deve passar quando não há minStockBadge, ignorando o selo em vitrines", async ({
    page,
  }) => {
    await loadWithContent(
      page,
      mainProduct(OTHER_TAG) + showcaseCard(MIN_STOCK_TAG),
    );
    productBadgesCache.set(page, badgeData(false, undefined, "ssr"));
    const result = await checkMinStockBadge(page);
    expect(result.passed).toBe(true);
    expect(result.status).toBe("pass");
  });

  test.describe("produto com variações", () => {
    const withVariations = {
      sku: "NATARG-00068",
      isTopRated: false,
      minStockByProductId: {
        "NATARG-00068": undefined,
        "NATARG-110181": MIN_STOCK_ALERT,
        "NATARG-110200": undefined,
      },
      source: "ssr" as const,
    };

    test("usa o minStockBadge da variação exibida", async ({ page }) => {
      await loadWithContent(page, mainProduct(MIN_STOCK_TAG, "NATARG-110181"));
      productBadgesCache.set(page, withVariations);
      const result = await checkMinStockBadge(page);
      expect(result.status).toBe("pass");
      expect(result.details?.displayedProductId).toBe("NATARG-110181");
    });

    test("falha se a variação exibida tem o selo na API e ele não aparece", async ({
      page,
    }) => {
      await loadWithContent(page, mainProduct(OTHER_TAG, "NATARG-110181"));
      productBadgesCache.set(page, withVariations);
      const result = await checkMinStockBadge(page);
      expect(result.status).toBe("fail");
    });

    test("falha se a variação exibida não tem o selo na API e ele aparece", async ({
      page,
    }) => {
      await loadWithContent(page, mainProduct(MIN_STOCK_TAG, "NATARG-110200"));
      productBadgesCache.set(page, withVariations);
      const result = await checkMinStockBadge(page);
      expect(result.status).toBe("fail");
      expect(result.details?.displayedProductId).toBe("NATARG-110200");
    });
  });
});
