import { Page } from "@playwright/test";
import { CheckResult } from "../types.js";
import { SELECTORS } from "./configs/config.js";

/**
 * Check if Shop the Set / "Queridinhos que são comprados juntos" section is present
 */
export async function checkShopTheSet(page: Page): Promise<CheckResult> {
  const featureKey = "shopTheSet";
  const feature = 'Shop the Set ("Queridinhos comprados juntos")';

  try {
    // Look for the section by text content (exact phrase: "Queridinhos que são comprados juntos")
    const sectionLocator = page.locator(SELECTORS.shopTheSet.section).first();
    let sectionVisible = await sectionLocator
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!sectionVisible) {
      // Try alternative patterns (PT-BR and ES) - exact match first
      const patterns = [
        /queridinhos que s[ãa]o comprados juntos/i,
        /comprados juntos/i,
        /compre junto/i,
        /compra el set/i,
        /shop the set/i,
        /favoritos.*compran juntos/i,
        /compre em conjunto/i,
        /lleva el set/i,
      ];

      for (const pattern of patterns) {
        const headingLocator = page
          .locator("h2, h3, section, div")
          .filter({ hasText: pattern })
          .first();
        sectionVisible = await headingLocator
          .isVisible({ timeout: 2000 })
          .catch(() => false);
        if (sectionVisible) break;
      }

      if (!sectionVisible) {
        return {
          feature,
          featureKey,
          passed: false,
          status: "fail",
          message:
            'Seção "Shop the Set" / "Queridinhos comprados juntos" não encontrada',
        };
      }
    }

    // Count product cards within the section
    const productCards = page
      .locator(
        'section:has-text("queridinhos"), section:has-text("comprados juntos"), section:has-text("shop the set")',
      )
      .locator('a[href*="/p/"]');
    const cardCount = await productCards.count().catch(() => 0);

    if (cardCount === 0) {
      // Try broader selector
      const allProductCards = page.locator(SELECTORS.shopTheSet.productCards);
      const totalProducts = await allProductCards.count().catch(() => 0);

      if (totalProducts === 0) {
        return {
          feature,
          featureKey,
          passed: true,
          status: "pass",
          message:
            'Seção "Shop the Set" presente (sem produtos carregados ainda)',
          details: { productCount: 0 },
        };
      }
    }

    return {
      feature,
      featureKey,
      passed: true,
      status: "pass",
      message: `Seção "Shop the Set" presente com ${cardCount > 0 ? cardCount : "múltiplos"} produto(s)`,
      details: { productCount: cardCount },
    };
  } catch (error) {
    return {
      feature,
      featureKey,
      passed: false,
      status: "error",
      message: `Erro ao verificar Shop the Set: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
