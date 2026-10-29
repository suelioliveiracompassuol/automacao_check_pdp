import { Page } from "@playwright/test";
import { CheckResult } from "../types.js";
import { SELECTORS, TIMING } from "./configs/config.js";

const FEATURE = "Módulo de presente";

/** Wait for the gift options after expanding the accordion (ms). */
const OPTIONS_TIMEOUT = 5000;

/** Delivery options visible on the page (labels for the report). */
async function visibleOptions(page: Page, timeout: number): Promise<string[]> {
  const cardMessage = page
    .locator(SELECTORS.giftModule.cardMessageOption)
    .first();
  const searchBag = page.locator(SELECTORS.giftModule.searchBagOption).first();
  // timeout 0 means "no limit" to Playwright, so 0 here skips the wait instead
  if (timeout > 0) {
    await cardMessage
      .or(searchBag)
      .first()
      .waitFor({ state: "visible", timeout })
      .catch(() => {});
  }

  return [
    (await cardMessage.isVisible()) && '"a gente entrega"',
    (await searchBag.isVisible()) && '"você entrega"',
  ].filter((o): o is string => Boolean(o));
}

/**
 * Módulo "esse pedido é para presente?" da PDP. Só é verificado quando o Remote Config o habilita
 * (gift_module_pdp.enabled + uma opção web em enable_module_gift_cart) — o gate fica no runner;
 * aqui o módulo tem que estar em tela e, aberto, mostrar ao menos uma opção de entrega.
 */
export async function checkGiftModule(page: Page): Promise<CheckResult> {
  try {
    const trigger = page.locator(SELECTORS.giftModule.trigger).first();
    // Componente carregado só no client (dynamic, ssr: false) e só depois do fetch do
    // Remote Config no browser — pode levar bem mais que o elementTimeout padrão
    const isVisible = await trigger
      .waitFor({ state: "visible", timeout: TIMING.giftModuleTimeout })
      .then(() => true)
      .catch(() => false);

    if (!isVisible) {
      return {
        feature: FEATURE,
        featureKey: "giftModule",
        passed: false,
        status: "fail",
        message:
          "Flag gift_module_pdp.enabled ativa, mas o módulo de presente não está em tela",
      };
    }

    // Desktop: acordeão (aria-expanded). Mobile abre um bottom sheet — não é aberto aqui.
    const expanded = await trigger.getAttribute("aria-expanded");
    if (expanded === null) {
      // Sem estado de acordeão: só dá para conferir opções que já estejam em tela
      const shown = await visibleOptions(page, 0);
      if (shown.length > 0) {
        return {
          feature: FEATURE,
          featureKey: "giftModule",
          passed: true,
          status: "pass",
          message: `Módulo de presente exibido com ${shown.length} opção(ões): ${shown.join(", ")}`,
        };
      }
      return {
        feature: FEATURE,
        featureKey: "giftModule",
        passed: true,
        status: "warning",
        message:
          "Módulo de presente em tela, mas sem aria-expanded — opções de entrega não verificadas",
      };
    }

    if (expanded === "false") {
      await trigger.click();
    }

    const options = await visibleOptions(page, OPTIONS_TIMEOUT);

    // Restore the accordion so the page (and the failure screenshot) stays as loaded
    if (expanded === "false") {
      await trigger.click().catch(() => {});
    }

    if (options.length === 0) {
      return {
        feature: FEATURE,
        featureKey: "giftModule",
        passed: false,
        status: "fail",
        message:
          "Módulo de presente em tela, mas sem opções de entrega ao abrir",
      };
    }

    return {
      feature: FEATURE,
      featureKey: "giftModule",
      passed: true,
      status: "pass",
      message: `Módulo de presente exibido com ${options.length} opção(ões): ${options.join(", ")}`,
      details: {
        cardMessage: options.includes('"a gente entrega"'),
        searchBag: options.includes('"você entrega"'),
      },
    };
  } catch (error) {
    return {
      feature: FEATURE,
      featureKey: "giftModule",
      passed: false,
      status: "error",
      message: `Erro ao verificar módulo de presente: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
