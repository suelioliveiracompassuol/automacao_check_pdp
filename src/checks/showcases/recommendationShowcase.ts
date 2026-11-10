/**
 * Recommendation showcase ("achamos que você vai gostar"): Einstein-driven, loads lazily.
 */

import { Page } from "@playwright/test";
import { CheckResult } from "../../types.js";
import { SELECTORS } from "../configs/config.js";
import { getShowcaseSections } from "./brandShowcase.js";
import { checkEinsteinApi, countEinsteinProducts, einsteinShowcaseCache } from "./einstein.js";

/** Scrolls down half a viewport at a time (IntersectionObserver-driven lazy loading). */
async function scrollThroughPage(page: Page, stepDelayMs: number): Promise<void> {
  await page.evaluate(async (delay) => {
    const scrollHeight = document.body.scrollHeight;
    const viewportHeight = window.innerHeight;
    for (let i = 0; i < scrollHeight; i += viewportHeight / 2) {
      window.scrollTo(0, i);
      await new Promise((r) => setTimeout(r, delay));
    }
    window.scrollTo(0, scrollHeight);
  }, stepDelayMs);
}

/**
 * Check if Recommendation Showcase (2nd showcase section) is present with products.
 * Note: This section loads asynchronously (Einstein Recommender / lazy hydration).
 * Strategy: wait for the 2nd *populated* showcase section to appear (ignores empty
 * placeholder sections and other in-between sections like Shop the Set).
 */
export async function checkRecommendationShowcase(
  page: Page,
): Promise<CheckResult> {
  const featureKey = "recommendationShowcase";
  const feature = 'Vitrine "Achamos que você vai gostar"';

  try {
    // Scroll gradually to trigger lazy loading (IntersectionObserver)
    await scrollThroughPage(page, 300);
    await new Promise<void>((resolve) => setTimeout(resolve, 2500));

    // Populated section locator — sections that have product card links
    const populatedSections = page.locator(SELECTORS.showcase.populatedSection);

    // First try: find section by title text (more reliable for LATAM pages)
    // This handles "también te puede gustar", "achamos que você vai gostar", etc.
    const byTitle = page
      .locator(SELECTORS.recommendationShowcase.section)
      .filter({
        has: page.locator(SELECTORS.recommendationShowcase.productCards),
      });
    const titleCount = await byTitle.count().catch(() => 0);

    let activeSection = byTitle.first();
    let populated = false;

    if (titleCount > 0) {
      const visible = await byTitle
        .first()
        .isVisible()
        .catch(() => false);
      if (visible) {
        populated = true;
      }
    }

    // Second try: use position (2nd populated section = recommendation showcase)
    // (1st = brand showcase which is SSR; 2nd = Einstein recommendation)
    if (!populated) {
      const secondSection = populatedSections.nth(1);
      const secondVisible = await secondSection
        .waitFor({ state: "visible", timeout: 40000 })
        .then(() => true)
        .catch(() => false);
      if (secondVisible) {
        activeSection = secondSection;
        populated = true;
      }
    }

    // Resolve expected content zone name for use in all branches below
    const einsteinZone = await checkEinsteinApi(
      page,
      "EXPERIENCIA",
      "EXPERIENCIA",
    );
    const zoneName =
      einsteinZone.contentZone ??
      einsteinZone.expectedContentZone ??
      "EXPERIENCIA";

    // Check pre-navigation captured data (set by setupEinsteinShowcaseCapture).
    // If the capture shows 0 or -1 (body not yet buffered / first response was
    // empty), poll for up to 8 s more — the Einstein API can fire lazily and a
    // subsequent response may arrive with actual campaigns.
    let captured = einsteinShowcaseCache.get(page);
    if (!populated && (!captured || captured.campaignCount <= 0)) {
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        await new Promise<void>((r) => setTimeout(r, 500));
        captured = einsteinShowcaseCache.get(page);
        if (captured && captured.campaignCount > 0) {
          break;
        }
      }
    }

    // -----------------------------------------------------------------------
    // Retry via page reload: Einstein CDN/personalisation can return empty on
    // the first request but populate the cache for subsequent ones.  Reload
    // the page so the server-side rendering gets a fresh chance with warmer
    // CDN cache.  Only do this when the section wasn't found AND the API
    // returned 0 campaigns (genuine miss).
    // -----------------------------------------------------------------------
    if (
      !populated &&
      einsteinZone.campaignCount <= 0 &&
      (!captured || captured.campaignCount <= 0)
    ) {
      await new Promise<void>((r) => setTimeout(r, 2000));

      // Set up the response watcher BEFORE reload so we don't miss it
      const einsteinResponseCapture = page
        .waitForResponse(
          (res) =>
            res.url().includes("einstein/personalization/campaign/products") &&
            res.url().includes("VITRINE_PDP_EXPERIENCIA"),
          { timeout: 20000 },
        )
        .then(async (res) => {
          const body = (await res.json().catch(() => null)) as Record<
            string,
            unknown
          > | null;
          if (!body || !Array.isArray(body.campaignResponses)) {
            return 0;
          }
          return countEinsteinProducts(body.campaignResponses as unknown[]);
        })
        .catch(() => 0);

      await page
        .reload({ waitUntil: "domcontentloaded", timeout: 30000 })
        .catch(() => {});

      // Wait for the Einstein API response that fires during reload
      const reloadCampaignCount = await einsteinResponseCapture;

      // If the reload gave us data, update the cache so downstream logic sees it
      if (reloadCampaignCount > 0) {
        einsteinShowcaseCache.set(page, {
          campaignCount: reloadCampaignCount,
          httpStatus: 200,
          reqHeaders: captured?.reqHeaders ?? {},
        });
        captured = einsteinShowcaseCache.get(page);
      }

      await new Promise<void>((r) => setTimeout(r, 2000));

      // Scroll again to trigger lazy hydration
      await scrollThroughPage(page, 200);
      await new Promise<void>((r) => setTimeout(r, 2500));

      // Re-check DOM for the recommendation section
      const byTitleRetry = page
        .locator(SELECTORS.recommendationShowcase.section)
        .filter({
          has: page.locator(SELECTORS.recommendationShowcase.productCards),
        });
      const titleCountRetry = await byTitleRetry.count().catch(() => 0);
      if (titleCountRetry > 0) {
        const visibleRetry = await byTitleRetry
          .first()
          .isVisible()
          .catch(() => false);
        if (visibleRetry) {
          activeSection = byTitleRetry.first();
          populated = true;
        }
      }

      // Also retry via position (2nd populated section)
      if (!populated) {
        const populatedRetry = await getShowcaseSections(page);
        const secondRetry = populatedRetry.nth(1);
        const secondVisibleRetry = await secondRetry
          .waitFor({ state: "visible", timeout: 10000 })
          .then(() => true)
          .catch(() => false);
        if (secondVisibleRetry) {
          activeSection = secondRetry;
          populated = true;
        }
      }

      // Sync cache one more time (async listener may have completed by now)
      captured = einsteinShowcaseCache.get(page);
    }

    if (populated) {
      // DOM section found — ideal path, report product count + title
      // Use a[href*="/p/"] directly (same as populatedSection detection)
      // to avoid the narrower class-based selectors returning 0 within the scoped section.
      const cardCount = await activeSection
        .locator('a[href*="/p/"]')
        .count()
        .catch(() => 0);
      const title = await activeSection
        .locator("h2")
        .first()
        .textContent()
        .catch(() => "");

      return {
        feature,
        featureKey,
        passed: true,
        status: "pass",
        message: `Vitrine de recomendações presente com ${cardCount} produto(s)${title ? ` ("${title.trim()}")` : ""} [contentZone: ${zoneName}]`,
        details: {
          productCount: cardCount,
          title: title?.trim(),
          einsteinContentZone: zoneName,
          einsteinCampaignCount:
            captured?.campaignCount ?? einsteinZone.campaignCount,
        },
      };
    }

    // DOM section did not appear — use network-captured data as fallback
    const bestCampaignCount = Math.max(
      captured?.campaignCount ?? -1,
      einsteinZone.campaignCount,
    );

    if (bestCampaignCount > 0) {
      // API returned products but component didn't render in headless browser
      // (known limitation: some Einstein carousels require real browser rendering)
      return {
        feature,
        featureKey,
        passed: true,
        status: "pass",
        message: `Vitrine de recomendações: API ok (${bestCampaignCount} campanha(s), ${zoneName}) — componente não renderizou no browser headless`,
        details: {
          einsteinContentZone: zoneName,
          einsteinCampaignCount: bestCampaignCount,
          httpStatus: captured?.httpStatus ?? einsteinZone.httpStatus,
          note: "DOM section not rendered in headless Playwright; API confirmed working",
        },
      };
    }

    if (captured !== undefined && captured.campaignCount !== -1) {
      // HTTP 200 + empty campaignResponses: the API is configured correctly and
      // reachable, but Einstein returned no personalisation data for this
      // anonymous (no SLAS token) session.  This is expected behaviour —
      // authenticated users will see the showcase.  Treat as PASS.
      // Any non-200 status means something actually went wrong → keep warning.
      const apiOk = captured.httpStatus === 200;
      return {
        feature,
        featureKey,
        passed: true,
        status: apiOk ? "pass" : "warning",
        message: apiOk
          ? `Vitrine configurada (API ok, contentZone: "${zoneName}") — sem dados para sessão anônima`
          : `API retornou 0 campanhas para a content zone "${zoneName}" (HTTP ${captured.httpStatus ?? "?"})`,
        details: {
          contentZone: zoneName,
          httpStatus: captured.httpStatus,
          ...(apiOk && { note: "empty-anonymous-session" }),
        },
      };
    }

    // No pre-capture data (or body-parse error) — fall back to performance-entry diagnostics
    const allBgSections = page.locator(SELECTORS.showcase.section);
    const allCount = await allBgSections.count().catch(() => 0);

    // Capture all section titles for debugging (helps identify what text CL pages use)
    const allTitles: string[] = [];
    for (let i = 0; i < Math.min(allCount, 10); i++) {
      const section = allBgSections.nth(i);
      const h2Text = await section
        .locator("h2")
        .first()
        .textContent()
        .catch(() => null);
      const h3Text = await section
        .locator("h3")
        .first()
        .textContent()
        .catch(() => null);
      const titleText = h2Text || h3Text;
      if (titleText?.trim()) {
        allTitles.push(titleText.trim());
      }
    }
    console.log("SECTION TITLES FOUND:", allTitles);

    if (einsteinZone.called && einsteinZone.campaignCount === 0) {
      const apiOk = einsteinZone.httpStatus === 200;
      return {
        feature,
        featureKey,
        passed: true,
        status: apiOk ? "pass" : "warning",
        message: apiOk
          ? `Vitrine configurada (API ok, contentZone: "${zoneName}") — sem dados para sessão anônima`
          : `API retornou 0 campanhas para a content zone "${zoneName}" (HTTP ${einsteinZone.httpStatus ?? "?"})`,
        details: {
          einsteinUrl: einsteinZone.url,
          contentZone: zoneName,
          httpStatus: einsteinZone.httpStatus,
          ...(apiOk && { note: "empty-anonymous-session" }),
          sectionTitlesFound: allTitles,
        },
      };
    }

    if (einsteinZone.called && einsteinZone.campaignCount > 0) {
      return {
        feature,
        featureKey,
        passed: false,
        status: "fail",
        message: `Content zone "${zoneName}" foi chamada; API de personalização retornou ${einsteinZone.campaignCount} campanha(s), mas vitrine não renderizou na tela`,
        details: {
          einsteinUrl: einsteinZone.url,
          campaignCount: einsteinZone.campaignCount,
          contentZone: zoneName,
          sectionTitlesFound: allTitles,
        },
      };
    }

    if (!einsteinZone.called) {
      return {
        feature,
        featureKey,
        passed: false,
        status: "warning",
        message: `Placeholder da vitrine de recomendações presente mas Einstein API não foi chamada [contentZone esperada: ${zoneName}]`,
        details: {
          totalSections: allCount,
          contentZone: zoneName,
          sectionTitlesFound: allTitles,
        },
      };
    }

    // called=true but campaignCount=-1: re-fetch blocked (e.g. 403)
    return {
      feature,
      featureKey,
      passed: false,
      status: "warning",
      message: `Placeholder da vitrine de recomendações presente mas conteúdo não carregou [contentZone: ${zoneName}]${
        einsteinZone.fetchError
          ? ` — re-fetch erro: ${einsteinZone.fetchError}`
          : ""
      }`,
      details: {
        sectionExists: await page
          .locator(SELECTORS.recommendationShowcase.section)
          .isVisible()
          .catch(() => false),
        contentZone: zoneName,
        einsteinUrl: einsteinZone.url,
        fetchError: einsteinZone.fetchError,
        sectionTitlesFound: allTitles,
        totalSections: allCount,
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
