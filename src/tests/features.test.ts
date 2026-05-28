/**
 * Tests for individual feature checkers.
 *
 * Runs via `npm run test:unit`.
 *
 * This test suite uses a local mock PDP (`mocks/pdp.html`) to provide a
 * consistent and fast testing environment for checker functions that
 * operate on the DOM.
 */

import { test, expect, Page } from "@playwright/test";
import * as path from "node:path";
import { checkFavoriteButton } from "../checks/favoriteButton.js";
import { checkAddToCart } from "../checks/addToCart.js";
import { checkReviews } from "../checks/reviews.js";

const MOCK_PDP_URL = `file://${path.join(process.cwd(), "src", "tests", "mocks", "pdp.html")}`;

// Reusable function to load the page and run a checker
async function runChecker(
  page: Page,
  checker: (page: Page) => Promise<{ passed: boolean; message: string; status?: string }>,
  content: string = "",
) {
  await page.goto(MOCK_PDP_URL);
  if (content) {
    await page.evaluate((bodyContent) => {
      document.body.innerHTML = bodyContent;
    }, content);
  }
  return checker(page);
}

test.describe("Feature: Favorite Button", () => {
  test("should pass if the favorite button is visible", async ({ page }) => {
    const html = `
      <section class="bg-white">
        <button data-icon-name="action-love-on" style="width: 50px; height: 50px; display: block;">Fav</button>
      </section>
    `;
    const result = await runChecker(page, checkFavoriteButton, html);
    expect(result.passed).toBe(true);
    expect(result.message).toBe("Botão de favoritos encontrado na tela");
  });

  test("should fail if the favorite button is not visible", async ({
    page,
  }) => {
    const html = `
      <section class="bg-white">
        <!-- No button here -->
      </section>
    `;
    const result = await runChecker(page, checkFavoriteButton, html);
    expect(result.passed).toBe(false);
    expect(result.message).toBe("Botão de favoritos não encontrado na tela");
  });

  test("should fail if the button is outside the main section", async ({
    page,
  }) => {
    const html = `
      <section class="other-section">
        <button data-icon-name="action-love-on" style="width: 50px; height: 50px; display: block;">Fav</button>
      </section>
    `;
    const result = await runChecker(page, checkFavoriteButton, html);
    expect(result.passed).toBe(false);
    expect(result.message).toBe("Botão de favoritos não encontrado na tela");
  });
});

test.describe("Feature: Add to Cart", () => {
  test("should pass if an add to cart button is visible", async ({ page }) => {
    const html = `
      <button data-testid="btn-add-to-cart" style="width: 50px; height: 50px; display: block;">Comprar</button>
    `;
    const result = await runChecker(page, checkAddToCart, html);
    expect(result.passed).toBe(true);
    expect(result.message).toBe(
      "Botão de ação do carrinho (Comprar, Avise-me) encontrado na tela",
    );
  });

  test("should fail if no add to cart button is visible", async ({ page }) => {
    const html = `<div></div>`;
    const result = await runChecker(page, checkAddToCart, html);
    expect(result.passed).toBe(false);
    expect(result.message).toBe(
      "Nenhum botão de ação do carrinho encontrado na tela",
    );
  });
});

test.describe("Feature: Reviews", () => {
  test("should pass if the full reviews section is visible", async ({
    page,
  }) => {
    const html = `
      <div id="reviews" style="display: block; height: 100px;">
        <div data-testid="review-stars" style="display: block; height: 20px;"></div>
        <div data-testid="review-card" style="display: block; height: 50px;"></div>
        <div data-testid="review-card" style="display: block; height: 50px;"></div>
      </div>
    `;
    const result = await runChecker(page, checkReviews, html);
    expect(result.passed).toBe(true);
    expect(result.message).toContain("Seção de avaliações presente com 2 reviews");
  });

  test("should pass if the reviews section is present but has no reviews", async ({
    page,
  }) => {
    const html = `
      <div id="reviews" style="display: block; height: 100px;">
        <div data-testid="review-stars" style="display: block; height: 20px;"></div>
        <!-- No review cards -->
      </div>
    `;
    const result = await runChecker(page, checkReviews, html);
    expect(result.passed).toBe(true);
    expect(result.message).toContain("Seção de avaliações presente (sem reviews ainda)");
  });

  test("should return a warning if only the go-to-reviews button is found", async ({
    page,
  }) => {
    const html = `
      <button data-testid="go-to-reviews-button" style="display: block; height: 50px;"></button>
    `;
    const result = await runChecker(page, checkReviews, html);
    expect(result.passed).toBe(true);
    expect(result.status).toBe("warning");
    expect(result.message).toContain(
      "Botão go-to-reviews presente mas container #reviews não carregou",
    );
  });

  test("should fail if no reviews elements are found", async ({ page }) => {
    const html = `<div></div>`;
    const result = await runChecker(page, checkReviews, html);
    expect(result.passed).toBe(false);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("Seção de avaliações não encontrada");
  });
});

