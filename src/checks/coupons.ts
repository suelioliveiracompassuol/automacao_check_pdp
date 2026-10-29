import { Page } from "@playwright/test";
import { CheckResult } from "../types.js";
import { SELECTORS, TIMING } from "./configs/config.js";

const FEATURE = "Card de cupons";

/**
 * Card "economize com cupons" da PDP. Só é verificado quando o Remote Config
 * (enable_coupons_pdp) e o Commerce (couponCenter) o habilitam — o gate fica no
 * runner; aqui o card tem que estar em tela.
 */
export async function checkCoupons(page: Page): Promise<CheckResult> {
  try {
    const banner = page.locator(SELECTORS.coupons.banner).first();
    // Componente carregado só no client (dynamic, ssr: false) e só depois do fetch do
    // Remote Config no browser — pode levar bem mais que o elementTimeout padrão
    const isVisible = await banner
      .waitFor({ state: "visible", timeout: TIMING.couponsTimeout })
      .then(() => true)
      .catch(() => false);

    if (!isVisible) {
      return {
        feature: FEATURE,
        featureKey: "coupons",
        passed: false,
        status: "fail",
        message:
          "Flag enable_coupons_pdp ativa, mas o card de cupons não está em tela",
      };
    }

    const label = (await banner.getAttribute("aria-label")) ?? "";
    if (label.startsWith("product.coupons.")) {
      return {
        feature: FEATURE,
        featureKey: "coupons",
        passed: false,
        status: "fail",
        message: `Card de cupons em tela com chave de tradução exposta (${label})`,
      };
    }

    return {
      feature: FEATURE,
      featureKey: "coupons",
      passed: true,
      status: "pass",
      message: `Card de cupons exibido (flag enable_coupons_pdp ativa)${label ? `: "${label}"` : ""}`,
    };
  } catch (error) {
    return {
      feature: FEATURE,
      featureKey: "coupons",
      passed: false,
      status: "error",
      message: `Erro ao verificar card de cupons: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
