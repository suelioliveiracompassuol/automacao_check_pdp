import { test, expect } from "@playwright/test";
import { resolveAndroidAppPackage } from "../deviceSetup.js";
import { getAndroidCredentialsFromEnv } from "../checks-android/login.js";
import { loadFirebaseAppsFromEnv } from "../checks-android/remoteConfig.js";
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
    test("returns pass when target button is displayed and enabled", async () => {
      const mockElement = {
        waitForDisplayed: async () => true,
        isEnabled: async () => true,
        getText: async () => "Comprar",
      };
      const mockDriver = {
        $: () => mockElement,
      } as unknown as WebdriverIO.Browser;

      const result = await checkAddToCartAndroid(mockDriver);
      expect(result.passed).toBe(true);
      expect(result.status).toBe("pass");
      expect(result.details?.isEnabled).toBe(true);
      expect(result.details?.text).toBe("Comprar");
    });

    test("returns fail when target button is not displayed", async () => {
      const mockElement = {
        waitForDisplayed: async () => false,
      };
      const mockDriver = {
        $: () => mockElement,
      } as unknown as WebdriverIO.Browser;

      const result = await checkAddToCartAndroid(mockDriver);
      expect(result.passed).toBe(false);
      expect(result.status).toBe("fail");
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
});
