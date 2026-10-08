import { remote } from "webdriverio";
import type { Capabilities } from "@wdio/types";
import type { SkuConfig } from "./types.js";

/**
 * Creates an Appium session against a device farm or a local Android emulator/device.
 * Mirrors browserSetup.ts's role for the web checks, but for a native Android app via Appium.
 *
 * Provider is selected via DEVICE_FARM_PROVIDER ("browserstack" | "lambdatest" | "local"), default "browserstack".
 * Note: LambdaTest's automated Appium product is "App Automate" (not the manual "App Live" UI) —
 * both share the same uploaded app storage, so an app uploaded via https://applive.lambdatest.com/app
 * can be reused here through its `lt://` id.
 */
export async function createAndroidSession(): Promise<WebdriverIO.Browser> {
  const provider = (
    process.env.DEVICE_FARM_PROVIDER || "browserstack"
  ).toLowerCase();

  if (provider === "local") {
    return createLocalSession();
  }
  if (provider === "lambdatest") {
    return createLambdaTestSession();
  }
  return createBrowserStackSession();
}

function createLocalSession(): Promise<WebdriverIO.Browser> {
  const host = process.env.APPIUM_HOST || "127.0.0.1";
  const port = Number.parseInt(process.env.APPIUM_PORT || "4723", 10);
  const appPath = process.env.ANDROID_APP_PATH || process.env.ANDROID_APK_PATH;

  const capabilities: Capabilities.WebdriverIOConfig["capabilities"] = {
    platformName: "Android",
    "appium:automationName": "UiAutomator2",
    ...(appPath ? { "appium:app": appPath } : {}),
    "appium:deviceName": process.env.ANDROID_DEVICE_NAME || "Android Emulator",
    "appium:platformVersion": process.env.ANDROID_OS_VERSION || "13.0",
    "appium:noReset": true,
    "appium:autoLaunch": false,
    "appium:autoGrantPermissions": true,
    "appium:disableWindowAnimation": true,
    "appium:newCommandTimeout": 180,
  };

  return remote({
    protocol: "http",
    hostname: host,
    port,
    path: process.env.APPIUM_PATH || "/",
    logLevel: "warn",
    capabilities,
  });
}

function createBrowserStackSession(): Promise<WebdriverIO.Browser> {
  const userName = process.env.BROWSERSTACK_USERNAME;
  const accessKey = process.env.BROWSERSTACK_ACCESS_KEY;
  const appId = process.env.BROWSERSTACK_APP_ID;

  if (!userName || !accessKey) {
    throw new Error(
      "BROWSERSTACK_USERNAME/BROWSERSTACK_ACCESS_KEY não configurados — necessários para abrir sessão no device farm",
    );
  }
  if (!appId) {
    throw new Error(
      "BROWSERSTACK_APP_ID não configurado — faça upload do APK/AAB (bstack CLI ou API) e informe o id retornado (bs://...)",
    );
  }

  const capabilities: Capabilities.WebdriverIOConfig["capabilities"] = {
    platformName: "Android",
    "appium:automationName": "UiAutomator2",
    "appium:app": appId,
    "appium:noReset": true,
    // InitActivity is singleInstance/noHistory and only parses deep link extras on a cold
    // onCreate — auto-launching it first would make our deepLink call a warm onNewIntent
    // that the app ignores, landing on Home instead of the PDP.
    "appium:autoLaunch": false,
    "appium:autoGrantPermissions": true,
    "appium:disableWindowAnimation": true,
    "appium:newCommandTimeout": 180,
    "bstack:options": {
      userName,
      accessKey,
      deviceName: process.env.ANDROID_DEVICE_NAME || "Google Pixel 7",
      osVersion: process.env.ANDROID_OS_VERSION || "13.0",
      projectName: "PDP Feature Monitor",
      buildName: process.env.GITHUB_RUN_ID || "local",
      sessionName: "Android PDP check",
    },
  };

  return remote({
    protocol: "https",
    hostname: "hub-cloud.browserstack.com",
    port: 443,
    path: "/wd/hub",
    logLevel: "warn",
    capabilities,
  });
}

function createLambdaTestSession(): Promise<WebdriverIO.Browser> {
  const userName = process.env.LAMBDATEST_USERNAME;
  const accessKey = process.env.LAMBDATEST_ACCESS_KEY;
  const appId = process.env.LAMBDATEST_APP_ID;

  if (!userName || !accessKey) {
    throw new Error(
      "LAMBDATEST_USERNAME/LAMBDATEST_ACCESS_KEY não configurados — necessários para abrir sessão no device farm",
    );
  }
  if (!appId) {
    throw new Error(
      "LAMBDATEST_APP_ID não configurado — faça upload do APK/AAB em https://applive.lambdatest.com/app e informe o id retornado (lt://...)",
    );
  }

  const capabilities: Capabilities.WebdriverIOConfig["capabilities"] = {
    platformName: "Android",
    "appium:automationName": "UiAutomator2",
    "appium:app": appId,
    "appium:deviceName": process.env.ANDROID_DEVICE_NAME || "Galaxy S22 5G",
    "appium:platformVersion": process.env.ANDROID_OS_VERSION || "12",
    "appium:noReset": true,
    // See comment in createBrowserStackSession: avoids a warm onNewIntent that the app ignores.
    "appium:autoLaunch": false,
    "appium:autoGrantPermissions": true,
    "appium:disableWindowAnimation": true,
    "appium:newCommandTimeout": 180,
    "LT:Options": {
      username: userName,
      accessKey,
      project: "PDP Feature Monitor",
      build: process.env.GITHUB_RUN_ID || "local",
      name: "Android PDP check",
      isRealMobile: true,
      w3c: true,
      // Captures the app's own traffic so commerce flags come from what the app received.
      network: process.env.ANDROID_NETWORK_CAPTURE !== "false",
    },
  };

  return remote({
    protocol: "https",
    hostname: "mobile-hub.lambdatest.com",
    port: 443,
    path: "/wd/hub",
    logLevel: "warn",
    capabilities,
  });
}

/**
 * The applicationId varies per brand flavor (app/build.gradle.kts in ncf-whitelabel-cf-android),
 * NOT a single fixed package — confirmed against the uploaded LambdaTest app (net.natura.semprepresente).
 * A ".dev"/".hml" suffix is appended depending on the build mode; ANDROID_APP_PACKAGE overrides
 * everything when set, useful when testing a dev/hml build.
 */
export function resolveAndroidAppPackage(sku: SkuConfig): string {
  if (process.env.ANDROID_APP_PACKAGE) {
    return process.env.ANDROID_APP_PACKAGE;
  }
  if (sku.vendor === "avon") {
    return "com.naturaeco.app.avon";
  }
  if (sku.vendor === "natura" && sku.country === "BR") {
    return "net.natura.semprepresente";
  }
  return "com.naturaeco.app.natura";
}

/**
 * Opens a PDP directly via the app's Android App Links (https://{host}/p/{slug}/{sku}),
 * bypassing in-app search. Uses Appium's `mobile: deepLink` extension instead of a raw
 * `adb shell am start`, since device farms typically don't expose adb shell access.
 *
 * InitActivity doesn't override onNewIntent (confirmed in ncf-whitelabel-cf-android), so if the
 * device farm reuses a still-running app process the deep link intent never reaches
 * callDeeplinkResolver() with fresh data — the app just falls through to Home. terminateApp
 * first forces a real cold onCreate() so the deep link's intent.data is actually used.
 */
export async function openPdpDeepLink(
  driver: WebdriverIO.Browser,
  url: string,
  sku: SkuConfig,
): Promise<void> {
  const appPackage = resolveAndroidAppPackage(sku);

  // In device farms, terminateApp() is asynchronous. Wait deterministically for the app
  // to transition to NOT_RUNNING (0) rather than using an arbitrary pause.
  await driver
    .terminateApp(appPackage)
    .catch((e) => console.debug("   (debug) terminateApp falhou (best-effort):", e));
  await driver
    .waitUntil(
      async () => {
        try {
          const state = await driver.queryAppState(appPackage);
          // 0 = NOT_RUNNING, 1 = NOT_RUNNING (cached/stopped)
          return state === 0 || state === 1;
        } catch {
          return true; // if queryAppState is unsupported, proceed
        }
      },
      { timeout: 3000, interval: 200 },
    )
    .catch(() => {});

  await driver.execute("mobile: deepLink", {
    url,
    package: appPackage,
  });
}

/** Ends the Appium session, releasing the device back to the farm's pool. */
export async function closeAndroidSession(
  driver: WebdriverIO.Browser,
): Promise<void> {
  await driver
    .deleteSession()
    .catch((e) =>
      console.warn(
        "⚠️  deleteSession falhou — a sessão pode ter ficado presa/consumindo cota no device farm:",
        e,
      ),
    );
}
