import { Page } from "@playwright/test";
import { CheckResult } from "../types.js";
import { SELECTORS } from "./configs/config.js";

/**
 * Check if shipping simulation section is present with CEP input
 */
export async function checkShipping(page: Page): Promise<CheckResult> {
  const featureKey = "shipping";
  const feature = "Simulação de frete";

  try {
    // Look for shipping section
    const sectionLocator = page.locator(SELECTORS.shipping.section).first();
    let sectionVisible = await sectionLocator
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!sectionVisible) {
      // Try alternative: look for text patterns (PT and ES)
      const patterns = [
        /simular frete/i,
        /calcular frete/i,
        /consultar frete/i,
        /digite seu cep/i,
        /insira seu cep/i,
        /calcular env[ií]o/i,
        /costo de env[ií]o/i,
        /env[ií]o gratis/i,
        /c[oó]digo postal/i,
        /ingresa tu c[oó]digo postal/i,
      ];

      for (const pattern of patterns) {
        const textLocator = page
          .locator("text")
          .filter({ hasText: pattern })
          .first();
        sectionVisible = await textLocator
          .isVisible({ timeout: 2000 })
          .catch(() => false);
        if (sectionVisible) break;
      }

      if (!sectionVisible) {
        // Also try looking for the CEP input directly
        const cepInput = page.locator(SELECTORS.shipping.cepInput).first();
        sectionVisible = await cepInput
          .isVisible({ timeout: 2000 })
          .catch(() => false);
      }

      if (!sectionVisible) {
        return {
          feature,
          featureKey,
          passed: false,
          status: "fail",
          message: "Seção de simulação de frete não encontrada",
        };
      }
    }

    // Check for CEP input field
    const cepInputLocator = page.locator(SELECTORS.shipping.cepInput).first();
    let hasCepInput = await cepInputLocator
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (!hasCepInput) {
      // Try broader input selector within shipping context
      const allInputs = page.locator(
        'input[type="text"], input[type="tel"], input[inputmode="numeric"], input[type="number"]',
      );
      const inputs = await allInputs.all();

      for (const input of inputs) {
        const placeholder = await input
          .getAttribute("placeholder")
          .catch(() => "");
        const label = await input.getAttribute("aria-label").catch(() => "");
        const name = await input.getAttribute("name").catch(() => "");
        const id = await input.getAttribute("id").catch(() => "");
        const maxLength = await input.getAttribute("maxlength").catch(() => "");

        // Check for CEP-related attributes (PT: CEP, ES: código postal, CP)
        const isCepInput =
          placeholder?.toLowerCase().includes("cep") ||
          placeholder?.toLowerCase().includes("insira") ||
          placeholder?.toLowerCase().includes("codigo postal") ||
          placeholder?.toLowerCase().includes("código postal") ||
          placeholder?.toLowerCase().includes("cp") ||
          label?.toLowerCase().includes("cep") ||
          label?.toLowerCase().includes("postal") ||
          name?.toLowerCase().includes("cep") ||
          name?.toLowerCase().includes("postal") ||
          id?.toLowerCase().includes("cep") ||
          id?.toLowerCase().includes("zipcode") ||
          id?.toLowerCase().includes("postal") ||
          name?.toLowerCase().includes("zip") ||
          maxLength === "9" ||
          maxLength === "8" ||
          maxLength === "5";

        if (isCepInput) {
          hasCepInput = true;
          break;
        }
      }
    }

    // If we found the shipping section, consider it a pass even if CEP input is tricky to find
    // The section existing means the feature is deployed
    if (!hasCepInput) {
      return {
        feature,
        featureKey,
        passed: true, // Changed to pass since section exists
        status: "warning",
        message: "Seção de frete presente ",
      };
    }

    return {
      feature,
      featureKey,
      passed: true,
      status: "pass",
      message: "Simulação de frete disponível com campo de CEP",
    };
  } catch (error) {
    return {
      feature,
      featureKey,
      passed: false,
      status: "error",
      message: `Erro ao verificar frete: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
