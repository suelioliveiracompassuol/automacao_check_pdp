import { CheckResult } from "../types.js";
import { ANDROID_SELECTORS } from "./configs/selectors.js";
import { dismissZeeDog } from "./pdpScreen.js";

export interface AddToCartCheckResult extends CheckResult {
  loadTime?: number;
}

/** What the PDP shows in the cart action area. */
type CartActionState = "buy" | "notifyMe" | "unavailable";
type ChainablePromiseElement = ReturnType<WebdriverIO.Browser["$"]>;

const FEATURE = "Botão Adicionar à Sacola";
const FEATURE_KEY = "addToCart";

async function isShown(el: ChainablePromiseElement): Promise<boolean> {
  return el.isDisplayed().catch(() => false);
}

function describeFlag(flag: boolean | undefined): string {
  return flag === undefined
    ? "wl_notify_me não capturada"
    : `wl_notify_me=${flag}`;
}

/** Verdict per screen state × `wl_notify_me` (undefined = Remote Config not captured). */
function evaluate(
  state: CartActionState,
  notifyMeEnabled: boolean | undefined,
): Pick<CheckResult, "passed" | "status" | "message"> {
  const flag = describeFlag(notifyMeEnabled);
  switch (state) {
    case "buy":
      return {
        passed: true,
        status: "pass",
        message: "Botão de compra encontrado na tela",
      };
    case "notifyMe":
      return notifyMeEnabled === false
        ? {
            passed: true,
            status: "warning",
            message: `Produto indisponível: botão "me avise" exibido, mas a flag está desligada (${flag})`,
          }
        : {
            passed: true,
            status: "pass",
            message: `Produto indisponível: botão "me avise" exibido (${flag})`,
          };
    case "unavailable":
      if (notifyMeEnabled === true) {
        return {
          passed: false,
          status: "fail",
          message: `Produto indisponível sem botão "me avise", mas a flag está ligada (${flag})`,
        };
      }
      return notifyMeEnabled === false
        ? {
            passed: true,
            status: "pass",
            message: `Produto indisponível: "me avise" oculto pela flag (${flag})`,
          }
        : {
            passed: true,
            status: "warning",
            message: `Produto indisponível sem botão "me avise" e ${flag} — não foi possível validar`,
          };
  }
}

/**
 * Android equivalent of checks/addToCart.ts. Mirrors the app's display rule
 * (ProductBaseInformationViewHolder / BuyBottomSheetNe in ncf-whitelabel-cf-android):
 * in stock → buy button; out of stock → "acabou, mas volta logo!" warning, plus the
 * "me avise" button only when the Remote Config flag `wl_notify_me` is on.
 * The quantity counter only appears after adding to the bag, so it isn't checked here.
 */
export async function checkAddToCartAndroid(
  driver: WebdriverIO.Browser,
  navStartTime?: number,
  notifyMeFlag: Promise<boolean | undefined> = Promise.resolve(undefined),
): Promise<AddToCartCheckResult> {
  try {
    const buyButton = driver.$(
      `android=${ANDROID_SELECTORS.addToCart.anyButton}`,
    );
    const notifyMeButton = driver.$(
      `android=${ANDROID_SELECTORS.addToCart.notifyMeButton}`,
    );
    const unavailableWarning = driver.$(
      `android=${ANDROID_SELECTORS.addToCart.unavailableWarning}`,
    );

    // PDP renders shimmer/skeleton placeholders first — wait for whichever state the app shows.
    // The ZeeDog card can pop up over the sticky buy bar meanwhile, so close it on every poll.
    let state: CartActionState | undefined;
    await driver
      .waitUntil(
        async () => {
          await dismissZeeDog(driver);
          if (await isShown(buyButton)) {
            state = "buy";
          } else if (await isShown(notifyMeButton)) {
            state = "notifyMe";
          } else if (await isShown(unavailableWarning)) {
            state = "unavailable";
          }
          return state !== undefined;
        },
        { timeout: 15000, interval: 500 },
      )
      .catch(() => {});

    // The warning slides in (enter_from_bottom) — give the notify-me button a moment to appear.
    if (state === "unavailable") {
      const appeared = await notifyMeButton
        .waitForDisplayed({ timeout: 2000 })
        .catch(() => false);
      if (appeared) {
        state = "notifyMe";
      }
    }

    let targetButton = state === "notifyMe" ? notifyMeButton : buyButton;
    if (!state) {
      // Fallback for builds where the resource-ids above aren't exposed
      targetButton = driver.$(
        `android=${ANDROID_SELECTORS.addToCart.textFallback}`,
      );
      if (
        await targetButton
          .waitForDisplayed({ timeout: 5000 })
          .catch(() => false)
      ) {
        const fallbackText = await targetButton.getText().catch(() => "");
        state = /avis/i.test(fallbackText) ? "notifyMe" : "buy";
      }
    }

    const loadTime =
      state && navStartTime ? Date.now() - navStartTime : undefined;
    const notifyMeEnabled = await notifyMeFlag.catch(() => undefined);

    if (!state) {
      return {
        feature: FEATURE,
        featureKey: FEATURE_KEY,
        passed: false,
        status: "fail",
        message:
          'Nenhum botão de compra, "me avise" ou aviso de indisponível encontrado na tela',
        loadTime,
        details: { notifyMeFlag: notifyMeEnabled ?? null },
      };
    }

    const hasButton = state !== "unavailable";
    const isEnabled = hasButton
      ? await targetButton.isEnabled().catch(() => true)
      : undefined;
    const text = hasButton
      ? (await targetButton.getText().catch(() => "")) || undefined
      : undefined;
    const verdict = evaluate(state, notifyMeEnabled);

    return {
      feature: FEATURE,
      featureKey: FEATURE_KEY,
      ...verdict,
      message: text ? `${verdict.message} — texto: "${text}"` : verdict.message,
      loadTime,
      details: {
        isDisplayed: hasButton,
        isEnabled,
        text,
        state,
        inStock: state === "buy",
        notifyMeFlag: notifyMeEnabled ?? null,
        loadTime,
      },
    };
  } catch (error) {
    return {
      feature: FEATURE,
      featureKey: FEATURE_KEY,
      passed: false,
      status: "error",
      message: `Erro ao verificar botão: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
