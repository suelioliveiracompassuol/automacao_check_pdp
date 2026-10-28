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
    });
    expect(isFeatureEnabledByRemoteConfig("coupons", null).enabled).toBe(false);
    // Demais features mantêm o comportamento antigo (flag não capturada = roda)
    expect(isFeatureEnabledByRemoteConfig("shopTheSet", null).enabled).toBe(
      true,
    );
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
