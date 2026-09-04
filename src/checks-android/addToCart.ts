import { CheckResult } from "../types.js";
import { ANDROID_SELECTORS } from "./configs/selectors.js";

/** Android equivalent of checks/addToCart.ts, using an Appium/WebdriverIO session instead of a Playwright Page. */
export async function checkAddToCartAndroid(
  driver: WebdriverIO.Browser,
): Promise<CheckResult> {
  try {
    const button = driver.$(`android=${ANDROID_SELECTORS.addToCart.anyButton}`);
    const isDisplayed = await button.isDisplayed().catch(() => false);

    if (isDisplayed) {
      return {
        feature: "Botão Adicionar à Sacola",
        featureKey: "addToCart",
        passed: true,
        status: "pass",
        message:
          "Botão de ação do carrinho (Comprar, Avise-me) encontrado na tela",
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
