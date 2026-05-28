import { Page } from "@playwright/test";
import { CheckResult } from "../types.js";
import { SELECTORS, TIMING } from "./configs/config.js";

export async function checkAddToCart(page: Page): Promise<CheckResult> {
  try {
    // Check if ANY cart action button is visible (Buy, Warn Me, or Quantity Counter)
    const anyButton = page.locator(SELECTORS.addToCart.anyButton).first();
    const isVisible = await anyButton
      .isVisible({ timeout: TIMING.elementTimeout })
      .catch(() => false);

    if (isVisible) {
      return {
        feature: "Botão Adicionar à Sacola",
        featureKey: "addToCart",
        passed: true,
        status: "pass",
        message: "Botão de ação do carrinho (Comprar, Avise-me) encontrado na tela",
      };
    }

    return {
      feature: "Botão Adicionar à Sacola",
      featureKey: "addToCart",
      passed: false,
      status: "fail",
      message: "Nenhum botão de ação do carrinho encontrado na tela",
    };
  } catch (error) {
    return {
      feature: "Botão Adicionar à Sacola",
      featureKey: "addToCart",
      passed: false,
      status: "error",
      message: `Erro ao verificar botão: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
