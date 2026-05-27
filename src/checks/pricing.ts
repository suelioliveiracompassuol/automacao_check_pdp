import { Page } from "@playwright/test";
import { CheckResult } from "../types.js";
import { SELECTORS } from "./configs/config.js";

/**
 * Check if pricing information is present and valid
 */
export async function checkPricing(page: Page): Promise<CheckResult> {
  const featureKey = "pricing";
  const feature = "Preço e desconto";

  try {
    // Look for pricing section by CSS class
    const pricingLocator = page.locator(SELECTORS.pricing.section).first();
    const hasPricing = await pricingLocator
      .waitFor({ state: "visible", timeout: 5000 })
      .then(() => true)
      .catch(() => false);

    // Extract price from pricing section (not entire page to avoid picking up banner/promo prices)
    const priceInfo = await page.evaluate((pricingSelector) => {
      // First try to get price from the specific pricing section
      const pricingElements = document.querySelectorAll(pricingSelector);

      // Match R$ (Brazil), $ (LATAM), S/ (Peru)
      const patterns = [
        /R\$\s*([\d.,]+)/,
        /(?:de:\s*)?\$\s*([\d.,]+)/,
        /S\/\.?\s*([\d.,]+)/,
      ];
      // Skip lines containing shipping keywords
      const skipKeywords =
        /env[ií]o|frete|fret|entrega|gratis|grátis|desde|a partir/i;

      // Try pricing section first
      for (const el of Array.from(pricingElements)) {
        const text = (el as HTMLElement).innerText || el.textContent || "";
        const lines = text.split("\n");
        for (const line of lines) {
          if (skipKeywords.test(line)) {
            continue;
          }
          for (const pattern of patterns) {
            const m = line.match(pattern);
            if (m && m[1] && m[1].length >= 2) {
              return { fullMatch: m[0], rawPrice: m[1] };
            }
          }
        }
      }

      // Fallback: look in main product area (avoid footer/header/banners)
      const mainSelectors = [
        '[data-testid="product-info"]',
        '[class*="product-info"]',
        '[class*="ProductInfo"]',
        "main",
        '[role="main"]',
        "#main-content",
      ];

      for (const selector of mainSelectors) {
        const container = document.querySelector(selector);
        if (!container) {
          continue;
        }
        const text = (container as HTMLElement).innerText || "";
        const lines = text.split("\n");
        for (const line of lines) {
          if (skipKeywords.test(line)) {
            continue;
          }
          for (const pattern of patterns) {
            const m = line.match(pattern);
            if (m && m[1] && m[1].length >= 2) {
              return { fullMatch: m[0], rawPrice: m[1] };
            }
          }
        }
      }

      // Last resort: body text but skip first 500 chars (usually header/banner)
      const bodyText = document.body.innerText;
      const lines = bodyText.substring(500).split("\n");
      for (const line of lines) {
        if (skipKeywords.test(line)) {
          continue;
        }
        for (const pattern of patterns) {
          const m = line.match(pattern);
          if (m && m[1] && m[1].length >= 2) {
            return { fullMatch: m[0], rawPrice: m[1] };
          }
        }
      }

      return null;
    }, SELECTORS.pricing.section);

    if (!priceInfo && !hasPricing) {
      return {
        feature,
        featureKey,
        passed: false,
        status: "fail",
        message: "Informação de preço não encontrada",
      };
    }

    let priceValue = 0;
    const priceText = priceInfo?.fullMatch || "";

    if (priceInfo) {
      const rawPrice = priceInfo.rawPrice;
      // Handle different number formats: 55.790,00 or 55,790.00 or 55790
      if (rawPrice.includes(",") && rawPrice.includes(".")) {
        if (rawPrice.lastIndexOf(",") > rawPrice.lastIndexOf(".")) {
          // 55.790,00 → period is thousands, comma is decimal
          priceValue = parseFloat(
            rawPrice.replace(/\./g, "").replace(",", "."),
          );
        } else {
          // 55,790.00 → comma is thousands, period is decimal
          priceValue = parseFloat(rawPrice.replace(/,/g, ""));
        }
      } else if (rawPrice.includes(",")) {
        priceValue = parseFloat(rawPrice.replace(",", "."));
      } else {
        priceValue = parseFloat(rawPrice);
      }
    }

    if (priceValue <= 0) {
      return {
        feature,
        featureKey,
        passed: false,
        status: "fail",
        message: "Preço encontrado mas valor inválido ou zero",
        details: { priceText },
      };
    }

    // Check for discount badge (optional)
    const discountLocator = page.locator(SELECTORS.pricing.discount).first();
    const hasDiscount = await discountLocator
      .waitFor({ state: "visible", timeout: 2000 })
      .then(() => true)
      .catch(() => false);

    let discountText = "";
    if (hasDiscount) {
      discountText =
        (await discountLocator.textContent().catch(() => "")) || "";
    }

    // Check for list price (crossed out)
    const listPriceLocator = page.locator(SELECTORS.pricing.listPrice).first();
    const hasListPrice = await listPriceLocator
      .waitFor({ state: "visible", timeout: 2000 })
      .then(() => true)
      .catch(() => false);

    // Detect currency symbol from price text
    const currencySymbol = priceText?.includes("R$")
      ? "R$"
      : priceText?.includes("S/")
        ? "S/"
        : "$";

    return {
      feature,
      featureKey,
      passed: true,
      status: "pass",
      message: `Preço ${currencySymbol} ${priceValue.toFixed(2)}${hasDiscount ? ` (${discountText.trim()})` : ""}`,
      details: {
        price: priceValue,
        hasDiscount,
        discountText: discountText.trim(),
        hasListPrice,
      },
    };
  } catch (error) {
    return {
      feature,
      featureKey,
      passed: false,
      status: "error",
      message: `Erro ao verificar preço: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
