import { remote } from "webdriverio";
import type { Capabilities } from "@wdio/types";

/**
 * Creates an Appium session against a device farm.
 * Mirrors browserSetup.ts's role for the web checks, but for a native Android app via Appium.
 *
 * Provider is selected via DEVICE_FARM_PROVIDER ("browserstack" | "lambdatest"), default "browserstack".
 * Note: LambdaTest's automated Appium product is "App Automate" (not the manual "App Live" UI) —
 * both share the same uploaded app storage, so an app uploaded via https://applive.lambdatest.com/app
 * can be reused here through its `lt://` id.
 */
export async function createAndroidSession(): Promise<WebdriverIO.Browser> {
  const provider = (
    process.env.DEVICE_FARM_PROVIDER || "browserstack"
  ).toLowerCase();

  if (provider === "lambdatest") {
    return createLambdaTestSession();
  }
  return createBrowserStackSession();
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
    "LT:Options": {
      username: userName,
      accessKey,
      project: "PDP Feature Monitor",
      build: process.env.GITHUB_RUN_ID || "local",
      name: "Android PDP check",
      isRealMobile: true,
      w3c: true,
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

/** Package name of the Natura Android app, used for the deep link and to scope the driver to it. */
export const ANDROID_APP_PACKAGE =
  process.env.ANDROID_APP_PACKAGE || "com.naturaeco.app";

/**
 * Opens a PDP directly via the app's Android App Links (https://{host}/p/{slug}/{sku}),
 * bypassing in-app search. Uses Appium's `mobile: deepLink` extension instead of a raw
 * `adb shell am start`, since device farms typically don't expose adb shell access.
 */
export async function openPdpDeepLink(
  driver: WebdriverIO.Browser,
  url: string,
): Promise<void> {
  await driver.execute("mobile: deepLink", {
    url,
    package: ANDROID_APP_PACKAGE,
  });
}

/** Ends the Appium session, releasing the device back to the farm's pool. */
export async function closeAndroidSession(
  driver: WebdriverIO.Browser,
): Promise<void> {
  await driver.deleteSession().catch(() => {});
}
