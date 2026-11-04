import { test, expect } from "@playwright/test";
import { resolveAndroidAppPackage } from "../deviceSetup.js";
import {
  androidCredentialEnvNames,
  getAndroidCredentialsFromEnv,
} from "../checks-android/login.js";
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
  createSkuQueue,
  distributeIntoChunks,
  parseAndroidConcurrency,
  planAndroidSessionGroups,
  planAndroidSessions,
} from "../androidConcurrency.js";
import {
  fetchDeviceFarmCapacity,
  freeSlots,
  parseSlotWaitMs,
  waitForDeviceFarmSlot,
} from "../deviceFarmCapacity.js";
import {
  deviceLocaleFor,
  findAndroidApp,
  isOperationSelected,
  parseAndroidOperations,
} from "../checks-android/configs/apps.js";
import {
  describePdpApiError,
  findCommerceFlagsInNetworkLog,
  extractPdpContentBanners,
  extractPdpImageUrls,
  findPdpApiContentBanners,
  PdpApiContentBanners,
  findPdpApiErrors,
  findPdpApiImages,
  hasPdpApiCall,
  PdpApiImages,
  findRemoteConfigEntriesInNetworkLog,
} from "../checks-android/appNetworkFlags.js";
import { StepScreenshotRecorder } from "../checks-android/stepScreenshots.js";
import {
  summarizeShowcases,
  waitForPdpLoaded,
} from "../checks-android/pdpScreen.js";
import {
  applyPdpApiImages,
  checkImagesAndroid,
  parseImageCounter,
} from "../checks-android/images.js";
import {
  applyPdpApiContentBanners,
  checkContentBannersAndroid,
} from "../checks-android/contentBanners.js";
import { contentRatio, decodePng } from "../checks-android/pngImage.js";
import {
  applyAppReviewsApi,
  evaluateReviewsScreen,
  parseUiNodes,
  ReviewsScreen,
} from "../checks-android/reviews.js";
import {
  AppReviewsApi,
  findAppReviewsApi,
} from "../checks-android/appNetworkFlags.js";
import * as zlib from "node:zlib";
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
    const naturaBR = { vendor: "natura", country: "BR" } as const;
    const naturaAR = { vendor: "natura", country: "AR" } as const;

    test("returns null if email or password are missing", () => {
      delete process.env.ANDROID_LOGIN_EMAIL;
      delete process.env.ANDROID_LOGIN_PASSWORD;
      expect(getAndroidCredentialsFromEnv(naturaBR)).toBeNull();

      process.env.ANDROID_LOGIN_EMAIL = "test@example.com";
      delete process.env.ANDROID_LOGIN_PASSWORD;
      expect(getAndroidCredentialsFromEnv(naturaBR)).toBeNull();
    });

    test("Natura BR keeps ANDROID_LOGIN_EMAIL/ANDROID_LOGIN_PASSWORD", () => {
      process.env.ANDROID_LOGIN_EMAIL = "user@natura.net";
      process.env.ANDROID_LOGIN_PASSWORD = "secretPassword";
      expect(getAndroidCredentialsFromEnv(naturaBR)).toEqual({
        email: "user@natura.net",
        password: "secretPassword",
      });
    });

    test("other operations use their own variables and never the BR account", () => {
      process.env.ANDROID_LOGIN_EMAIL = "br@natura.net";
      process.env.ANDROID_LOGIN_PASSWORD = "br";
      delete process.env.ANDROID_LOGIN_EMAIL_NATURA_AR;
      delete process.env.ANDROID_LOGIN_PASSWORD_NATURA_AR;
      expect(getAndroidCredentialsFromEnv(naturaAR)).toBeNull();

      process.env.ANDROID_LOGIN_EMAIL_NATURA_AR = "ar@natura.net";
      process.env.ANDROID_LOGIN_PASSWORD_NATURA_AR = "ar";
      expect(getAndroidCredentialsFromEnv(naturaAR)).toEqual({
        email: "ar@natura.net",
        password: "ar",
      });
      expect(
        androidCredentialEnvNames({ vendor: "avon", country: "BR" }),
      ).toEqual({
        email: "ANDROID_LOGIN_EMAIL_AVON_BR",
        password: "ANDROID_LOGIN_PASSWORD_AVON_BR",
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

    /** Avon case: the scroll gesture never moves the page, a touch swipe does. */
    const swipeOnlyDriver = (visibleAfterSwipes: number) => {
      const swipes: { from: number; to: number }[] = [];
      const points: number[] = [];
      const chain = {
        move: (p: { y: number }) => {
          points.push(p.y);
          return chain;
        },
        down: () => chain,
        pause: () => chain,
        up: () => chain,
        perform: async () => {
          swipes.push({ from: points[0], to: points[1] });
          points.length = 0;
        },
      };
      const driver = {
        $: () => ({
          isDisplayed: async () => true,
          getSize: async () => ({
            width: 1080,
            height: swipes.length >= visibleAfterSwipes ? 700 : 10,
          }),
          $$: async () => [{}],
          click: async () => undefined,
        }),
        getWindowSize: async () => ({ width: 1080, height: 2400 }),
        getPageSource: async () => `swipes:${swipes.length}`,
        execute: async () => true,
        action: () => chain,
      } as unknown as WebdriverIO.Browser;
      return { driver, swipes };
    };

    test("falls back to a touch swipe when the scroll gesture doesn't move the page", async () => {
      const { driver, swipes } = swipeOnlyDriver(2);
      const result = await checkBrandShowcaseAndroid(driver);
      expect(result.status).toBe("pass");
      // Swipes up from 75% to 25% of the screen (scrolling the page down)
      expect(swipes).toEqual([
        { from: 1800, to: 600 },
        { from: 1800, to: 600 },
      ]);
    });

    // UiAutomator page source of a PDP where the brand slot came as the Einstein variant
    const einsteinBrandSource = [
      '<android.widget.TextView resource-id="com.naturaeco.app.avon:id/tvProductName" text="Batom" />',
      '<android.widget.TextView resource-id="com.naturaeco.app.avon:id/tvEinsteinShowcaseTitle" text="mais produtos da marca" />',
      '<androidx.recyclerview.widget.RecyclerView resource-id="com.naturaeco.app.avon:id/rvEinsteinShowcase" />',
    ].join("\n");

    test("summarizeShowcases lists showcase ids and titles from the page source", () => {
      expect(summarizeShowcases(einsteinBrandSource)).toEqual({
        resourceIds: ["rvEinsteinShowcase", "tvEinsteinShowcaseTitle"],
        showcaseTitles: ["mais produtos da marca"],
      });
      expect(summarizeShowcases("")).toEqual({
        resourceIds: [],
        showcaseTitles: [],
      });
    });

    test("a missing showcase reports what the page had instead", async () => {
      const driver = {
        $: () => ({ isDisplayed: async () => false }),
        getWindowSize: async () => ({ width: 1080, height: 2400 }),
        getPageSource: async () => einsteinBrandSource,
        execute: async () => true,
      } as unknown as WebdriverIO.Browser;
      const result = await checkBrandShowcaseAndroid(driver);
      expect(result.status).toBe("fail");
      expect(result.details?.pageSummary).toEqual({
        resourceIds: ["rvEinsteinShowcase", "tvEinsteinShowcaseTitle"],
        showcaseTitles: ["mais produtos da marca"],
      });
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

  /**
   * Builds a width×height RGBA PNG (CRCs zeroed — the decoder doesn't check them), cycling
   * through all five row filters so the decoder's unfiltering is exercised. `pixel` gives each
   * pixel's [r, g, b].
   */
  const makePng = (
    width: number,
    height: number,
    pixel: (x: number, y: number) => number[],
  ): Buffer => {
    const chunk = (type: string, data: Buffer) => {
      const len = Buffer.alloc(4);
      len.writeUInt32BE(data.length);
      return Buffer.concat([len, Buffer.from(type, "ascii"), data, Buffer.alloc(4)]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr.set([8, 6, 0, 0, 0], 8);
    const stride = width * 4;
    const pixels = Buffer.alloc(stride * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        pixels.set([...pixel(x, y), 255], y * stride + x * 4);
      }
    }
    const paeth = (a: number, b: number, c: number) => {
      const p = a + b - c;
      const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
      return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
    };
    const raw = Buffer.alloc((stride + 1) * height);
    for (let y = 0; y < height; y++) {
      const filter = y % 5;
      raw[y * (stride + 1)] = filter;
      for (let x = 0; x < stride; x++) {
        const at = (yy: number, xx: number) =>
          yy >= 0 && xx >= 0 ? pixels[yy * stride + xx] : 0;
        const [a, b, c] = [at(y, x - 4), at(y - 1, x), at(y - 1, x - 4)];
        const predictor = [0, a, b, (a + b) >> 1, paeth(a, b, c)][filter];
        raw[y * (stride + 1) + 1 + x] = (at(y, x) - predictor) & 0xff;
      }
    }
    return Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", ihdr),
      chunk("IDAT", zlib.deflateSync(raw)),
      chunk("IEND", Buffer.alloc(0)),
    ]);
  };
  const WHITE = [250, 250, 250];
  const blankPng = makePng(100, 120, () => WHITE);
  /** Product photo on a white background: a colored shape in the middle. */
  const photoPng = makePng(100, 120, (x, y) =>
    x > 30 && x < 70 && y > 30 && y < 90 ? [180, 90, 60] : WHITE,
  );

  test.describe("decodePng / contentRatio", () => {
    test("decodes the pixels of every row filter", () => {
      const img = decodePng(
        makePng(7, 10, (x, y) => [x * 30, y * 20, (x * y) % 256]),
      );
      expect([img.width, img.height, img.channels]).toEqual([7, 10, 4]);
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 7; x++) {
          const i = (y * 7 + x) * 4;
          expect([...img.data.subarray(i, i + 3)]).toEqual([
            x * 30,
            y * 20,
            (x * y) % 256,
          ]);
        }
      }
    });

    test("a flat image has no content; a photo on white does", () => {
      expect(contentRatio(decodePng(blankPng))).toBe(0);
      expect(contentRatio(decodePng(photoPng))).toBeGreaterThan(0.1);
    });

    test("only the crop is analyzed", () => {
      // Arrow drawn on the left edge of an otherwise blank page
      const arrowPng = makePng(100, 120, (x) => (x < 10 ? [0, 0, 0] : WHITE));
      const middle = { left: 0.2, top: 0.1, width: 0.6, height: 0.7 };
      expect(contentRatio(decodePng(arrowPng))).toBeGreaterThan(0);
      expect(contentRatio(decodePng(arrowPng), middle)).toBe(0);
    });

    test("rejects what isn't a PNG", () => {
      expect(() => decodePng(Buffer.from("fake-png"))).toThrow("não é um PNG");
    });
  });

  test.describe("checkImagesAndroid with mock driver", () => {
    test("parseImageCounter reads the app's 'N / total' counter", () => {
      expect(parseImageCounter("2 / 7")).toEqual({ page: 2, total: 7 });
      expect(parseImageCounter("3/4")).toEqual({ page: 3, total: 4 });
      expect(parseImageCounter("")).toBeNull();
      expect(parseImageCounter(undefined)).toBeNull();
    });

    /**
     * Carousel with one screenshot per image. The counter is shown when there's more than one
     * image and follows the taps; `tapWorks: false` keeps the pager stuck.
     */
    const carouselDriver = (
      pages: Buffer[],
      { carouselHeight = 1300, tapWorks = true } = {},
    ) => {
      let current = 0;
      const taps: { x: number; y: number }[] = [];
      const carousel = {
        elementId: "carousel",
        isDisplayed: async () => carouselHeight > 0,
        getSize: async () => ({ width: 1080, height: carouselHeight }),
        getLocation: async () => ({ x: 0, y: 200 }),
      };
      const counter = {
        isDisplayed: async () => pages.length > 1,
        getText: async () => `${current + 1} / ${pages.length}`,
      };
      const action = {
        move: (point: { x: number; y: number }) => {
          taps.push(point);
          return action;
        },
        down: () => action,
        pause: () => action,
        up: () => action,
        perform: async () => {
          if (tapWorks) {
            current = Math.min(current + 1, pages.length - 1);
          }
        },
      };
      const driver = {
        $: (selector: string) =>
          selector.includes("cvProductImages")
            ? carousel
            : selector.includes("tvImageCounter")
              ? counter
              : { isDisplayed: async () => false },
        takeElementScreenshot: async (id: string) => {
          expect(id).toBe("carousel");
          return pages[current].toString("base64");
        },
        action: () => action,
      } as unknown as WebdriverIO.Browser;
      return { driver, taps };
    };
    const fast = { imageLoadTimeoutMs: 0 };

    test("passes when every image of the gallery renders", async () => {
      const { driver, taps } = carouselDriver([photoPng, photoPng, photoPng]);
      const result = await checkImagesAndroid(driver, fast);
      expect(result.status).toBe("pass");
      expect(result.message).toBe(
        "3 imagem(ns) carregada(s) corretamente (carrossel presente)",
      );
      expect(result.details).toMatchObject({ imageCount: 3, loadedCount: 3 });
      // Taps the app's "next image" area (right 20% of the carousel), never a swipe that
      // starts on it — the area is drawn over the pager and swallows the drag
      expect(taps).toEqual(Array(2).fill({ x: 972, y: 850 }));
    });

    test("a single image (no counter) is checked without changing page", async () => {
      const { driver, taps } = carouselDriver([photoPng]);
      const result = await checkImagesAndroid(driver, fast);
      expect(result.status).toBe("pass");
      expect(result.details).toMatchObject({ imageCount: 1, loadedCount: 1 });
      expect(taps).toHaveLength(0);
    });

    test("fails pointing at the blank images", async () => {
      const { driver } = carouselDriver([photoPng, blankPng, photoPng, blankPng]);
      const result = await checkImagesAndroid(driver, fast);
      expect(result.status).toBe("fail");
      expect(result.message).toBe("2 ok, 2 imagem(ns) em branco (posição 2, 4)");
      expect(result.details?.blankPositions).toEqual([2, 4]);
    });

    test("fails when no image loads", async () => {
      const { driver } = carouselDriver([blankPng, blankPng]);
      const result = await checkImagesAndroid(driver, fast);
      expect(result.status).toBe("fail");
      expect(result.message).toBe(
        "Imagens encontradas (2) mas nenhuma carregou (em branco na tela)",
      );
    });

    test("warns when the carousel doesn't move to the next image", async () => {
      const { driver, taps } = carouselDriver([photoPng, photoPng, photoPng], {
        tapWorks: false,
      });
      const result = await checkImagesAndroid(driver, fast);
      expect(result.status).toBe("warning");
      expect(result.message).toContain("carrossel não avançou para a imagem 2");
      expect(result.details).toMatchObject({ loadedCount: 1, pageStuckAt: 2 });
      expect(taps).toHaveLength(2); // one retry
    });

    test("caps a long gallery without warning", async () => {
      const { driver } = carouselDriver(Array(12).fill(photoPng));
      const result = await checkImagesAndroid(driver, fast);
      expect(result.status).toBe("pass");
      expect(result.message).toBe(
        "10 imagem(ns) carregada(s) corretamente (carrossel presente) — 10 de 12 verificadas",
      );
    });

    test("fails when the carousel isn't on screen", async () => {
      const { driver } = carouselDriver([photoPng], { carouselHeight: 0 });
      // The carousel wait polls for 10s: move the clock forward to keep the test short
      const realNow = Date.now;
      let fakeNow = realNow();
      Date.now = () => (fakeNow += 5_000);
      try {
        const result = await checkImagesAndroid(driver, fast);
        expect(result.status).toBe("fail");
        expect(result.message).toBe(
          "Carrossel de imagens do produto não encontrado na tela",
        );
      } finally {
        Date.now = realNow;
      }
    });
  });

  test.describe("PDP API images", () => {
    const IMG = "https://production.na01.natura.com/on/demandware.static/-/Sites-natura-br-storefront-catalog/default/dw1/";
    const pdpBody = (body: unknown) => ({
      request: { url: "https://bff-app-natura-brazil.example.com/pages/v2/product/NATBRA-1" },
      response: { status: 200, content: { text: JSON.stringify(body) } },
    });
    const download = (url: string, status = 200) => ({
      request: { url },
      response: { status, content: {} },
    });

    test("extractPdpImageUrls picks the SKU's own variant bannerCollection", () => {
      expect(
        extractPdpImageUrls(
          {
            variations: [
              { productId: "NATBRA-2", bannerCollection: [`${IMG}b.jpg`] },
              { productId: "NATBRA-1", bannerCollection: [`${IMG}a1.jpg`, `${IMG}a2.jpg`, ""] },
            ],
            images: { large: [{ absURL: `${IMG}ignored.jpg` }] },
          },
          "NATBRA-1",
        ),
      ).toEqual({ source: "variations", urls: [`${IMG}a1.jpg`, `${IMG}a2.jpg`] });
    });

    test("extractPdpImageUrls falls back to the first variant, then to images.large/medium", () => {
      expect(
        extractPdpImageUrls(
          { variations: [{ productId: "X", bannerCollection: [`${IMG}x.jpg`] }] },
          "NATBRA-1",
        ).urls,
      ).toEqual([`${IMG}x.jpg`]);
      expect(
        extractPdpImageUrls(
          { variations: [], images: { large: [{ absURL: `${IMG}l.jpg` }], medium: [{ absURL: `${IMG}m.jpg` }] } },
          "NATBRA-1",
        ),
      ).toEqual({ source: "images", urls: [`${IMG}l.jpg`] });
      expect(
        extractPdpImageUrls({ data: { images: { medium: [{ absURL: `${IMG}m.jpg` }] } } }, "NATBRA-1").urls,
      ).toEqual([`${IMG}m.jpg`]);
    });

    test("findPdpApiImages crosses the API images with the app's downloads", () => {
      const images = findPdpApiImages(
        {
          log: {
            entries: [
              pdpBody({
                variations: [
                  {
                    productId: "NATBRA-1",
                    bannerCollection: [`${IMG}1.jpg`, `${IMG}2.jpg?sw=800`, `${IMG}3.jpg`],
                  },
                ],
              }),
              download(`${IMG}1.jpg`),
              download(`${IMG}2.jpg`), // matched without the query string
              download(`${IMG}3.jpg`, 404),
            ],
          },
        },
        ["NATBRA-1", "NATBRA-9"],
      );
      expect(images).toEqual({
        "NATBRA-1": {
          source: "variations",
          urls: [`${IMG}1.jpg`, `${IMG}2.jpg?sw=800`, `${IMG}3.jpg`],
          failed: [{ url: `${IMG}3.jpg`, status: 404 }],
          downloadedCount: 2,
        },
      });
    });

    const screenResult = (imageCount: number) => ({
      feature: "Imagens do produto",
      featureKey: "images" as const,
      passed: true,
      status: "pass" as const,
      message: `${imageCount} imagem(ns) carregada(s) corretamente (carrossel presente)`,
      details: { hasCarousel: true, imageCount, loadedCount: imageCount },
    });
    const api = (urls: number, extra: Partial<PdpApiImages> = {}): PdpApiImages => ({
      source: "variations",
      urls: Array.from({ length: urls }, (_, i) => `${IMG}${i}.jpg`),
      failed: [],
      downloadedCount: urls,
      ...extra,
    });

    test("applyPdpApiImages adds the API count to a passing screen result", () => {
      const result = applyPdpApiImages(screenResult(3), api(3));
      expect(result.status).toBe("pass");
      expect(result.message).toBe(
        "3 imagem(ns) carregada(s) corretamente (carrossel presente) · API: 3 imagem(ns), 3 baixada(s) pelo app",
      );
      expect(result.details?.api).toEqual({ source: "variations", imageCount: 3, downloadedCount: 3 });
    });

    test("applyPdpApiImages fails when the API sent no images or a download failed", () => {
      expect(applyPdpApiImages(screenResult(1), api(0))).toMatchObject({
        status: "fail",
        passed: false,
        message: expect.stringMatching(/^API da PDP não retornou imagens do produto/),
      });
      const failed = applyPdpApiImages(
        screenResult(3),
        api(3, { failed: [{ url: `${IMG}2.jpg?sw=800`, status: 404 }], downloadedCount: 2 }),
      );
      expect(failed.status).toBe("fail");
      expect(failed.message).toMatch(/^1 de 3 imagem\(ns\) da API com erro no download \(HTTP 404 2\.jpg\)/);
    });

    test("applyPdpApiImages warns when the screen shows fewer images than the API", () => {
      const result = applyPdpApiImages(screenResult(2), api(4));
      expect(result.status).toBe("warning");
      expect(result.message).toContain("tela mostra 2 de 4 imagens da API");
    });

    test("hasPdpApiCall tells a complete session log from one still being processed", () => {
      const log = { log: { entries: [pdpBody({ variations: [] })] } };
      expect(hasPdpApiCall(log, "NATBRA-1")).toBe(true);
      expect(hasPdpApiCall(log, "NATBRA-2")).toBe(false);
      expect(hasPdpApiCall([], "NATBRA-1")).toBe(false);
    });

    test("applyPdpApiImages leaves other features and missing captures alone", () => {
      const other = { ...screenResult(1), featureKey: "addToCart" as const };
      expect(applyPdpApiImages(other, api(0))).toBe(other);
      const screen = screenResult(1);
      expect(applyPdpApiImages(screen, undefined)).toBe(screen);
    });
  });

  test.describe("checkContentBannersAndroid with mock driver", () => {
    type Banner = { id: string; kind: "banner" | "widepic"; height?: number; png?: Buffer };
    /**
     * PDP whose screens (top to bottom) show the given banners; each scroll moves to the next
     * screen and the page source stops changing at the last one.
     */
    const bannersDriver = (screens: Banner[][]) => {
      let current = 0;
      const shots: string[] = [];
      const scroll = () => {
        current = Math.min(current + 1, screens.length - 1);
      };
      const action = {
        move: () => action,
        down: () => action,
        pause: () => action,
        up: () => action,
        perform: async () => scroll(),
      };
      const driver = {
        $: () => ({ isDisplayed: async () => false }),
        $$: async (selector: string) =>
          screens[current]
            .filter((b) =>
              selector.includes(b.kind === "banner" ? "bannerImage" : "ivWidepicImage"),
            )
            .map((b) => ({
              elementId: b.id,
              isDisplayed: async () => true,
              getSize: async () => ({ width: 1000, height: b.height ?? 900 }),
            })),
        takeElementScreenshot: async (id: string) => {
          shots.push(id);
          const banner = screens[current].find((b) => b.id === id);
          return (banner?.png ?? photoPng).toString("base64");
        },
        getWindowSize: async () => ({ width: 1080, height: 2400 }),
        getPageSource: async () => `screen:${current}`,
        execute: async () => scroll(),
        action: () => action,
      } as unknown as WebdriverIO.Browser;
      return { driver, shots };
    };
    const fast = { imageLoadTimeoutMs: 0 };

    test("passes when every banner on the page renders, judging each one once", async () => {
      const { driver, shots } = bannersDriver([
        [],
        [{ id: "b1", kind: "banner" }],
        [{ id: "b1", kind: "banner" }, { id: "w1", kind: "widepic" }],
        [],
      ]);
      const result = await checkContentBannersAndroid(driver, fast);
      expect(result.status).toBe("pass");
      expect(result.message).toBe("2 banner(s) de conteúdo carregado(s) na tela");
      expect(result.details).toMatchObject({
        bannersOnScreen: 2,
        kinds: ["banner", "widepic"],
        loadedCount: 2,
        scrolls: 3,
      });
      expect(shots).toEqual(["b1", "w1"]);
    });

    test("is N/A when the PDP has no banners", async () => {
      const { driver } = bannersDriver([[], []]);
      const result = await checkContentBannersAndroid(driver, fast);
      expect(result).toMatchObject({ status: "na", passed: true });
    });

    test("fails on a blank banner", async () => {
      const { driver } = bannersDriver([
        [{ id: "b1", kind: "banner" }, { id: "w1", kind: "widepic", png: blankPng }],
      ]);
      const result = await checkContentBannersAndroid(driver, fast);
      expect(result.status).toBe("fail");
      expect(result.message).toBe("1 ok, 1 banner(s) em branco na tela");
    });

    test("a banner blank on one screen and loaded on the next did load", async () => {
      const { driver } = bannersDriver([
        [{ id: "b1", kind: "banner", png: blankPng }],
        [{ id: "b1", kind: "banner" }],
      ]);
      const result = await checkContentBannersAndroid(driver, fast);
      expect(result.status).toBe("pass");
      expect(result.details).toMatchObject({ loadedCount: 1, blankCount: 0 });
    });

    test("a banner only peeking in at the screen edge isn't judged", async () => {
      const { driver, shots } = bannersDriver([[{ id: "b1", kind: "banner", height: 50 }]]);
      const result = await checkContentBannersAndroid(driver, fast);
      expect(result.status).toBe("warning");
      expect(result.message).toContain("apareceu só parcialmente");
      expect(shots).toHaveLength(0);
    });
  });

  test.describe("PDP API content banners", () => {
    const IMG = "https://production.na01.natura.com/on/demandware.static/-/Sites-natura-br-storefront-catalog/default/dw1/";
    const media = (type: string, files: string[]) => ({
      entity: "neProductPageMediaContent",
      neProductPageMediaContent: {
        type,
        title: "título",
        mediaItems: files.map((f) => ({ image: { mobile: { url: `${IMG}${f}` }, desktop: { url: `${IMG}d-${f}` } } })),
      },
    });

    test("extractPdpContentBanners reads the neProductPageMediaContent components", () => {
      expect(
        extractPdpContentBanners({
          productComponents: [
            { entity: "neProductPageAccordion", neProductPageAccordion: [] },
            media("type1", ["a.jpg"]),
            media("type2", ["b.jpg", "c.jpg"]),
          ],
        }),
      ).toEqual([
        { type: "type1", urls: [`${IMG}a.jpg`] },
        { type: "type2", urls: [`${IMG}b.jpg`, `${IMG}c.jpg`] },
      ]);
      expect(extractPdpContentBanners({ data: { productComponents: [media("type1", [])] } })).toEqual([
        { type: "type1", urls: [] },
      ]);
      expect(extractPdpContentBanners({ name: "sem componentes" })).toEqual([]);
    });

    test("findPdpApiContentBanners crosses the banner images with the app's downloads", () => {
      const banners = findPdpApiContentBanners(
        {
          log: {
            entries: [
              {
                request: { url: "https://bff-app-natura-brazil.example.com/pages/v2/product/NATBRA-1" },
                response: {
                  status: 200,
                  content: { text: JSON.stringify({ productComponents: [media("type2", ["b.jpg", "c.jpg", "d.jpg"])] }) },
                },
              },
              { request: { url: `${IMG}b.jpg?sw=1200&q=80` }, response: { status: 200 } },
              { request: { url: `${IMG}c.jpg?sw=1200&q=80` }, response: { status: 500 } },
            ],
          },
        },
        ["NATBRA-1", "NATBRA-9"],
      );
      expect(banners).toEqual({
        "NATBRA-1": {
          components: [{ type: "type2", urls: [`${IMG}b.jpg`, `${IMG}c.jpg`, `${IMG}d.jpg`] }],
          urls: [`${IMG}b.jpg`, `${IMG}c.jpg`, `${IMG}d.jpg`],
          failed: [{ url: `${IMG}c.jpg`, status: 500 }],
          downloadedCount: 1,
        },
      });
    });

    const screen = (status: "pass" | "na") => ({
      feature: "Banners de conteúdo do produto",
      featureKey: "contentBanners" as const,
      passed: true,
      status,
      message: status === "pass" ? "1 banner(s) de conteúdo carregado(s) na tela" : "Produto sem banners",
      details: {},
    });
    const api = (extra: Partial<PdpApiContentBanners> = {}): PdpApiContentBanners => ({
      components: [{ type: "type1", urls: [`${IMG}a.jpg`] }],
      urls: [`${IMG}a.jpg`],
      failed: [],
      downloadedCount: 1,
      ...extra,
    });

    test("applyPdpApiContentBanners adds the API counts to a passing screen result", () => {
      const result = applyPdpApiContentBanners(screen("pass"), api());
      expect(result.status).toBe("pass");
      expect(result.message).toBe(
        "1 banner(s) de conteúdo carregado(s) na tela · API: 1 banner(s), 1 imagem(ns), 1 baixada(s) pelo app",
      );
    });

    test("applyPdpApiContentBanners fails when the API sent banners the screen didn't show", () => {
      expect(applyPdpApiContentBanners(screen("na"), api())).toMatchObject({
        status: "fail",
        passed: false,
        message: "API da PDP enviou 1 banner(s) de conteúdo, mas nenhum apareceu na tela",
      });
    });

    test("applyPdpApiContentBanners fails when a banner download failed", () => {
      const result = applyPdpApiContentBanners(
        screen("pass"),
        api({ failed: [{ url: `${IMG}a.jpg`, status: 404 }], downloadedCount: 0 }),
      );
      expect(result.status).toBe("fail");
      expect(result.message).toMatch(/^1 de 1 imagem\(ns\) de banner com erro no download \(HTTP 404 a\.jpg\)/);
    });

    test("applyPdpApiContentBanners keeps N/A when the API has no banners, and leaves other features alone", () => {
      expect(applyPdpApiContentBanners(screen("na"), api({ components: [], urls: [], downloadedCount: 0 }))).toMatchObject({
        status: "na",
        message: "Produto sem banners · API: sem banners",
      });
      const other = { ...screen("pass"), featureKey: "images" as const };
      expect(applyPdpApiContentBanners(other, api())).toBe(other);
      const s = screen("pass");
      expect(applyPdpApiContentBanners(s, undefined)).toBe(s);
    });
  });

  test.describe("Reviews (Avaliações & Nota)", () => {
    const node = (id: string, text = "", desc = "") => ({ id, text, desc });
    /** PDP with 19 reviews, rating 4.5, filter, sort and one review with photos. */
    const fullScreen = (over: Partial<ReviewsScreen> = {}): ReviewsScreen => ({
      sectionFound: true,
      headerFound: true,
      header: [
        node("tv_rt_value", "4,5"),
        node("tv_see_rating", "(19) avaliações"),
        node("tv_tag_text", "novo"),
      ],
      section: [
        node("titleReviewGeneral", "avaliações"),
        node("ratingTextView", "4.5"),
        node("tvTotalNumberReview", "19 avaliações"),
        node("tvSortBy", "mais úteis"),
        node("btFilterBy", "filtrar"),
        node("main_container", "", "avaliação 1 de 19"),
        node("imageReview"),
      ],
      photosOnScreen: 2,
      ...over,
    });
    type Result = ReturnType<typeof evaluateReviewsScreen>[number];
    const byKey = (results: Result[]): Record<string, Result> =>
      Object.fromEntries(results.map((r) => [r.featureKey, r]));
    const emptyScreen = (over: Partial<ReviewsScreen> = {}): ReviewsScreen => ({
      sectionFound: false,
      headerFound: false,
      header: [],
      section: [],
      photosOnScreen: 0,
      ...over,
    });

    test("parseUiNodes reads resource-ids and skips hidden nodes", () => {
      const source =
        '<node resource-id="com.natura:id/tv_rt_value" text="4,5" content-desc="" displayed="true"/>' +
        '<node resource-id="com.natura:id/btFilterBy" text="filtrar" displayed="false"/>' +
        '<node class="android.view.View" text="sem id"/>';
      expect(parseUiNodes(source)).toEqual([
        { id: "tv_rt_value", text: "4,5", desc: "" },
      ]);
    });

    test("a complete section passes every row, like the Web", () => {
      const r = byKey(evaluateReviewsScreen(fullScreen()));
      expect(r.reviews.status).toBe("pass");
      expect(r.reviews.message).toBe(
        "Seção de avaliações presente com 19 reviews",
      );
      expect(r.reviewFilter.status).toBe("pass");
      expect(r.reviewSort.status).toBe("pass");
      expect(r.reviewPhotos.status).toBe("pass");
      expect(r.reviewRecommendation.status).toBe("na");
      expect(r.rating.message).toBe("Nota 4.5 exibida");
      expect(r.ratingConsistency.status).toBe("pass");
      expect(r.topRatedBadge.status).toBe("na");
    });

    test("missing filter/sort fail; no photo on screen is a warning", () => {
      const screen = fullScreen({ photosOnScreen: 0 });
      screen.section = screen.section.filter(
        (n) => !["btFilterBy", "tvSortBy", "imageReview"].includes(n.id),
      );
      const r = byKey(evaluateReviewsScreen(screen));
      expect(r.reviewFilter.status).toBe("fail");
      expect(r.reviewSort.status).toBe("fail");
      expect(r.reviewPhotos.status).toBe("warning");
    });

    test("a product without reviews: section passes, dependent rows N/A", () => {
      const r = byKey(
        evaluateReviewsScreen(
          emptyScreen({
            sectionFound: true,
            headerFound: true,
            header: [node("tv_review_product", "avalie este produto")],
            section: [
              node("titleReviewGeneral", "avaliações"),
              node("noReviewsTextView", "sem avaliações"),
            ],
          }),
        ),
      );
      expect(r.reviews.status).toBe("pass");
      for (const key of [
        "reviewFilter",
        "reviewSort",
        "reviewPhotos",
        "rating",
        "ratingConsistency",
      ]) {
        expect(r[key].status).toBe("na");
      }
    });

    test("no section on the page fails the section rows", () => {
      const r = byKey(evaluateReviewsScreen(emptyScreen()));
      expect(r.reviews.status).toBe("fail");
      expect(r.reviewFilter.status).toBe("fail");
      expect(r.rating.status).toBe("fail");
    });

    test("divergent header and section ratings fail the consistency", () => {
      const screen = fullScreen();
      screen.header = [
        node("tv_rt_value", "4,2"),
        node("tv_see_rating", "(19) avaliações"),
      ];
      expect(
        byKey(evaluateReviewsScreen(screen)).ratingConsistency.status,
      ).toBe("fail");
    });

    const BFF = "https://bff-app-natura-brazil.prd.naturacloud.com";
    const har = (entries: { url: string; status?: number; body?: unknown }[]) => ({
      log: {
        entries: entries.map((e) => ({
          request: { url: e.url },
          response: {
            status: e.status ?? 200,
            content: { text: e.body === undefined ? "" : JSON.stringify(e.body) },
          },
        })),
      },
    });
    const reviewsBody = {
      productId: "NATBRA-1",
      aggregatedRating: 4.47,
      reviewsCount: 19,
      recommendedPercentage: 100,
      reviews: [
        {
          id: "1",
          rating: 5,
          pictures: [
            { id: "a", url: "https://img/a.jpg" },
            { id: "b", url: "https://img/b.jpg" },
          ],
        },
        { id: "2", rating: 4, pictures: [] },
      ],
    };

    test("findAppReviewsApi reads the SKU's reviews calls and the PDP API rating fields", () => {
      const api = findAppReviewsApi(
        har([
          {
            url: `${BFF}/pages/v2/product/NATBRA-1`,
            body: {
              productId: "NATBRA-1",
              rating: 4.5,
              isTopRated: true,
              badgeTopRatedLabel: "melhor avaliado",
            },
          },
          {
            url: `${BFF}/reviews/v2/details?productId=NATBRA-1&sortField=helpfulScore&page=1`,
            body: reviewsBody,
          },
          {
            url: `${BFF}/reviews/v2/details?productId=NATBRA-1&filterMedia=pictures`,
            body: { ...reviewsBody, reviews: [] },
          },
          { url: `${BFF}/reviews/v2/details?productId=NATBRA-2`, status: 500 },
        ]),
        ["NATBRA-1", "NATBRA-3"],
      );
      expect(Object.keys(api)).toEqual(["NATBRA-1"]);
      expect(api["NATBRA-1"].calls).toHaveLength(2);
      expect(api["NATBRA-1"].reviews).toEqual({
        aggregatedRating: 4.47,
        reviewsCount: 19,
        recommendedPercentage: 100,
        reviewsWithPictures: 1,
        pictureCount: 2,
      });
      expect(api["NATBRA-1"].product).toEqual({
        rating: 4.5,
        isTopRated: true,
        badgeTopRatedLabel: "melhor avaliado",
      });
    });

    const api = (over: Partial<AppReviewsApi> = {}): AppReviewsApi => ({
      calls: [{ status: 200, url: `${BFF}/reviews/v2/details?productId=NATBRA-1` }],
      reviews: {
        aggregatedRating: 4.47,
        reviewsCount: 19,
        recommendedPercentage: 100,
        reviewsWithPictures: 1,
        pictureCount: 2,
      },
      product: { rating: 4.5, isTopRated: false },
      ...over,
    });

    test("the app's traffic adds the API row and completes consistency, recommendation and badge", () => {
      const out = applyAppReviewsApi(
        evaluateReviewsScreen(fullScreen()),
        api(),
        null,
      );
      const r = byKey(out);
      expect(r.endpoint_reviews.status).toBe("pass");
      expect(r.endpoint_reviews.message).toBe("1 chamada(s) ok (status 200)");
      expect(r.ratingConsistency.status).toBe("pass");
      expect(r.ratingConsistency.message).toContain(
        "produto=4.5 (API do produto) | reviews=4.47",
      );
      expect(r.rating.message).toContain("igual à API do produto");
      expect(r.reviewRecommendation.message).toContain("API informa 100%");
      expect(r.topRatedBadge.status).toBe("pass");
      expect(out.findIndex((f) => f.featureKey === "endpoint_reviews")).toBe(
        out.findIndex((f) => f.featureKey === "topRatedBadge") + 1,
      );
    });

    test("API photos the app doesn't show fail; a failed reviews call fails the API row", () => {
      const screen = fullScreen({ photosOnScreen: 0 });
      screen.section = screen.section.filter((n) => n.id !== "imageReview");
      const r = byKey(
        applyAppReviewsApi(
          evaluateReviewsScreen(screen),
          api({
            calls: [
              { status: 503, url: `${BFF}/reviews/v2/details?productId=NATBRA-1` },
            ],
          }),
          null,
        ),
      );
      expect(r.reviewPhotos.status).toBe("fail");
      expect(r.endpoint_reviews.status).toBe("fail");
    });

    test("top rated: the API's badge must be on screen, and only then", () => {
      const product = {
        rating: 4.5,
        isTopRated: true,
        badgeTopRatedLabel: "Melhor avaliado",
      };
      const badgeOf = (screen: ReviewsScreen, a: AppReviewsApi) =>
        byKey(applyAppReviewsApi(evaluateReviewsScreen(screen), a, null))
          .topRatedBadge.status;
      expect(badgeOf(fullScreen(), api({ product }))).toBe("fail");
      const withBadge = fullScreen();
      withBadge.header = [
        ...withBadge.header,
        node("tv_tag_text", "melhor avaliado"),
      ];
      expect(badgeOf(withBadge, api({ product }))).toBe("pass");
      expect(badgeOf(withBadge, api())).toBe("fail");
    });

    test("Remote Config product_reviews turns the rows the app hides into disabled", () => {
      const screen = fullScreen();
      screen.section = screen.section.filter((n) => n.id !== "btFilterBy");
      const flags = {
        capturedAt: "",
        locale: "pt-BR",
        product_reviews: { enabled: true, filter: false, sort: true },
      } as never;
      const r = byKey(applyAppReviewsApi(evaluateReviewsScreen(screen), api(), flags));
      expect(r.reviewFilter.status).toBe("disabled");
      expect(r.reviewFilter.passed).toBe(true);
      expect(r.reviewSort.status).toBe("pass");

      const off = {
        capturedAt: "",
        locale: "pt-BR",
        product_reviews: { enabled: false },
      } as never;
      const none = byKey(
        applyAppReviewsApi(
          evaluateReviewsScreen(emptyScreen({ headerFound: true })),
          api({ calls: [] }),
          off,
        ),
      );
      for (const key of [
        "reviews",
        "reviewFilter",
        "reviewSort",
        "reviewPhotos",
        "rating",
        "endpoint_reviews",
      ]) {
        expect(none[key].status).toBe("disabled");
      }
    });

    test("without a capture for the SKU the screen results stand", () => {
      const results = evaluateReviewsScreen(fullScreen());
      expect(applyAppReviewsApi(results, undefined, null)).toEqual(results);
    });
  });

  test.describe("waitForPdpLoaded", () => {
    /** PDP whose skeleton goes away after `loadedAfterPolls` polls, then shows "Cód. 2830". */
    const loadingDriver = (loadedAfterPolls: number) => {
      let polls = 0;
      const driver = {
        $: (selector: string) =>
          selector.includes("shimmerLayouts")
            ? { isDisplayed: async () => polls < loadedAfterPolls }
            : selector.includes("tvCode")
              ? { getText: async () => (polls >= loadedAfterPolls ? "Cód. 2830" : "") }
              : { isDisplayed: async () => false },
        waitUntil: async (condition: () => Promise<boolean>, opts: { timeout: number }) => {
          for (let i = 0; i * 500 < opts.timeout; i++, polls++) {
            if (await condition()) {
              return true;
            }
          }
          throw new Error("timeout");
        },
      } as unknown as WebdriverIO.Browser;
      return driver;
    };

    test("waits for the skeleton to go away and the product code to show up", async () => {
      expect(await waitForPdpLoaded(loadingDriver(40), 45_000)).toBe(true);
    });

    test("an empty product code is still loading", async () => {
      expect(await waitForPdpLoaded(loadingDriver(200), 45_000)).toBe(false);
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
      await recorder.captureFinal();
      expect(recorder.save(os.tmpdir(), "NATBRA-1")).toEqual([]);
      expect(recorder.saveFinal(os.tmpdir(), "NATBRA-1")).toBeUndefined();
    });

    test("the final screen stays in memory until saveFinal (written only for failed SKUs)", async () => {
      const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "steps-"));
      const recorder = new StepScreenshotRecorder({
        takeScreenshot: async () => Buffer.from("final").toString("base64"),
      } as unknown as WebdriverIO.Browser);
      await recorder.captureFinal();
      // Nothing written while the verdict isn't final
      expect(fs.existsSync(path.join(outputDir, "screenshots"))).toBe(false);
      const file = recorder.saveFinal(outputDir, "NATBRA-1");
      expect(file).toMatch(/^screenshots\/NATBRA-1_\d+\.png$/);
      expect(fs.readFileSync(path.join(outputDir, file!), "utf8")).toBe("final");
      fs.rmSync(outputDir, { recursive: true, force: true });
    });
  });

  test.describe("Android apps (Natura BR, Natura LATAM, Avon)", () => {
    const sku = (
      code: string,
      vendor: SkuConfig["vendor"],
      country: SkuConfig["country"],
    ) => ({ sku: code, name: code, vendor, country }) as SkuConfig;

    test("maps each brand and country to its app", () => {
      expect(findAndroidApp(sku("A", "natura", "BR"))?.packageName).toBe(
        "net.natura.semprepresente",
      );
      for (const country of ["AR", "CL", "CO", "PE", "MX"] as const) {
        expect(findAndroidApp(sku("A", "natura", country))?.key).toBe(
          "natura-latam",
        );
      }
      for (const country of ["BR", "AR", "MX"] as const) {
        expect(findAndroidApp(sku("A", "avon", country))?.key).toBe("avon");
      }
      expect(findAndroidApp(sku("A", "avon", "CL"))).toBeUndefined();
    });

    test("sets the device locale the app reads to pick the country", () => {
      expect(deviceLocaleFor("BR")).toEqual({ language: "pt", locale: "BR" });
      expect(deviceLocaleFor("MX")).toEqual({ language: "es", locale: "MX" });
    });

    test("ANDROID_OPERATIONS defaults to Natura BR and is case-insensitive", () => {
      expect(parseAndroidOperations(undefined)).toEqual(["natura-br"]);
      const ops = parseAndroidOperations(" natura-AR, avon-mx ");
      expect(isOperationSelected(sku("A", "natura", "AR"), ops)).toBe(true);
      expect(isOperationSelected(sku("A", "avon", "MX"), ops)).toBe(true);
      expect(isOperationSelected(sku("A", "natura", "BR"), ops)).toBe(false);
    });

    test("plans one session per app + country, sharing the concurrency budget", () => {
      const { plans, unsupported } = planAndroidSessions(
        [
          sku("BR1", "natura", "BR"),
          sku("BR2", "natura", "BR"),
          sku("AR1", "natura", "AR"),
          sku("AV1", "avon", "AR"),
          sku("CL1", "avon", "CL"),
        ],
        2,
      );
      expect(
        plans.map((p) => [p.app.key, p.country, p.skus.map((s) => s.sku)]),
      ).toEqual([
        ["natura-br", "BR", ["BR1", "BR2"]],
        ["natura-latam", "AR", ["AR1"]],
        ["avon", "AR", ["AV1"]],
      ]);
      expect(unsupported.map((s) => s.sku)).toEqual(["CL1"]);
    });

    test("with a single app + country, splits SKUs across the concurrency like before", () => {
      const { plans } = planAndroidSessions(
        ["1", "2", "3"].map((c) => sku(c, "natura", "BR")),
        2,
      );
      expect(plans.map((p) => p.skus.map((s) => s.sku))).toEqual([
        ["1", "3"],
        ["2"],
      ]);
    });

    test("groups share one SKU queue per app + country, in the input order", () => {
      const { groups, unsupported } = planAndroidSessionGroups(
        [
          sku("BR1", "natura", "BR"),
          sku("BR2", "natura", "BR"),
          sku("AR1", "natura", "AR"),
          sku("BR3", "natura", "BR"),
          sku("CL1", "avon", "CL"),
        ],
        3,
      );
      expect(
        groups.map((g) => [g.app.key, g.country, g.sessions, g.skus.map((s) => s.sku)]),
      ).toEqual([
        ["natura-br", "BR", 1, ["BR1", "BR2", "BR3"]],
        ["natura-latam", "AR", 1, ["AR1"]],
      ]);
      expect(unsupported.map((s) => s.sku)).toEqual(["CL1"]);

      const single = planAndroidSessionGroups(
        ["1", "2", "3", "4"].map((c) => sku(c, "natura", "BR")),
        2,
      ).groups;
      expect(single).toHaveLength(1);
      expect(single[0].sessions).toBe(2);
      expect(single[0].skus.map((s) => s.sku)).toEqual(["1", "2", "3", "4"]);
    });

    test("a session that never opens leaves its SKUs in the queue for the others", async () => {
      const queue = createSkuQueue(["1", "2", "3", "4"].map((c) => sku(c, "natura", "BR")));
      const taken: string[] = [];
      const openedSession = async () => {
        for (let s = queue.take(); s; s = queue.take()) {
          taken.push(s.sku);
          await new Promise((r) => setTimeout(r, 1));
        }
      };
      // Fails to open before taking anything, like createAndroidSession's SessionStartError
      const sessionNotOpened = async () => {
        throw new Error("farm did not open the session");
      };
      await Promise.allSettled([openedSession(), sessionNotOpened()]);
      expect(taken).toEqual(["1", "2", "3", "4"]);
      expect(queue.size()).toBe(0);
    });
  });

  test.describe("Device farm capacity (LambdaTest)", () => {
    const capacityResponse = (data: unknown, ok = true) =>
      (async () => ({ ok, json: async () => ({ data, status: "success" }) })) as unknown as typeof fetch;
    const env = { LAMBDATEST_USERNAME: "u", LAMBDATEST_ACCESS_KEY: "k" };

    test("reads the organization's mobile concurrency and counts the free slots", async () => {
      const capacity = await fetchDeviceFarmCapacity(
        env,
        capacityResponse({ max_concurrency: 3, max_queue: 150, queued: 0, running: 2 }),
      );
      expect(capacity).toEqual({ max: 3, running: 2, queued: 0 });
      expect(freeSlots(capacity!)).toBe(1);
      // Queued requests take the slots first
      expect(freeSlots({ max: 3, running: 2, queued: 4 })).toBe(0);
    });

    test("unknown capacity (other provider, no credentials, API error) is null", async () => {
      const fetchOk = capacityResponse({ max_concurrency: 3, running: 0 });
      expect(await fetchDeviceFarmCapacity({ ...env, DEVICE_FARM_PROVIDER: "browserstack" }, fetchOk)).toBeNull();
      expect(await fetchDeviceFarmCapacity({}, fetchOk)).toBeNull();
      expect(await fetchDeviceFarmCapacity(env, capacityResponse({}, false))).toBeNull();
      expect(await fetchDeviceFarmCapacity(env, capacityResponse({ running: 1 }))).toBeNull();
      const throwing = (async () => {
        throw new Error("network");
      }) as unknown as typeof fetch;
      expect(await fetchDeviceFarmCapacity(env, throwing)).toBeNull();
    });

    test("waits for a free slot, bounded, and stops when the slot isn't needed", async () => {
      let clock = 0;
      const sleep = async (ms: number) => {
        clock += ms;
      };
      const now = () => clock;
      const sequence = (...running: number[]) => {
        let i = 0;
        return async () => ({ max: 3, running: running[Math.min(i++, running.length - 1)], queued: 0 });
      };

      // Full for two polls, then a slot frees
      expect(
        await waitForDeviceFarmSlot({ label: "S1", maxWaitMs: 600_000, pollMs: 30_000, getCapacity: sequence(3, 3, 2), sleep, now }),
      ).toBe("free");
      expect(clock).toBe(60_000);

      // Always full: gives up at the deadline (and the session tries anyway)
      clock = 0;
      expect(
        await waitForDeviceFarmSlot({ label: "S1", maxWaitMs: 90_000, pollMs: 30_000, getCapacity: sequence(3), sleep, now }),
      ).toBe("timeout");
      expect(clock).toBe(90_000);

      // The other sessions took every SKU meanwhile
      let polls = 0;
      expect(
        await waitForDeviceFarmSlot({
          label: "S2",
          maxWaitMs: 600_000,
          getCapacity: sequence(3),
          shouldStop: () => ++polls > 2,
          sleep,
          now,
        }),
      ).toBe("stopped");

      // Unknown capacity: don't wait
      expect(await waitForDeviceFarmSlot({ label: "S1", maxWaitMs: 600_000, getCapacity: async () => null, sleep, now })).toBe("unknown");
    });

    test("ANDROID_SLOT_WAIT_MINUTES sets the wait (default 10 min)", () => {
      expect(parseSlotWaitMs({})).toBe(600_000);
      expect(parseSlotWaitMs({ ANDROID_SLOT_WAIT_MINUTES: "2.5" })).toBe(150_000);
      expect(parseSlotWaitMs({ ANDROID_SLOT_WAIT_MINUTES: "abc" })).toBe(600_000);
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

    test("ignores other Remote Config namespaces such as Performance Monitoring (fireperf)", () => {
      expect(
        findRemoteConfigEntriesInNetworkLog(
          har([
            entry(
              "https://firebaseremoteconfig.googleapis.com/v1/projects/865562389217/namespaces/fireperf:fetch",
              JSON.stringify({ entries: { fpr_enabled: "true" } }),
            ),
          ]),
        ),
      ).toBeNull();
    });

    test("returns null Remote Config when the app didn't fetch it in the session", () => {
      expect(
        findRemoteConfigEntriesInNetworkLog(
          har([entry("https://x/feature-flag", flagsBody)]),
        ),
      ).toBeNull();
    });

    test("findPdpApiErrors reports the failed PDP API calls per SKU", () => {
      const api = "https://ncf-apigw.prd.naturacloud.com";
      const status = (url: string, code: number, text?: string) => ({
        request: { url },
        response: { status: code, content: { text } },
      });
      const errors = findPdpApiErrors(
        har([
          // Colombia: the WAF blocked the device
          status(
            `${api}/bff-app-natura-colombia/pages/v2/product/NATCOL-1`,
            403,
            "<HTML><HEAD><TITLE>Access Denied</TITLE></HEAD></HTML>",
          ),
          // Chile SKU asked to the Argentina BFF (app opened in the wrong country)
          status(
            `${api}/bff-app-natura-argentina/pages/v2/product/NATCHL-1`,
            404,
            '{"errorKey":999}',
          ),
          status(`${api}/bff-app-natura-brazil/pages/v2/product/NATBRA-1`, 200),
        ]),
        ["NATCOL-1", "NATCHL-1", "NATBRA-1", "NATBRA-2"],
      );
      expect(errors).toEqual({
        "NATCOL-1": {
          status: 403,
          bff: "bff-app-natura-colombia",
          blockedByWaf: true,
        },
        "NATCHL-1": {
          status: 404,
          bff: "bff-app-natura-argentina",
          blockedByWaf: false,
        },
      });
      expect(describePdpApiError(errors["NATCOL-1"])).toBe(
        "API da PDP bloqueada pelo WAF (403 Access Denied) em bff-app-natura-colombia",
      );
      expect(describePdpApiError(errors["NATCHL-1"])).toBe(
        "API da PDP respondeu 404 em bff-app-natura-argentina — produto não existe nesse BFF (o app abriu no país certo?)",
      );
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
