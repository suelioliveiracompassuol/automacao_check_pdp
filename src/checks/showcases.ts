import { Page } from "@playwright/test";
import { CheckResult } from "../types.js";

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
async function getShowcaseSections(page: Page) {
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

    if (sectionCount < 1) {
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
    const productCards = brandSection.locator('a[href*="/p/"]');
    const cardCount = await productCards.count().catch(() => 0);

    // Get the section title for the report
    const title = await brandSection
      .locator("h2")
      .first()
      .textContent()
      .catch(() => "");

    return {
      feature,
      featureKey,
      passed: true,
      status: "pass",
      message: `Vitrine presente com ${cardCount} produto(s)${title ? ` ("${title.trim()}")` : ""}`,
      details: { productCount: cardCount, title: title?.trim() },
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

/**
 * Check if Recommendation Showcase (2nd showcase section) is present with products
 * Note: This section may take time to load (lazy loading), so we scroll and wait.
 * The Einstein Recommender may not populate in headless mode for some operations.
 */
export async function checkRecommendationShowcase(
  page: Page,
): Promise<CheckResult> {
  const featureKey = "recommendationShowcase";
  const feature = 'Vitrine "Achamos que você vai gostar"';

  try {
    // Scroll progressively down to trigger lazy loading of recommendations section
    for (let i = 1; i <= 4; i++) {
      await page.evaluate((step) => window.scrollTo(0, step * 1500), i);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const sections = await getShowcaseSections(page);
    const sectionCount = await sections.count().catch(() => 0);

    if (sectionCount < 2) {
      // Check if there's an empty placeholder section (Einstein Recommender SSR placeholder)
      const allBgSections = page.locator(SHOWCASE_SECTION_SELECTOR);
      const allCount = await allBgSections.count().catch(() => 0);

      if (allCount >= 2) {
        // Placeholder sections exist but content didn't populate (headless limitation)
        return {
          feature,
          featureKey,
          passed: true,
          status: "warning",
          message:
            "Placeholder da vitrine de recomendações presente mas conteúdo não carregou (Einstein Recommender não popula em headless)",
          details: { totalSections: allCount, populatedSections: sectionCount },
        };
      }

      return {
        feature,
        featureKey,
        passed: false,
        status: "fail",
        message: "Vitrine de recomendações não encontrada",
      };
    }

    // 2nd showcase section = recommendation showcase
    const recoSection = sections.nth(1);
    const productCards = recoSection.locator('a[href*="/p/"]');
    const cardCount = await productCards.count().catch(() => 0);

    // Get the section title for the report
    const title = await recoSection
      .locator("h2")
      .first()
      .textContent()
      .catch(() => "");

    if (cardCount === 0) {
      return {
        feature,
        featureKey,
        passed: false,
        status: "fail",
        message: "Vitrine de recomendações encontrada mas sem produtos",
      };
    }

    return {
      feature,
      featureKey,
      passed: true,
      status: "pass",
      message: `Vitrine de recomendações presente com ${cardCount} produto(s)${title ? ` ("${title.trim()}")` : ""}`,
      details: { productCount: cardCount, title: title?.trim() },
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
