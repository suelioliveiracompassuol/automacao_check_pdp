/**
 * Script to extract Commerce Feature Flags from the page
 * The feature flags are loaded server-side and passed to React context
 */

import { chromium } from "@playwright/test";

async function extractFeatureFlags() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  const url =
    "https://www.natura.com.br/p/deo-colonia-kaiak-ultra-masculino-100-ml/NATBRA-169786";

  console.log("Navigating to:", url);
  await page.goto(url, { waitUntil: "networkidle" });

  // Try to extract feature flags from various sources
  const featureFlags = await page.evaluate(() => {
    const results: Record<string, unknown> = {};

    // 1. Try __NEXT_DATA__ script tag
    const nextDataScript = document.getElementById("__NEXT_DATA__");
    if (nextDataScript) {
      try {
        const nextData = JSON.parse(nextDataScript.textContent || "{}");
        results["__NEXT_DATA__"] = {
          found: true,
          keys: Object.keys(nextData),
          propsKeys: Object.keys(nextData.props || {}),
          pagePropsKeys: Object.keys(nextData.props?.pageProps || {}),
        };

        if (nextData.props?.pageProps?.featureFlags) {
          results.featureFlags = nextData.props.pageProps.featureFlags;
        }
      } catch {
        results["__NEXT_DATA__"] = { found: true, parseError: true };
      }
    } else {
      results["__NEXT_DATA__"] = { found: false };
    }

    // 2. Try React Fiber (internal React state)
    const findReactFiber = (element: Element): unknown => {
      const keys = Object.keys(element);
      const fiberKey = keys.find(
        (k) =>
          k.startsWith("__reactFiber$") ||
          k.startsWith("__reactInternalInstance$"),
      );
      if (fiberKey) {
        return (element as Record<string, unknown>)[fiberKey];
      }
      return null;
    };

    // 3. Try window globals
    const win = window as Record<string, unknown>;
    const globalKeys = [
      "__FEATURE_FLAGS__",
      "featureFlags",
      "__MULTISITE_CONTEXT__",
      "__NEXT_DATA__",
    ];
    for (const key of globalKeys) {
      if (win[key]) {
        results[`window.${key}`] = win[key];
      }
    }

    // 4. Try to find MultisiteProvider context
    // Look for script tags that might contain feature flags
    const scripts = document.querySelectorAll("script");
    scripts.forEach((script, idx) => {
      const content = script.textContent || "";
      if (content.includes("featureFlags") && content.length < 50000) {
        // Check if it's RSC payload
        if (
          content.includes("$Sreact.suspense") ||
          content.includes("self.__next_f.push")
        ) {
          results[`script_${idx}_rsc`] = "RSC payload found";

          // Try to extract feature flags from RSC payload
          const featureFlagsMatch = content.match(
            /"featureFlags":\s*({[^}]+})/,
          );
          if (featureFlagsMatch) {
            try {
              results.featureFlagsFromRSC = JSON.parse(featureFlagsMatch[1]);
            } catch {
              results.featureFlagsFromRSC = "parse error";
            }
          }
        }
      }
    });

    // 5. Check localStorage/sessionStorage
    try {
      const storage = { ...localStorage };
      const featureFlagStorage = Object.entries(storage).filter(
        ([k]) =>
          k.toLowerCase().includes("feature") ||
          k.toLowerCase().includes("flag"),
      );
      if (featureFlagStorage.length > 0) {
        results.localStorage = Object.fromEntries(featureFlagStorage);
      }
    } catch {
      // Storage access denied
    }

    return results;
  });

  console.log("\n=== Feature Flags Extraction Results ===\n");
  console.log(JSON.stringify(featureFlags, null, 2));

  // Also monitor network requests
  console.log("\n=== Checking for feature-flag API calls ===\n");

  const newPage = await context.newPage();
  const featureFlagRequests: Array<{ url: string; response?: unknown }> = [];

  newPage.on("response", async (response) => {
    const url = response.url();
    if (url.includes("feature-flag") || url.includes("featureFlags")) {
      console.log("Found feature-flag request:", url);
      try {
        const body = await response.json();
        featureFlagRequests.push({ url, response: body });
        console.log("Response:", JSON.stringify(body, null, 2).slice(0, 2000));
      } catch {
        featureFlagRequests.push({ url, response: "not JSON" });
      }
    }
  });

  await newPage.goto(url, { waitUntil: "networkidle" });

  if (featureFlagRequests.length === 0) {
    console.log(
      "No feature-flag API calls detected (flags are likely loaded during SSR)",
    );
  }

  await browser.close();
}

extractFeatureFlags().catch(console.error);
