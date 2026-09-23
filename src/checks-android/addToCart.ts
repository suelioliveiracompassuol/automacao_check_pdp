import { CheckResult } from "../types.js";
import { ANDROID_SELECTORS } from "./configs/selectors.js";

export interface AddToCartCheckResult extends CheckResult {
  loadTime?: number;
}

/** Android equivalent of checks/addToCart.ts, using an Appium/WebdriverIO session instead of a Playwright Page. */
export async function checkAddToCartAndroid(
  driver: WebdriverIO.Browser,
  navStartTime?: number,
): Promise<AddToCartCheckResult> {
  try {
    let targetButton = driver.$(`android=${ANDROID_SELECTORS.addToCart.anyButton}`);
    // PDP renders shimmer/skeleton placeholders first — wait dynamically for element to be displayed.
    let isDisplayed = await targetButton
      .waitForDisplayed({ timeout: 15000 })
      .catch(() => false);

    if (!isDisplayed) {
      // Fallback for brands/countries where cv_buy_button isn't the primary resource-id
      targetButton = driver.$(
        `android=${ANDROID_SELECTORS.addToCart.textFallback}`,
      );
      isDisplayed = await targetButton
        .waitForDisplayed({ timeout: 5000 })
        .catch(() => false);
    }

    const loadTime =
      isDisplayed && navStartTime ? Date.now() - navStartTime : undefined;

    if (isDisplayed) {
      const isEnabled = await targetButton.isEnabled().catch(() => true);
      const text = (await targetButton.getText().catch(() => "")) || undefined;

      return {
        feature: "Botão Adicionar à Sacola",
        featureKey: "addToCart",
        passed: true,
        status: "pass",
        message: `Botão de ação do carrinho encontrado na tela (${text ? `texto: "${text}"` : isEnabled ? "habilitado" : "desabilitado"})`,
        loadTime,
        details: {
          isDisplayed: true,
          isEnabled,
          text,
          loadTime,
        },
      };
    }

    return {
      feature: "Botão Adicionar à Sacola",
      featureKey: "addToCart",
      passed: false,
      status: "fail",
      message: "Nenhum botão de ação do carrinho encontrado na tela",
      loadTime,
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
