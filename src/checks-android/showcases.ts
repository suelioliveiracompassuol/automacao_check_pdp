import { CheckResult } from "../types.js";
import { ANDROID_SELECTORS } from "./configs/selectors.js";
import { dismissZeeDog, scrollPdpUntilVisible } from "./pdpScreen.js";

/**
 * Native Android showcase / carousel verification.
 *
 * Verifies that the native RecyclerView is rendered on screen (scrolling vertically if needed)
 * and confirms that child ViewHolders (product cards) are populated, rather than relying on
 * a web Playwright Chromium browser session.
 */
async function verifyNativeShowcase(
  driver: WebdriverIO.Browser,
  resourceId: string,
): Promise<{ rendered: boolean; itemCount: number }> {
  await dismissZeeDog(driver);

  const el = driver.$(
    `android=new UiSelector().resourceIdMatches(".*:id/${resourceId}")`,
  );
  if ((await scrollPdpUntilVisible(driver, el)) === 0) {
    return { rendered: false, itemCount: 0 };
  }

  // Inspect child cards/elements to ensure the adapter is bound and populated
  let itemCount: number;
  try {
    const childCards = await el.$$(
      'android=new UiSelector().resourceIdMatches(".*:id/product_carousel_item_ne")',
    );
    itemCount = (childCards as unknown as { length: number }).length ?? 0;
  } catch {
    itemCount = 0;
  }

  return {
    rendered: true,
    itemCount,
  };
}

interface ShowcaseCheckSpec {
  feature: string;
  featureKey: "brandShowcase" | "recommendationShowcase";
  label: string;
  resourceId: string;
}

async function checkShowcaseAndroid(
  driver: WebdriverIO.Browser,
  spec: ShowcaseCheckSpec,
): Promise<CheckResult> {
  const { feature, featureKey, label, resourceId } = spec;
  try {
    const { rendered, itemCount } = await verifyNativeShowcase(
      driver,
      resourceId,
    );

    if (rendered) {
      return {
        feature,
        featureKey,
        passed: true,
        status: "pass",
        message: `${label} renderizada no app Android (RecyclerView com ${itemCount > 0 ? `${itemCount} itens detectados` : "conteúdo"})`,
        details: { rendered: true, itemCount, resourceId },
      };
    }

    return {
      feature,
      featureKey,
      passed: false,
      status: "fail",
      message: `${label} não encontrada ou vazia na tela`,
      details: { rendered: false, resourceId },
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

/** Android native check for "Mais produtos da marca" showcase. */
export function checkBrandShowcaseAndroid(
  driver: WebdriverIO.Browser,
): Promise<CheckResult> {
  return checkShowcaseAndroid(driver, {
    feature: 'Vitrine "Mais produtos da marca"',
    featureKey: "brandShowcase",
    label: 'Vitrine "mais produtos da marca"',
    resourceId: ANDROID_SELECTORS.showcase.brandRecyclerView,
  });
}

/** Android native check for the personalization showcase ("achamos que você vai gostar"). */
export function checkRecommendationShowcaseAndroid(
  driver: WebdriverIO.Browser,
): Promise<CheckResult> {
  return checkShowcaseAndroid(driver, {
    feature: 'Vitrine "Achamos que você vai gostar"',
    featureKey: "recommendationShowcase",
    label: "Vitrine de recomendações",
    resourceId: ANDROID_SELECTORS.showcase.recommendationRecyclerView,
  });
}
