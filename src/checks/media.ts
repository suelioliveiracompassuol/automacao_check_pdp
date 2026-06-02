import { Page } from "@playwright/test";
import { CheckResult } from "../types.js";
import { SELECTORS } from "./configs/config.js";

/**
 * Check if product images are present and loaded correctly
 * Only checks the main product carousel, excludes recommendation vitrines
 */
export async function checkImages(page: Page): Promise<CheckResult> {
  const featureKey = "images";
  const feature = "Imagens do produto";

  try {
    // Extract product code from URL to filter images
    const url = page.url();
    const productCodeMatch =
      url.match(/\/([A-Z]+-\d+)(?:[?#]|$)/i) || url.match(/\/(\d+)(?:[?#]|$)/);
    const productCode = productCodeMatch ? productCodeMatch[1] : null;

    // Look for product image gallery - prefer specific PDP carousel selectors
    // Exclude recommendation/showcase carousels by being more specific
    const pdpCarouselSelectors = [
      '[data-testid="main-pdp-image-carousel"]',
      '[data-testid="pdp-image-gallery"]',
      ".swiper-fade.swiper-vertical", // Main product carousel typically uses fade + vertical thumbnails
      ".swiper.swiper-fade", // Product carousel with fade transition
      '[class*="product-gallery"]',
      '[class*="pdp-gallery"]',
    ];

    let carouselLocator = null;
    let hasCarousel = false;

    // Try specific PDP selectors first
    for (const selector of pdpCarouselSelectors) {
      const loc = page.locator(selector).first();
      const isVisible = await loc
        .isVisible({ timeout: 1000 })
        .catch(() => false);
      if (isVisible) {
        carouselLocator = loc;
        hasCarousel = true;
        break;
      }
    }

    // Fallback to generic carousel selector
    if (!hasCarousel) {
      const genericCarousel = page.locator(SELECTORS.images.carousel).first();
      hasCarousel = await genericCarousel
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      if (hasCarousel) {
        carouselLocator = genericCarousel;
      }
    }

    // Scope image check to the product gallery only (excludes vitrines/recomendações)
    let imageLocator;
    if (hasCarousel && carouselLocator) {
      // Check only images inside the product gallery container
      imageLocator = carouselLocator.locator("img");
    } else {
      // Fallback: use product image selector
      imageLocator = page.locator(SELECTORS.images.productImage);
    }

    // If we have a product code, filter images to only those matching the product
    if (productCode && !hasCarousel) {
      imageLocator = page.locator(`img[src*="${productCode}"]`);
    }

    let imageCount = await imageLocator.count().catch(() => 0);

    // Fallback for Natura BR specific image naming convention
    if (imageCount === 0 && productCode && productCode.startsWith("NATBRA-")) {
      const numericCode = productCode.replace("NATBRA-", "");
      imageLocator = page.locator(`img[src*="${numericCode}"]`);
      imageCount = await imageLocator.count().catch(() => 0);
    }

    if (imageCount === 0) {
      // Try broader selector as last resort
      const allImages = page.locator(
        'img[src*="natura"], img[src*="avon"], img[src*="production.na01"]',
      );
      const totalImages = await allImages.count().catch(() => 0);

      if (totalImages === 0) {
        return {
          feature,
          featureKey,
          passed: false,
          status: "fail",
          message: "Nenhuma imagem do produto encontrada",
        };
      }
      imageLocator = allImages;
      imageCount = totalImages;
    }

    // Verify images are properly loaded (only visible/rendered ones)
    const images = await imageLocator.all();
    let loadedCount = 0;
    let brokenCount = 0;
    const brokenSrcs: string[] = [];

    for (const img of images) {
      try {
        const result = await img.evaluate((el: HTMLImageElement) => {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          // Skip images that aren't rendered (hidden, lazy, zero-size)
          const isRendered =
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== "none" &&
            style.visibility !== "hidden";

          return {
            loaded: el.complete && el.naturalWidth > 0,
            isRendered,
            src: el.src || el.getAttribute("data-src") || "",
          };
        });

        if (!result.isRendered) {
          continue;
        }

        if (result.loaded) {
          loadedCount++;
        } else {
          brokenCount++;
          if (result.src) {
            brokenSrcs.push(
              result.src.split("?")[0].split("/").pop() || result.src,
            );
          }
        }
      } catch {
        brokenCount++;
      }
    }

    if (loadedCount === 0) {
      return {
        feature,
        featureKey,
        passed: false,
        status: "fail",
        message: `Imagens encontradas (${imageCount}) mas nenhuma carregou corretamente`,
        details: { imageCount, brokenCount },
      };
    }

    if (brokenCount > 0) {
      return {
        feature,
        featureKey,
        passed: false,
        status: "fail",
        message: `${loadedCount} ok, ${brokenCount} imagem(ns) quebrada(s)${brokenSrcs.length ? ": " + brokenSrcs.slice(0, 3).join(", ") : ""}`,
        details: {
          hasCarousel,
          imageCount,
          loadedCount,
          brokenCount,
          brokenSrcs: brokenSrcs.slice(0, 5),
        },
      };
    }

    return {
      feature,
      featureKey,
      passed: true,
      status: "pass",
      message: `${loadedCount} imagem(ns) carregada(s) corretamente${hasCarousel ? " (carrossel presente)" : ""}`,
      details: {
        hasCarousel,
        imageCount,
        loadedCount,
        brokenCount,
      },
    };
  } catch (error) {
    return {
      feature,
      featureKey,
      passed: false,
      status: "error",
      message: `Erro ao verificar imagens: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
