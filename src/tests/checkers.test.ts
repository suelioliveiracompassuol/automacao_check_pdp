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
  test("deve passar quando seção de preço com R$ está presente", async ({ page }) => {
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
    await loadWithContent(page, `<div class="page"><p>Produto sem preço definido</p></div>`);
    const result = await checkPricing(page);
    expect(result.passed).toBe(false);
  });

  test("não deve capturar preço de frete como preço do produto", async ({ page }) => {
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
  test("deve passar quando o elemento shipping-indicator está visível", async ({ page }) => {
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

  test("deve passar quando o input de CEP (postalCode) está visível", async ({ page }) => {
    await loadWithContent(
      page,
      `<div class="shipping-area">
         <input data-testid="postalCode" placeholder="Digite seu CEP" style="display:block" />
       </div>`,
    );
    const result = await checkShipping(page);
    expect(result.passed).toBe(true);
  });

  test("deve falhar quando não há seção de frete nem input de CEP", async ({ page }) => {
    await loadWithContent(page, `<div class="page"><p>Produto sem frete</p></div>`);
    const result = await checkShipping(page);
    expect(result.passed).toBe(false);
  });
});
