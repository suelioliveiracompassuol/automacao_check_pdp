import { Page } from "@playwright/test";
import { CheckResult } from "../types.js";

/**
 * Check if AI Review Summary is present in the reviews section.
 *
 * Structural detection (whitelabel-safe):
 * - Primary: .bg-info-lightest container inside #reviews (blue card)
 * - Confirmation: icon with class containing "generativeai" (outlined-content-generativeai)
 * - The AI card has role="group" and specific padding/rounding classes
 */
export async function checkAiReviewSummary(page: Page): Promise<CheckResult> {
  const featureKey = "aiReviewSummary";
  const feature = "Resumo de avaliações por IA";

  try {
    // Scroll to reviews area
    await page.evaluate(() => window.scrollBy(0, 2000));
    await page.waitForFunction(() => document.readyState === "complete");

    const reviewsContainer = page.locator("#reviews");
    const hasReviews = await reviewsContainer
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!hasReviews) {
      return {
        feature,
        featureKey,
        passed: false,
        status: "fail",
        message: "Container #reviews não encontrado",
      };
    }

    // Strategy 1: Look for the AI summary card by its unique blue background
    const aiCard = reviewsContainer.locator(".bg-info-lightest").first();
    const hasAiCard = await aiCard
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasAiCard) {
      // Verify it's the AI card by checking for generativeai icon
      const hasGenAiIcon = await aiCard
        .locator('i[class*="generativeai"], [data-icon-name*="generativeai"]')
        .isVisible({ timeout: 2000 })
        .catch(() => false);

      const summaryText = await aiCard
        .locator("p.text-body-1")
        .first()
        .textContent({ timeout: 2000 })
        .catch(() => "");

      const contentLength = summaryText?.trim().length || 0;

      return {
        feature,
        featureKey,
        passed: true,
        status: "pass",
        message: hasGenAiIcon
          ? `Resumo por IA presente com ícone generativeai (${contentLength} chars)`
          : `Card bg-info-lightest encontrado (${contentLength} chars)`,
        details: { contentLength, hasGenAiIcon },
      };
    }

    return {
      feature,
      featureKey,
      passed: false,
      status: "fail",
      message:
        "Resumo de avaliações por IA não encontrado (.bg-info-lightest ausente em #reviews)",
    };
  } catch (error) {
    return {
      feature,
      featureKey,
      passed: false,
      status: "error",
      message: `Erro ao verificar resumo IA: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
