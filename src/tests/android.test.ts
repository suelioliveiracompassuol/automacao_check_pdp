import { test, expect } from "@playwright/test";
import { resolveAndroidAppPackage } from "../deviceSetup.js";
import { getAndroidCredentialsFromEnv } from "../checks-android/login.js";
import {
  loadFirebaseAppsFromEnv,
  resolveNotifyMeFlag,
} from "../checks-android/remoteConfig.js";
import { ANDROID_SELECTORS } from "../checks-android/configs/selectors.js";
import { checkAddToCartAndroid } from "../checks-android/addToCart.js";
import {
  checkBrandShowcaseAndroid,
  checkRecommendationShowcaseAndroid,
} from "../checks-android/showcases.js";
import {
  distributeIntoChunks,
  parseAndroidConcurrency,
} from "../androidConcurrency.js";
import { findCommerceFlagsInNetworkLog } from "../checks-android/commerceFlags.js";
import { StepScreenshotRecorder } from "../checks-android/stepScreenshots.js";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";import type { SkuConfig } from "../types.js";

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

  test.describe("loadFirebaseAppsFromEnv", () => {
    test("loads single app from direct environment variables", () => {
      delete process.env.ANDROID_FIREBASE_APPS_JSON;
      process.env.PROJECT_ID = "app-natura-test";
      process.env.PROJECT_NUMBER = "123456789";
      process.env.API_KEY = "test-api-key";
      process.env.APP_ID = "1:123456789:android:test";
      process.env.PACKAGE_NAME = "net.natura.test";

      const apps = loadFirebaseAppsFromEnv();
      expect(apps["net.natura.test"]).toEqual({
        projectId: "app-natura-test",
        projectNumber: "123456789",
        apiKey: "test-api-key",
        appId: "1:123456789:android:test",
        packageName: "net.natura.test",
      });
    });

    test("reads the ANDROID_FIREBASE_* names the CI workflow passes", () => {
      delete process.env.ANDROID_FIREBASE_APPS_JSON;
      for (const name of [
        "PROJECT_ID",
        "PROJECT_NUMBER",
        "API_KEY",
        "APP_ID",
        "PACKAGE_NAME",
      ]) {
        delete process.env[name];
      }
      process.env.ANDROID_FIREBASE_PROJECT_ID = "app-natura-ci";
      process.env.ANDROID_FIREBASE_PROJECT_NUMBER = "111";
      process.env.ANDROID_FIREBASE_API_KEY = "ci-api-key";
      process.env.ANDROID_FIREBASE_APP_ID = "1:111:android:ci";
      process.env.ANDROID_FIREBASE_PACKAGE_NAME = "net.natura.ci";

      expect(loadFirebaseAppsFromEnv()["net.natura.ci"]?.projectId).toBe(
        "app-natura-ci",
      );
    });

    test("loads multi-app config from ANDROID_FIREBASE_APPS_JSON", () => {
      process.env.ANDROID_FIREBASE_APPS_JSON = JSON.stringify({
        "com.naturaeco.app.avon": {
          projectId: "app-avon-prod",
          projectNumber: "987654321",
          apiKey: "avon-api-key",
          appId: "1:987654321:android:avon",
          packageName: "com.naturaeco.app.avon",
        },
      });

      const apps = loadFirebaseAppsFromEnv();
      expect(apps["com.naturaeco.app.avon"]?.projectId).toBe("app-avon-prod");
    });

    test("handles malformed JSON gracefully", () => {
      process.env.ANDROID_FIREBASE_APPS_JSON = "{ invalid json ";
      const apps = loadFirebaseAppsFromEnv();
      expect(typeof apps).toBe("object");
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
      const result = await checkAddToCartAndroid(
        driverShowing(["cv_buy_button"]),
        undefined,
        Promise.resolve(true),
      );
      expect(result.status).toBe("pass");
      expect(result.details?.notifyMeFlag).toBe(true);
    });

    test('warns when "me avise" is shown but wl_notify_me is off', async () => {
      const result = await checkAddToCartAndroid(
        driverShowing(["btNotifyMe"]),
        undefined,
        Promise.resolve(false),
      );
      expect(result.passed).toBe(true);
      expect(result.status).toBe("warning");
    });

    test("passes when out of stock without button and wl_notify_me is off", async () => {
      const result = await checkAddToCartAndroid(
        driverShowing(["tv_warning_unavailable"]),
        undefined,
        Promise.resolve(false),
      );
      expect(result.passed).toBe(true);
      expect(result.status).toBe("pass");
      expect(result.details?.state).toBe("unavailable");
    });

    test("fails when out of stock without button but wl_notify_me is on", async () => {
      const result = await checkAddToCartAndroid(
        driverShowing(["tv_warning_unavailable"]),
        undefined,
        Promise.resolve(true),
      );
      expect(result.passed).toBe(false);
      expect(result.status).toBe("fail");
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

    test("scrolls the PDP NestedScrollView (main_view), not the first scrollable", async () => {
      const selectors: string[] = [];
      const mockDriver = {
        $: (selector: string) => {
          selectors.push(selector);
          return {
            waitForDisplayed: async () => true,
            isDisplayed: async () => true,
            getSize: async () => ({ width: 1080, height: 400 }),
            $$: async () => [],
            click: async () => undefined,
          };
        },
      } as unknown as WebdriverIO.Browser;

      await checkBrandShowcaseAndroid(mockDriver);
      const scroll = selectors.find((s) => s.includes("UiScrollable"));
      expect(scroll).toContain(".*:id/main_view");
      expect(scroll).not.toContain("scrollable(true)");
    });

    test("nudges the PDP down when scrollIntoView leaves only a sliver of the carousel visible", async () => {
      let visibleHeight = 10; // at the bottom edge, behind the sticky buy bar
      const gestures: unknown[] = [];
      const mockDriver = {
        $: () => ({
          elementId: "main-view-id",
          waitForDisplayed: async () => true,
          isDisplayed: async () => true,
          getSize: async () => ({ width: 1080, height: visibleHeight }),
          $$: async () => [{}, {}],
          click: async () => undefined,
        }),
        execute: async (script: string, args: unknown) => {
          gestures.push({ script, args });
          visibleHeight = 700;
          return true;
        },
      } as unknown as WebdriverIO.Browser;

      const result = await checkBrandShowcaseAndroid(mockDriver);
      expect(result.status).toBe("pass");
      expect(gestures).toEqual([
        {
          script: "mobile: scrollGesture",
          args: { elementId: "main-view-id", direction: "down", percent: 0.3 },
        },
      ]);
    });

    test("fails after the nudges when the carousel never shows up", async () => {
      let gestures = 0;
      const mockDriver = {
        $: () => ({
          elementId: "main-view-id",
          waitForDisplayed: async () => true,
          isDisplayed: async () => true,
          getSize: async () => ({ width: 1080, height: 10 }),
          click: async () => undefined,
        }),
        execute: async () => {
          gestures++;
          return true;
        },
      } as unknown as WebdriverIO.Browser;

      const result = await checkBrandShowcaseAndroid(mockDriver);
      expect(result.status).toBe("fail");
      expect(gestures).toBe(4);
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
