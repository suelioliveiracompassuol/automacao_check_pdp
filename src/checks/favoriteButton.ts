import { Page } from "@playwright/test";
import { CheckResult } from "../types.js";
import { SELECTORS, TIMING } from "./configs/config.js";

export async function checkFavoriteButton(page: Page): Promise<CheckResult> {
  try {
    const button = page.locator(SELECTORS.favoriteButton.button);
    const isVisible = await button
      .isVisible({ timeout: TIMING.elementTimeout })
      .catch(() => false);

    if (isVisible) {
      return {
        feature: "Botão de Favoritos",
        featureKey: "favoriteButton",
        passed: true,
        status: "pass",
        message: "Botão de favoritos encontrado na tela",
      };
    }

    return {
      feature: "Botão de Favoritos",
      featureKey: "favoriteButton",
      passed: false,
      status: "fail",
      message: "Botão de favoritos não encontrado na tela",
    };
  } catch (error) {
    return {
      feature: "Botão de Favoritos",
      featureKey: "favoriteButton",
      passed: false,
      status: "error",
      message: `Erro ao verificar botão de favoritos: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
