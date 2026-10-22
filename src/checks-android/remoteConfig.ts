import crypto from "node:crypto";
import { SkuConfig } from "../types.js";
import {
  RemoteConfigFlags,
  COUNTRY_TO_LOCALE,
  parseRemoteConfigEntries,
} from "../checks/remoteConfig.js";

export interface FirebaseAppCreds {
  projectId: string;
  projectNumber: string;
  apiKey: string;
  appId: string;
  packageName: string;
}

/**
 * Loads Firebase app configurations securely from environment variables.
 * Secrets and identifiers must NEVER be hardcoded in source code.
 *
 * Supported formats:
 * 1. Multi-app JSON via `ANDROID_FIREBASE_APPS_JSON`:
 *    '{"net.natura.semprepresente":{"projectId":"...","projectNumber":"...","apiKey":"...","appId":"...","packageName":"net.natura.semprepresente"}}'
 * 2. Single-app individual env vars (PROJECT_ID / ANDROID_FIREBASE_PROJECT_ID, API_KEY, etc.)
 */
export function loadFirebaseAppsFromEnv(): Record<string, FirebaseAppCreds> {
  const apps: Record<string, FirebaseAppCreds> = {};

  // Single-app configuration via direct env vars. ANDROID_FIREBASE_* is what the CI workflow
  // passes; the unprefixed names are kept for existing local .env files.
  const env = (name: string) =>
    process.env[`ANDROID_FIREBASE_${name}`] || process.env[name];
  const projectId = env("PROJECT_ID");
  const projectNumber = env("PROJECT_NUMBER");
  const apiKey = env("API_KEY");
  const appId = env("APP_ID");
  const packageName = env("PACKAGE_NAME");

  if (projectId && projectNumber && apiKey && appId && packageName) {
    apps[packageName] = {
      projectId,
      projectNumber,
      apiKey,
      appId,
      packageName,
    };
  }

  // Multi-app JSON configuration
  const raw = process.env.ANDROID_FIREBASE_APPS_JSON;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, FirebaseAppCreds>;
      if (parsed && typeof parsed === "object") {
        Object.assign(apps, parsed);
      }
    } catch {
      console.warn(
        "⚠️ ANDROID_FIREBASE_APPS_JSON inválido — ignorei a configuração extra de Firebase apps.",
      );
    }
  }

  return apps;
}

/** A valid Firebase Installations FID: 17 random bytes with the first nibble forced to 0111 (0x7-). */
function generateFid(): string {
  const bytes = crypto.randomBytes(17);
  bytes[0] = 0x70 | (bytes[0] & 0x0f);
  return bytes.toString("base64url").slice(0, 22);
}

async function fetchInstallation(
  app: FirebaseAppCreds,
): Promise<{ fid: string; authToken: string }> {
  const res = await fetch(
    `https://firebaseinstallations.googleapis.com/v1/projects/${app.projectId}/installations`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": app.apiKey,
        "x-android-package": app.packageName,
      },
      body: JSON.stringify({
        fid: generateFid(),
        appId: app.appId,
        authVersion: "FIS_v2",
        sdkVersion: "a:17.1.3",
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Firebase Installations fetch failed: HTTP ${res.status}`);
  }
  const body = (await res.json()) as {
    fid: string;
    authToken?: { token?: string };
  };
  if (!body.authToken?.token) {
    throw new Error("Firebase Installations response missing authToken");
  }
  return { fid: body.fid, authToken: body.authToken.token };
}

async function fetchRemoteConfigEntries(
  app: FirebaseAppCreds,
  fid: string,
  authToken: string,
): Promise<Record<string, string>> {
  const res = await fetch(
    `https://firebaseremoteconfig.googleapis.com/v1/projects/${app.projectNumber}/namespaces/firebase:fetch?key=${app.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appId: app.appId,
        appInstanceId: fid,
        appInstanceIdToken: authToken,
        platformVersion: "13",
        sdkVersion: "22.0.0",
        packageName: app.packageName,
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Remote Config fetch failed: HTTP ${res.status}`);
  }
  const body = (await res.json()) as { entries?: Record<string, string> };
  return body.entries ?? {};
}

/**
 * Resolves `wl_notify_me` exactly like the app (FirebaseRemoteConfigImpl.getMultiLangFeatureFlag):
 * the value is a locale-keyed JSON object; BR social commerce (Minha Loja) reads "pt-BR-ML" then
 * "pt-BR"; other locales have no fallback; a missing/unparseable value means false.
 */
export function resolveNotifyMeFlag(
  entries: Record<string, string>,
  locale: string,
  channel?: string,
): boolean {
  try {
    const parsed = JSON.parse(entries.wl_notify_me ?? "") as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return false;
    }
    const byLocale = parsed as Record<string, unknown>;
    const value =
      locale === "pt-BR" && channel === "socialcommerce"
        ? (byLocale["pt-BR-ML"] ?? byLocale["pt-BR"])
        : byLocale[locale];
    return value === true;
  } catch {
    return false;
  }
}

/**
 * Fetches real Firebase Remote Config values for the Android app via the same public
 * REST endpoints the app's own SDK uses at runtime (Installations API to mint a FID/token,
 * then the Remote Config fetch API) — no device/Appium session needed, this is independent
 * of native UI state, so it can't be affected by deep-link/native-rendering flakiness.
 */
export async function fetchRemoteConfigFlagsAndroid(
  sku: SkuConfig,
  packageName: string,
): Promise<RemoteConfigFlags | null> {
  const apps = loadFirebaseAppsFromEnv();
  const app = apps[packageName];
  if (!app) {
    console.warn(
      `⚠️ Remote Config Android sem mapeamento Firebase para package ${packageName}. ` +
        "Configure ANDROID_FIREBASE_APPS_JSON ou variáveis de ambiente (PROJECT_ID, API_KEY, etc.) para habilitar.",
    );
    return null;
  }
  const locale = COUNTRY_TO_LOCALE[sku.country] || "pt-BR";
  const { fid, authToken } = await fetchInstallation(app);
  const entries = await fetchRemoteConfigEntries(app, fid, authToken);

  return {
    capturedAt: new Date().toISOString(),
    locale,
    _raw: entries,
    ...parseRemoteConfigEntries(entries, locale),
    wl_notify_me: resolveNotifyMeFlag(entries, locale, sku.channel),
  };
}
