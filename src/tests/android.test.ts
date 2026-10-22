import { test, expect } from "@playwright/test";
import { resolveAndroidAppPackage } from "../deviceSetup.js";
import { getAndroidCredentialsFromEnv } from "../checks-android/login.js";
import {
  buildRemoteConfigFlags,
  resolveNotifyMeFlag,
} from "../checks-android/remoteConfig.js";
import { ANDROID_SELECTORS } from "../checks-android/configs/selectors.js";
import {
  applyNotifyMeFlag,
  checkAddToCartAndroid,
} from "../checks-android/addToCart.js";
import {
  checkBrandShowcaseAndroid,
  checkRecommendationShowcaseAndroid,
} from "../checks-android/showcases.js";
import {
  distributeIntoChunks,
  parseAndroidConcurrency,
} from "../androidConcurrency.js";
import {
  findCommerceFlagsInNetworkLog,
  findRemoteConfigEntriesInNetworkLog,
} from "../checks-android/appNetworkFlags.js";
import { StepScreenshotRecorder } from "../checks-android/stepScreenshots.js";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { SkuConfig } from "../types.js";

test.describe("Android Unit Tests", () => {
  const originalEnv = { ...process.env };

  test.afterEach(() => {
    process.env = { ...originalEnv };
  });

  test.describe("resolveAndroidAppPackage", () => {
    test("resolves package for Natura BR", () => {
      delete process.env.ANDROID_APP_PACKAGE;
      const sku: SkuConfig = {
        sku: "123",
        name: "Perfume",
        vendor: "natura",
        country: "BR",
      };
      expect(resolveAndroidAppPackage(sku)).toBe("net.natura.semprepresente");
    });

    test("resolves package for Avon", () => {
      delete process.env.ANDROID_APP_PACKAGE;
      const sku: SkuConfig = {
        sku: "456",
        name: "Batom",
        vendor: "avon",
        country: "BR",
      };
      expect(resolveAndroidAppPackage(sku)).toBe("com.naturaeco.app.avon");
    });

    test("resolves package for Natura LATAM", () => {
      delete process.env.ANDROID_APP_PACKAGE;
      const sku: SkuConfig = {
        sku: "789",
        name: "Crema",
        vendor: "natura",
        country: "AR",
      };
      expect(resolveAndroidAppPackage(sku)).toBe("com.naturaeco.app.natura");
    });

    test("prefers ANDROID_APP_PACKAGE override when provided", () => {
      process.env.ANDROID_APP_PACKAGE = "net.natura.semprepresente.dev";
      const sku: SkuConfig = {
        sku: "123",
        name: "Perfume",
        vendor: "natura",
        country: "BR",
      };
      expect(resolveAndroidAppPackage(sku)).toBe(
        "net.natura.semprepresente.dev",
      );
    });
  });

  test.describe("getAndroidCredentialsFromEnv", () => {
    test("returns null if email or password are missing", () => {
      delete process.env.ANDROID_LOGIN_EMAIL;
      delete process.env.ANDROID_LOGIN_PASSWORD;
      expect(getAndroidCredentialsFromEnv()).toBeNull();

      process.env.ANDROID_LOGIN_EMAIL = "test@example.com";
      delete process.env.ANDROID_LOGIN_PASSWORD;
      expect(getAndroidCredentialsFromEnv()).toBeNull();
    });

    test("returns credentials when both email and password are set", () => {
      process.env.ANDROID_LOGIN_EMAIL = "user@natura.net";
      process.env.ANDROID_LOGIN_PASSWORD = "secretPassword";
      const creds = getAndroidCredentialsFromEnv();
      expect(creds).toEqual({
        email: "user@natura.net",
        password: "secretPassword",
      });
    });
  });

  test.describe("ANDROID_SELECTORS", () => {
    test("defines locators for all required features", () => {
      expect(ANDROID_SELECTORS.addToCart.anyButton).toBeDefined();
      expect(ANDROID_SELECTORS.showcase.brandRecyclerView).toBe(
        "rvMoreBrandProducts",
      );
      expect(ANDROID_SELECTORS.showcase.recommendationRecyclerView).toBe(
        "rvEinsteinShowcase",
      );
      expect(ANDROID_SELECTORS.login.accountTab).toBeDefined();
      expect(ANDROID_SELECTORS.login.loginButton).toBeDefined();
    });
  });

  test.describe("checkAddToCartAndroid with mock driver", () => {
    /** Driver whose elements are visible only for selectors containing one of `visibleIds`. */
    const driverShowing = (visibleIds: string[], text = "") =>
      ({
        $: (selector: string) => {
          const visible = visibleIds.some((id) => selector.includes(id));
          return {
            isDisplayed: async () => visible,
            waitForDisplayed: async () => visible,
            isEnabled: async () => true,
            getText: async () => text,
          };
        },
        waitUntil: async (condition: () => Promise<boolean>) => {
          if (!(await condition())) {
            throw new Error("timeout");
          }
          return true;
        },
      }) as unknown as WebdriverIO.Browser;

    /** ZeeDog card open over the sticky buy bar: the buy button shows only after it's closed. */
    const driverWithZeeDogOverBuyBar = () => {
      const state = { zeeDogOpen: true };
      const isShown = (selector: string) =>
        selector.includes("fechar recados")
          ? state.zeeDogOpen
          : selector.includes("cv_buy_button") && !state.zeeDogOpen;
      const driver = {
        $: (selector: string) => ({
          isDisplayed: async () => isShown(selector),
          click: async () => {
            state.zeeDogOpen = false;
          },
          waitForDisplayed: async () => false,
          isEnabled: async () => true,
          getText: async () => "adicionar",
        }),
        // Polls up to 3 times, like the real waitUntil while the PDP loads
        waitUntil: async (condition: () => Promise<boolean>) => {
          const polls = [condition, condition, condition];
          for (const poll of polls) {
            if (await poll()) {
              return true;
            }
          }
          throw new Error("timeout");
        },
      } as unknown as WebdriverIO.Browser;
      return { driver, state };
    };

    test("closes the ZeeDog card covering the sticky buy bar while waiting for the button", async () => {
      const { driver, state } = driverWithZeeDogOverBuyBar();
      const result = await checkAddToCartAndroid(driver);
      expect(state.zeeDogOpen).toBe(false);
      expect(result.status).toBe("pass");
      expect(result.details?.state).toBe("buy");
    });

    test("returns pass when the buy button is displayed", async () => {
      const result = await checkAddToCartAndroid(
        driverShowing(["cv_buy_button"], "adicionar"),
      );
      expect(result.passed).toBe(true);
      expect(result.status).toBe("pass");
      expect(result.details?.state).toBe("buy");
      expect(result.details?.text).toBe("adicionar");
    });

    test('returns pass when the product is out of stock and "me avise" is displayed', async () => {
      const result = await checkAddToCartAndroid(
        driverShowing(["btNotifyMe"], "me avise"),
      );
      expect(result.passed).toBe(true);
      expect(result.status).toBe("pass");
      expect(result.details?.state).toBe("notifyMe");
      expect(result.details?.inStock).toBe(false);
      expect(result.message).toContain("me avise");
    });

    test("returns fail when neither buy nor notify-me is displayed", async () => {
      const result = await checkAddToCartAndroid(driverShowing([]));
      expect(result.passed).toBe(false);
      expect(result.status).toBe("fail");
    });

    test("records the wl_notify_me flag in the result details", async () => {
      const result = applyNotifyMeFlag(
        await checkAddToCartAndroid(driverShowing(["cv_buy_button"])),
        true,
      );
      expect(result.status).toBe("pass");
      expect(result.details?.notifyMeFlag).toBe(true);
    });

    test('warns when "me avise" is shown but wl_notify_me is off', async () => {
      const result = applyNotifyMeFlag(
        await checkAddToCartAndroid(driverShowing(["btNotifyMe"])),
        false,
      );
      expect(result.passed).toBe(true);
      expect(result.status).toBe("warning");
    });

    test("passes when out of stock without button and wl_notify_me is off", async () => {
      const result = applyNotifyMeFlag(
        await checkAddToCartAndroid(driverShowing(["tv_warning_unavailable"])),
        false,
      );
      expect(result.passed).toBe(true);
      expect(result.status).toBe("pass");
      expect(result.details?.state).toBe("unavailable");
    });

    test("fails when out of stock without button but wl_notify_me is on", async () => {
      const result = applyNotifyMeFlag(
        await checkAddToCartAndroid(driverShowing(["tv_warning_unavailable"])),
        true,
      );
      expect(result.passed).toBe(false);
      expect(result.status).toBe("fail");
    });

    test("keeps the button text in the message when the flag is applied later", async () => {
      const result = applyNotifyMeFlag(
        await checkAddToCartAndroid(
          driverShowing(["cv_buy_button"], "adicionar"),
        ),
        true,
      );
      expect(result.message).toBe(
        'Botão de compra encontrado na tela — texto: "adicionar"',
      );
    });

    test("leaves a failed check (no button state) as failed when the flag arrives", async () => {
      const result = applyNotifyMeFlag(
        await checkAddToCartAndroid(driverShowing([])),
        true,
      );
      expect(result.status).toBe("fail");
      expect(result.details?.notifyMeFlag).toBe(true);
    });

    test("warns when out of stock without button and the flag wasn't captured", async () => {
      const result = await checkAddToCartAndroid(
        driverShowing(["tv_warning_unavailable"]),
      );
      expect(result.passed).toBe(true);
      expect(result.status).toBe("warning");
    });
  });

  test.describe("resolveNotifyMeFlag", () => {
    const entries = {
      wl_notify_me: JSON.stringify({
        "pt-BR": true,
        "pt-BR-ML": false,
        "es-AR": false,
      }),
    };

    test("reads the locale value like the app", () => {
      expect(resolveNotifyMeFlag(entries, "pt-BR")).toBe(true);
      expect(resolveNotifyMeFlag(entries, "es-AR")).toBe(false);
    });

    test("uses pt-BR-ML for BR social commerce", () => {
      expect(resolveNotifyMeFlag(entries, "pt-BR", "socialcommerce")).toBe(
        false,
      );
    });

    test("has no pt-BR fallback for other locales and defaults to false", () => {
      expect(resolveNotifyMeFlag(entries, "es-MX")).toBe(false);
      expect(resolveNotifyMeFlag({}, "pt-BR")).toBe(false);
      expect(resolveNotifyMeFlag({ wl_notify_me: "true" }, "pt-BR")).toBe(
        false,
      );
    });

    test("buildRemoteConfigFlags resolves wl_notify_me for the SKU's locale and channel", () => {
      const flags = buildRemoteConfigFlags(entries, {
        country: "BR",
        channel: "socialcommerce",
      });
      expect(flags.locale).toBe("pt-BR");
      expect(flags.wl_notify_me).toBe(false);
      expect(flags._raw).toBe(entries);
    });
  });

  test.describe("Showcase checks with mock driver", () => {
    test("checkBrandShowcaseAndroid returns pass when RecyclerView has items", async () => {
      const mockChild = {};
      const mockElement = {
        waitForDisplayed: async () => true,
        isDisplayed: async () => true,
        getSize: async () => ({ width: 1080, height: 400 }),
        $$: async () => [mockChild, mockChild],
      };
      const mockDriver = {
        $: () => mockElement,
      } as unknown as WebdriverIO.Browser;

      const result = await checkBrandShowcaseAndroid(mockDriver);
      expect(result.passed).toBe(true);
      expect(result.status).toBe("pass");
      expect(result.details?.rendered).toBe(true);
      expect(result.details?.itemCount).toBe(2);
    });

    test("checkRecommendationShowcaseAndroid returns fail when RecyclerView is not displayed", async () => {
      const mockElement = {
        waitForDisplayed: async () => false,
        isDisplayed: async () => false,
      };
      const mockDriver = {
        $: () => mockElement,
      } as unknown as WebdriverIO.Browser;

      const result = await checkRecommendationShowcaseAndroid(mockDriver);
      expect(result.passed).toBe(false);
      expect(result.status).toBe("fail");
      expect(result.details?.rendered).toBe(false);
    });

    /**
     * 1080x2400 device whose carousel becomes visible after `visibleAfter` gestures. The page
     * source changes on each gesture until `endAfter` gestures in the same direction (end of page).
     */
    const scrollingDriver = (visibleAfter: number, endAfter = Infinity) => {
      const gestures: { direction: string; [k: string]: unknown }[] = [];
      const movedIn = (direction: string) =>
        gestures.filter((g) => g.direction === direction).length;
      const driver = {
        $: () => ({
          isDisplayed: async () => true,
          getSize: async () => ({
            width: 1080,
            height: gestures.length >= visibleAfter ? 700 : 10,
          }),
          $$: async () => [{}, {}],
          click: async () => undefined,
        }),
        getWindowSize: async () => ({ width: 1080, height: 2400 }),
        getPageSource: async () =>
          `down:${Math.min(movedIn("down"), endAfter)} up:${Math.min(movedIn("up"), endAfter)}`,
        execute: async (_script: string, args: { direction: string }) => {
          gestures.push(args);
          return false; // the real gesture result is unreliable, so it's ignored
        },
      } as unknown as WebdriverIO.Browser;
      return { driver, gestures };
    };

    test("scrolls half a screen at a time in the middle of the screen until the carousel is visible", async () => {
      // 3 gestures: covers a long description (the old scrollIntoView stopped short)
      const { driver, gestures } = scrollingDriver(3);
      const result = await checkBrandShowcaseAndroid(driver);
      expect(result.status).toBe("pass");
      // Away from the top edge (notification shade) and the bottom sticky buy bar
      expect(gestures).toEqual(
        Array(3).fill({
          left: 108,
          top: 600,
          width: 864,
          height: 1200,
          direction: "down",
          percent: 1,
        }),
      );
    });

    test("keeps scrolling even when the gesture reports it can't scroll more", async () => {
      const { driver, gestures } = scrollingDriver(5);
      const result = await checkBrandShowcaseAndroid(driver);
      expect(result.status).toBe("pass");
      expect(gestures.map((g) => g.direction)).toEqual(Array(5).fill("down"));
    });

    test("at the bottom of the page (screen unchanged) searches back up", async () => {
      // Page ends after 2 downs; the 3rd down changes nothing, then it goes up
      const { driver, gestures } = scrollingDriver(4, 2);
      const result = await checkBrandShowcaseAndroid(driver);
      expect(result.status).toBe("pass");
      expect(gestures.map((g) => g.direction)).toEqual([
        "down",
        "down",
        "down",
        "up",
      ]);
    });

    test("fails when the carousel never shows up after reaching both ends", async () => {
      const { driver, gestures } = scrollingDriver(Infinity, 1);
      const result = await checkBrandShowcaseAndroid(driver);
      expect(result.status).toBe("fail");
      expect(gestures.map((g) => g.direction)).toEqual([
        "down",
        "down",
        "up",
        "up",
      ]);
    });

    test("closes the ZeeDog card before scrolling when it is displayed", async () => {
      const calls: string[] = [];
      const mockDriver = {
        $: (selector: string) => ({
          waitForDisplayed: async () => true,
          isDisplayed: async () => true,
          getSize: async () => ({ width: 1080, height: 400 }),
          $$: async () => [],
          click: async () => {
            calls.push(selector);
          },
        }),
      } as unknown as WebdriverIO.Browser;

      await checkBrandShowcaseAndroid(mockDriver);
      expect(calls).toEqual([`android=${ANDROID_SELECTORS.pdp.zeeDogClose}`]);
    });
  });

  test.describe("StepScreenshotRecorder", () => {
    test("saves captures in order as screenshots/<SKU>/NN-<slug>.png", async () => {
      const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "steps-"));
      const png = Buffer.from("fake-png").toString("base64");
      const recorder = new StepScreenshotRecorder({
        takeScreenshot: async () => png,
      } as unknown as WebdriverIO.Browser);

      await recorder.capture("PDP aberta");
      await recorder.capture("Vitrine achamos que você vai gostar");
      const steps = recorder.save(outputDir, "NATBRA-1");

      expect(steps).toEqual([
        { label: "PDP aberta", path: "screenshots/NATBRA-1/01-pdp-aberta.png" },
        {
          label: "Vitrine achamos que você vai gostar",
          path: "screenshots/NATBRA-1/02-vitrine-achamos-que-voce-vai-gostar.png",
        },
      ]);
      expect(
        fs.readFileSync(path.join(outputDir, steps[0].path), "utf8"),
      ).toBe("fake-png");
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    test("sanitizes the SKU folder name with toSafeFileName", async () => {
      const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "steps-"));
      const recorder = new StepScreenshotRecorder({
        takeScreenshot: async () => "",
      } as unknown as WebdriverIO.Browser);
      await recorder.capture("PDP aberta");
      expect(recorder.save(outputDir, "NAT BRA/1")[0].path).toBe(
        "screenshots/NAT_BRA_1/01-pdp-aberta.png",
      );
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    test("a failed capture is skipped without throwing", async () => {
      const recorder = new StepScreenshotRecorder({
        takeScreenshot: async () => {
          throw new Error("session gone");
        },
      } as unknown as WebdriverIO.Browser);
      await recorder.capture("Erro");
      expect(recorder.save(os.tmpdir(), "NATBRA-1")).toEqual([]);
    });
  });

  test.describe("distributeIntoChunks", () => {
    test("distributes items round-robin across chunks", () => {
      expect(distributeIntoChunks([1, 2, 3, 4, 5], 2)).toEqual([
        [1, 3, 5],
        [2, 4],
      ]);
    });

    test("drops empty chunks when there are more chunks than items", () => {
      expect(distributeIntoChunks([1, 2], 5)).toEqual([[1], [2]]);
    });

    test("returns a single chunk with everything when numChunks is 1", () => {
      expect(distributeIntoChunks([1, 2, 3], 1)).toEqual([[1, 2, 3]]);
    });

    test("returns an empty array for an empty input", () => {
      expect(distributeIntoChunks([], 3)).toEqual([]);
    });
  });

  test.describe("parseAndroidConcurrency", () => {
    test("defaults to 2 when ANDROID_CONCURRENCY is unset", () => {
      delete process.env.ANDROID_CONCURRENCY;
      expect(parseAndroidConcurrency(10)).toBe(2);
    });

    test("floors at 1 for zero, negative or non-numeric values", () => {
      process.env.ANDROID_CONCURRENCY = "0";
      expect(parseAndroidConcurrency(10)).toBe(1);
      process.env.ANDROID_CONCURRENCY = "-3";
      expect(parseAndroidConcurrency(10)).toBe(1);
      process.env.ANDROID_CONCURRENCY = "not-a-number";
      expect(parseAndroidConcurrency(10)).toBe(2); // NaN falls back to the default (2), not the floor
    });

    test("caps at 5 even when ANDROID_CONCURRENCY requests more", () => {
      process.env.ANDROID_CONCURRENCY = "20";
      expect(parseAndroidConcurrency(10)).toBe(5);
    });

    test("never exceeds maxTasks", () => {
      process.env.ANDROID_CONCURRENCY = "5";
      expect(parseAndroidConcurrency(3)).toBe(3);
    });
  });

  test.describe("findCommerceFlagsInNetworkLog", () => {
    const flagsBody = JSON.stringify({
      productRecommendation: true,
      businessModel: "B2C",
    });
    const har = (entries: unknown[]) => ({ log: { entries } });
    const entry = (url: string, text?: string, encoding?: string) => ({
      request: { url },
      response: { status: 200, content: { text, encoding } },
    });

    test("parses the /feature-flag response captured from the app (HAR)", () => {
      const flags = findCommerceFlagsInNetworkLog(
        har([
          entry("https://api.example.com/product/1", "{}"),
          entry(
            "https://ncf-apigw.prd.naturacloud.com/bff-app-natura-brazil/feature-flag",
            flagsBody,
          ),
        ]),
      );
      expect(flags?.productRecommendation).toBe(true);
      expect(flags?.businessModel).toBe("B2C");
    });

    test("decodes base64 bodies and accepts payloads wrapped in data", () => {
      const flags = findCommerceFlagsInNetworkLog({
        data: [
          entry(
            "https://x/feature-flag",
            Buffer.from(flagsBody).toString("base64"),
            "base64",
          ),
        ],
      });
      expect(flags?.productRecommendation).toBe(true);
    });

    test("returns null when the app never called /feature-flag or the body is missing", () => {
      expect(
        findCommerceFlagsInNetworkLog(har([entry("https://x/cart", "{}")])),
      ).toBeNull();
      expect(
        findCommerceFlagsInNetworkLog(har([entry("https://x/feature-flag")])),
      ).toBeNull();
      expect(findCommerceFlagsInNetworkLog(null)).toBeNull();
    });

    test("reads the Remote Config entries from the app's own firebase:fetch response", () => {
      const rcUrl =
        "https://firebaseremoteconfig.googleapis.com/v1/projects/865562389217/namespaces/firebase:fetch";
      const entries = findRemoteConfigEntriesInNetworkLog(
        har([
          entry(rcUrl, JSON.stringify({ entries: { wl_notify_me: "{}" } })),
          // a later fetch answered with NO_CHANGE carries no entries and is skipped
          entry(rcUrl, JSON.stringify({ state: "NO_CHANGE" })),
        ]),
      );
      expect(entries).toEqual({ wl_notify_me: "{}" });
    });

    test("returns null Remote Config when the app didn't fetch it in the session", () => {
      expect(
        findRemoteConfigEntriesInNetworkLog(
          har([entry("https://x/feature-flag", flagsBody)]),
        ),
      ).toBeNull();
    });

    test("ignores Firebase Remote Config traffic", () => {
      expect(
        findCommerceFlagsInNetworkLog(
          har([
            entry(
              "https://firebaseremoteconfig.googleapis.com/feature-flags",
              flagsBody,
            ),
          ]),
        ),
      ).toBeNull();
    });
  });
});
