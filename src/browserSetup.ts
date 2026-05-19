import { Browser, BrowserContext } from "@playwright/test";

/**
 * Creates a standardized browser context with anti-bot measures and pre-injected cookies.
 * This ensures consistency across different types of journeys (direct PDP vs Exploratory).
 *
 * @param browser The Playwright Browser instance
 * @param targetUrl The initial URL to be visited (used to set cookie domains correctly)
 * @returns A configured BrowserContext
 */
export async function createStandardContext(
  browser: Browser,
  targetUrl: string,
): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {
      "Accept-Language": "pt-BR,pt;q=0.9,es;q=0.8,en;q=0.7",
    },
  });

  // Mask automation signals that trigger Akamai bot detection
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    Object.defineProperty(navigator, "plugins", {
      get: () => [1, 2, 3, 4, 5],
    });
    Object.defineProperty(navigator, "languages", {
      get: () => ["pt-BR", "pt", "es", "en"],
    });
  });

  // Pre-inject OneTrust consent cookies to ensure Einstein API returns campaigns
  // for headless/bot sessions without previous browsing history.
  try {
    const parsedUrl = new URL(targetUrl);
    const baseDomain = parsedUrl.hostname.replace(/^www\./, "");
    await context.addCookies([
      {
        name: "OptanonAlertBoxClosed",
        value: new Date().toISOString(),
        domain: `.${baseDomain}`,
        path: "/",
      },
      {
        name: "OptanonConsent",
        value: `isGpcEnabled=0&datestamp=${encodeURIComponent(new Date().toISOString())}&version=202306.1.0&browserGpcFlag=0&isIABGlobal=false&hosts=&landingPath=NotLandingPage&groups=C0001%3A1%2CC0003%3A1%2CC0002%3A1%2CC0004%3A1%2CC0005%3A1&AwaitingReconsent=false&geolocation=%3B`,
        domain: `.${baseDomain}`,
        path: "/",
      },
    ]);
  } catch (e) {
    console.log(`   ⚠️ Failed to set consent cookies: ${e}`);
  }

  return context;
}
