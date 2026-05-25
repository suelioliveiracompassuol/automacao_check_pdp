/**
 * Quick test for a single SKU - tests both ecommerce and social commerce
 */

import { chromium } from "@playwright/test";
import { SELECTORS, TIMING } from "./checks/configs/config.js";
import {
  checkShopTheSet,
  checkReviews,
  checkRecommendationShowcase,
} from "./checks/index.js";

async function testUrl(label: string, url: string) {
  console.log(`\n🧪 Testing ${label}`);
  console.log(`   URL: ${url}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();

  try {
    const response = await page.goto(url, {
      timeout: TIMING.navigationTimeout,
      waitUntil: "domcontentloaded",
    });

    if (!response || response.status() >= 400) {
      throw new Error(`HTTP ${response?.status() || "unknown"}`);
    }

    console.log("   ✓ Page loaded");

    // Dismiss cookie banner
    try {
      const cookieButton = page
        .locator(SELECTORS.cookieConsent.acceptButton)
        .first();
      const isVisible = await cookieButton
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      if (isVisible) {
        await cookieButton.click();
        console.log("   ✓ Cookie banner dismissed");
      }
    } catch {
      // Cookie banner may not be present
    }

    // Wait for dynamic content and scroll progressively
    await page.waitForTimeout(2000); // eslint-disable-line playwright/no-wait-for-timeout

    // Scroll progressively to trigger lazy loading
    for (let i = 1; i <= 5; i++) {
      await page.evaluate((step) => window.scrollTo(0, step * 1000), i);
      await page.waitForTimeout(500); // eslint-disable-line playwright/no-wait-for-timeout
    }
    await page.waitForTimeout(2000); // eslint-disable-line playwright/no-wait-for-timeout

    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1000); // eslint-disable-line playwright/no-wait-for-timeout

    // Test Shop the Set
    console.log("\n📦 Testing Shop the Set...");
    const shopTheSetResult = await checkShopTheSet(page);
    console.log(
      `   ${shopTheSetResult.passed ? "✅" : "❌"} ${shopTheSetResult.message}`,
    );

    // Test Reviews
    console.log("\n📦 Testing Reviews...");
    const reviewsResult = await checkReviews(page);
    console.log(
      `   ${reviewsResult.passed ? "✅" : "❌"} ${reviewsResult.message}`,
    );

    // Test Recommendations (with delay)
    console.log("\n📦 Testing Recommendations...");
    const recsResult = await checkRecommendationShowcase(page);
    console.log(`   ${recsResult.passed ? "✅" : "❌"} ${recsResult.message}`);

    console.log("\n✅ Test completed!");
  } catch (error) {
    console.log(
      `   ❌ Error: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    await context.close();
    await browser.close();
  }
}

async function main() {
  // Check if URL is provided as argument
  const urlArg = process.argv[2];
  if (urlArg) {
    await testUrl("Custom URL Test", urlArg);
    return;
  }

  // Test 1: Ecommerce PDP (natura.com.br)
  await testUrl(
    "NATBRA-172407 - Ecommerce (natura.com.br)",
    "https://www.natura.com.br/p/oleo-em-creme-ultranutritivo-restaurador-tododia-jambo-rosa-e-flor-de-caju-200-ml/NATBRA-172407",
  );

  // Test 2: Social Commerce PDP (minhaloja.natura.com)
  await testUrl(
    "NATBRA-249685 - Social Commerce (minhaloja.natura.com)",
    "https://www.minhaloja.natura.com/p/desodorante-colonia-kaiak-extremo-masculino-promocao-vai-dar-onda-100-ml/NATBRA-249685?consultoria=naieli&marca=natura",
  );
}

main();
