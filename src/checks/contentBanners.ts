import { Page } from "@playwright/test";
import { CheckResult } from "../types.js";
import { SELECTORS } from "./configs/config.js";

/**
 * Check if content banners (widepic / product content type) are present on the PDP
 * and verify that their images are not broken.
 */
export async function checkContentBanners(page: Page): Promise<CheckResult> {
  const featureKey = "contentBanners";
  const feature = "Banners de conteúdo do produto";

  try {
    // Look for the content banner section
    const bannerSection = page
      .locator(SELECTORS.contentBanners.section)
      .first();

    const sectionVisible = await bannerSection
      .waitFor({ state: "visible", timeout: 5000 })
      .then(() => true)
      .catch(() => false);

    if (!sectionVisible) {
      // Content banners are optional — not all products have them
      return {
        feature,
        featureKey,
        passed: true,
        status: "na",
        message: "Produto sem banners de conteúdo (nenhuma seção de banner detectada) — verificação de banners não se aplica.",
      };
    }

    // Find all banner containers on the page (there can be multiple content sections)
    const allBannerSections = page.locator(SELECTORS.contentBanners.section);
    const sectionCount = await allBannerSections.count().catch(() => 0);

    let totalBanners = 0;
    let loadedCount = 0;
    let brokenCount = 0;
    const brokenSrcs: string[] = [];

    // Check each content banner section
    for (let i = 0; i < sectionCount; i++) {
      const section = allBannerSections.nth(i);
      const isVisible = await section.isVisible().catch(() => false);
      if (!isVisible) {
        continue;
      }

      // Scroll to the section to trigger lazy-loaded images
      await section.scrollIntoViewIfNeeded().catch(() => {});

      // Find images within the banner
      const bannerImages = section.locator(SELECTORS.contentBanners.image);
      const imgCount = await bannerImages.count().catch(() => 0);

      for (let j = 0; j < imgCount; j++) {
        const img = bannerImages.nth(j);
        totalBanners++;

        try {
          const result = await img.evaluate((el: HTMLImageElement) => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            const isRendered =
              rect.width > 0 &&
              rect.height > 0 &&
              style.display !== "none" &&
              style.visibility !== "hidden";

            return {
              loaded: el.complete && el.naturalWidth > 0,
              isRendered,
              src: el.src || el.getAttribute("data-src") || "",
              naturalWidth: el.naturalWidth,
              naturalHeight: el.naturalHeight,
            };
          });

          if (!result.isRendered) {
            continue;
          }

          if (result.loaded && result.naturalWidth > 0) {
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
    }

    if (totalBanners === 0) {
      return {
        feature,
        featureKey,
        passed: true,
        status: "na",
        message: `Produto sem banners de conteúdo (${sectionCount} seção encontrada, 0 imagens renderizadas) — verificação de banners não se aplica.`,
      };
    }

    if (brokenCount > 0) {
      return {
        feature,
        featureKey,
        passed: false,
        status: "fail",
        message: `${brokenCount} banner(s) quebrado(s) de ${totalBanners} encontrado(s)${brokenSrcs.length ? ": " + brokenSrcs.slice(0, 3).join(", ") : ""}`,
        details: {
          sectionCount,
          totalBanners,
          loadedCount,
          brokenCount,
          brokenSrcs: brokenSrcs.slice(0, 5),
        },
      };
    }

    if (loadedCount === 0) {
      return {
        feature,
        featureKey,
        passed: false,
        status: "fail",
        message: `${totalBanners} banner(s) encontrado(s) mas nenhum carregou corretamente`,
        details: { sectionCount, totalBanners, loadedCount, brokenCount },
      };
    }

    return {
      feature,
      featureKey,
      passed: true,
      status: "pass",
      message: `${loadedCount} banner(s) de conteúdo carregado(s) corretamente (${sectionCount} seção/seções)`,
      details: {
        sectionCount,
        totalBanners,
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
      message: `Erro ao verificar banners de conteúdo: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
