/**
 * Testes unitários para checkers de feature que ainda não tinham cobertura.
 *
 * Usa a mesma estratégia de features.test.ts: carrega o mock HTML local
 * e substitui o body via page.evaluate() para simular diferentes estados da PDP.
 */

import { test, expect, type Page } from "@playwright/test";
import * as path from "node:path";
import { checkPricing } from "../checks/pricing.js";
import { checkShipping } from "../checks/shipping.js";
import { checkCoupons } from "../checks/coupons.js";
import { checkGiftModule } from "../checks/giftModule.js";
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
// checkPricing
// ---------------------------------------------------------------------------

test.describe("Feature: Pricing", () => {
  test("deve passar quando seção de preço com R$ está presente", async ({
    page,
  }) => {
    await loadWithContent(
      page,
      `<div data-testid="product-pricing"><span>R$ 59,90</span></div>`,
    );
    const result = await checkPricing(page);
    expect(result.passed).toBe(true);
    expect(result.status).toBe("pass");
  });

  test("deve passar com padrão de preço $ (LATAM)", async ({ page }) => {
    await loadWithContent(
      page,
      `<div data-testid="sku-split-price"><span>$ 1.299,00</span></div>`,
    );
    const result = await checkPricing(page);
    expect(result.passed).toBe(true);
  });

  test("deve passar com padrão de preço S/ (Peru)", async ({ page }) => {
    await loadWithContent(
      page,
      `<div data-testid="product-pricing"><span>S/ 45,90</span></div>`,
    );
    const result = await checkPricing(page);
    expect(result.passed).toBe(true);
  });

  test("deve falhar quando nenhuma seção de preço ou valor reconhecível é encontrado", async ({
    page,
  }) => {
    await loadWithContent(
      page,
      `<div class="page"><p>Produto sem preço definido</p></div>`,
    );
    const result = await checkPricing(page);
    expect(result.passed).toBe(false);
  });

  test("não deve capturar preço de frete como preço do produto", async ({
    page,
  }) => {
    await loadWithContent(
      page,
      `<div data-testid="product-pricing"><span>Frete grátis a partir de R$ 100,00</span></div>`,
    );
    const result = await checkPricing(page);
    // Linha com "frete" deve ser ignorada; sem preço válido → falha
    expect(result.passed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// checkShipping
// ---------------------------------------------------------------------------

test.describe("Feature: Shipping", () => {
  test("deve passar quando o elemento shipping-indicator está visível", async ({
    page,
  }) => {
    await loadWithContent(
      page,
      `<div data-testid="shipping-indicator" style="display:block">
         <input data-testid="postalCode" placeholder="CEP" />
       </div>`,
    );
    const result = await checkShipping(page);
    expect(result.passed).toBe(true);
    expect(result.status).toBe("pass");
  });

  test("deve passar quando o input de CEP (postalCode) está visível", async ({
    page,
  }) => {
    await loadWithContent(
      page,
      `<div class="shipping-area">
         <input data-testid="postalCode" placeholder="Digite seu CEP" style="display:block" />
       </div>`,
    );
    const result = await checkShipping(page);
    expect(result.passed).toBe(true);
  });

  test("deve falhar quando não há seção de frete nem input de CEP", async ({
    page,
  }) => {
    await loadWithContent(
      page,
      `<div class="page"><p>Produto sem frete</p></div>`,
    );
    const result = await checkShipping(page);
    expect(result.passed).toBe(false);
  });
});

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
