/**
 * Brand showcase ("mais produtos da marca"): the first showcase section of the PDP.
 */

import { Page } from "@playwright/test";
import { CheckResult } from "../../types.js";
import { SELECTORS } from "../configs/config.js";
import { checkEinsteinApi } from "./einstein.js";

/**
 * Structural selector for showcase sections.
 * All operations use the same whitelabel code:
 *   <section class="bg-background empty:hidden pb-standard pt-semi-x ...">
 *     <h2 class="!font-semibold md:text-heading-5 text-content-highlight">title</h2>
 *     ... product cards with data-testid="btn-add-to-cart" ...
 *   </section>
 *
 * The 1st such section = Brand Showcase ("mais produtos da marca" / "más productos de la marca")
 * The 2nd such section = Recommendation Showcase ("achamos que você vai gostar" / "también te puede gustar")
 */
const SHOWCASE_SECTION_SELECTOR =
  "section.bg-background:not(#ot-pc-lst):not(#ot-fltr-modal)";

/**
 * Find all showcase sections on the page using structural selectors.
 * Matches sections that contain product cards (with add-to-cart button OR product links).
 * Excludes empty sections.
 */
export async function getShowcaseSections(page: Page) {
  // Find sections that contain product cards (either btn-add-to-cart or product links)
  const sections = page.locator(
    `${SHOWCASE_SECTION_SELECTOR}:has([data-testid="btn-add-to-cart"], a[href*="/p/"])`,
  );
  return sections;
}

/**
 * Check if Brand Showcase (1st showcase section) is present with products
 */
export async function checkBrandShowcase(page: Page): Promise<CheckResult> {
  const featureKey = "brandShowcase";
  const feature = 'Vitrine "Mais produtos da marca"';

  try {
    const sections = await getShowcaseSections(page);
    const sectionCount = await sections.count().catch(() => 0);

    // Also probe the Einstein API for brand showcase diagnostics
    const einstein = await checkEinsteinApi(
      page,
      "BRAND",
      "MAIS_PRODUTOS_DA_MARCA",
    );
    const zoneName =
      einstein.contentZone ?? einstein.expectedContentZone ?? "BRAND";

    if (sectionCount < 1) {
      // Check if there's an empty placeholder section
      const allBgSections = page.locator(SHOWCASE_SECTION_SELECTOR);
      const allCount = await allBgSections.count().catch(() => 0);

      if (allCount >= 1 && einstein.called && einstein.campaignCount === 0) {
        return {
          feature,
          featureKey,
          passed: false,
          status: "fail",
          message: `Content zone "${zoneName}" foi chamada mas API de personalização retornou vazia (campaignResponses: [])`,
          details: {
            einsteinUrl: einstein.url,
            contentZone: zoneName,
          },
        };
      }

      if (allCount >= 1 && einstein.called && einstein.campaignCount > 0) {
        return {
          feature,
          featureKey,
          passed: false,
          status: "fail",
          message: `Content zone "${zoneName}" foi chamada; API de personalização retornou ${einstein.campaignCount} campanha(s), mas vitrine não renderizou na tela`,
          details: {
            einsteinUrl: einstein.url,
            campaignCount: einstein.campaignCount,
            contentZone: zoneName,
          },
        };
      }

      return {
        feature,
        featureKey,
        passed: false,
        status: "fail",
        message: 'Vitrine "Mais produtos da marca" não encontrada',
      };
    }

    // 1st showcase section = brand showcase
    const brandSection = sections.nth(0);
    const productCards = brandSection.locator(
      SELECTORS.brandShowcase.productCards,
    );
    let cardCount = await productCards.count().catch(() => 0);
    // Fallback: NCF SSR and some country sites use plain <a href="/p/"> or <a href="/products/">
    if (cardCount === 0) {
      cardCount = await brandSection
        .locator('a[href*="/p/"], a[href*="/products/"]')
        .count()
        .catch(() => 0);
    }

    // Get the section title for the report
    const title = await brandSection
      .locator("h2")
      .first()
      .textContent()
      .catch(() => "");

    if (cardCount === 0) {
      return {
        feature,
        featureKey,
        passed: false,
        status: "warning",
        message: `Vitrine "${title?.trim() || "mais produtos da marca"}" presente mas sem produtos carregados [contentZone: ${zoneName}]`,
        details: {
          productCount: 0,
          title: title?.trim(),
          einsteinContentZone: zoneName,
          einsteinCampaignCount: einstein.campaignCount,
          note: "section found in DOM but no product cards detected after all selector fallbacks",
        },
      };
    }

    return {
      feature,
      featureKey,
      passed: true,
      status: "pass",
      message: `Vitrine presente com ${cardCount} produto(s)${title ? ` ("${title.trim()}")` : ""} [contentZone: ${zoneName}]`,
      details: {
        productCount: cardCount,
        title: title?.trim(),
        einsteinContentZone: zoneName,
        einsteinCampaignCount: einstein.campaignCount,
      },
    };
  } catch (error) {
    return {
      feature,
      featureKey,
      passed: false,
      status: "error",
      message: `Erro ao verificar vitrine: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
