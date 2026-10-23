import type { Country, SkuConfig, Vendor } from "../../types.js";

/**
 * Android apps checked by the monitor, one per brand flavor of ncf-whitelabel-cf-android
 * (app/build.gradle.kts). Natura LATAM and Avon serve several countries from the same app and
 * pick the country from the device: stored choice → network/SIM country → device locale
 * (LocaleManagerImpl, checkCountryLatam/checkCountryAvon). Device farm phones have no SIM, so each
 * session sets the device locale of the country it checks (see deviceLocaleFor).
 *
 * Only ecommerce PDPs are covered (social commerce / Minha Loja deep links aren't mapped here).
 */
export interface AndroidApp {
  key: "natura-br" | "natura-latam" | "avon";
  packageName: string;
  vendor: Vendor;
  countries: readonly Country[];
  /** Env var with the app's LambdaTest id (lt://...) — each app is a separate APK upload. */
  lambdaTestAppIdEnv: string;
}

export const ANDROID_APPS: readonly AndroidApp[] = [
  {
    key: "natura-br",
    packageName: "net.natura.semprepresente",
    vendor: "natura",
    countries: ["BR"],
    lambdaTestAppIdEnv: "LAMBDATEST_APP_ID",
  },
  {
    key: "natura-latam",
    packageName: "com.naturaeco.app.natura",
    vendor: "natura",
    countries: ["AR", "CL", "CO", "PE", "MX"],
    lambdaTestAppIdEnv: "LAMBDATEST_APP_ID_NATURA_LATAM",
  },
  {
    key: "avon",
    packageName: "com.naturaeco.app.avon",
    vendor: "avon",
    countries: ["BR", "AR", "MX"],
    lambdaTestAppIdEnv: "LAMBDATEST_APP_ID_AVON",
  },
];

/** The app that serves this SKU's brand and country, or undefined if no app covers it. */
export function findAndroidApp(
  sku: Pick<SkuConfig, "vendor" | "country">,
): AndroidApp | undefined {
  return ANDROID_APPS.find(
    (app) => app.vendor === sku.vendor && app.countries.includes(sku.country),
  );
}

/**
 * Device language/region that makes the app pick `country` (Locale.getDefault().country in
 * checkCountryLatam/checkCountryAvon). The PDP deep link also requires it: DeepLinkResolver
 * compares the link's domain (.ar, .mx...) with the device country.
 */
export function deviceLocaleFor(country: Country): {
  language: string;
  locale: string;
} {
  return { language: country === "BR" ? "pt" : "es", locale: country };
}

/**
 * ANDROID_OPERATIONS: comma list of operations to check, same format as the Web monitor's
 * OPERATIONS_FILTER, e.g. "natura-BR,natura-AR,avon-MX" (case-insensitive). Defaults to
 * Natura BR only — the other apps are ready but enabled only when listed here.
 */
export function parseAndroidOperations(
  value = process.env.ANDROID_OPERATIONS,
): string[] {
  const operations = (value ?? "")
    .split(",")
    .map((op) => op.trim().toLowerCase())
    .filter(Boolean);
  return operations.length > 0 ? operations : ["natura-br"];
}

/** Whether the SKU's "vendor-COUNTRY" is one of `operations` (from parseAndroidOperations). */
export function isOperationSelected(
  sku: Pick<SkuConfig, "vendor" | "country">,
  operations: readonly string[],
): boolean {
  return operations.includes(`${sku.vendor}-${sku.country}`.toLowerCase());
}

/** What a device session runs: one app, with the device set to one country. */
export interface AndroidSessionTarget {
  app: AndroidApp;
  country: Country;
}
