import crypto from "node:crypto";
import { SkuConfig } from "../types.js";
import {
  RemoteConfigFlags,
  COUNTRY_TO_LOCALE,
  parseRemoteConfigEntries,
} from "../checks/remoteConfig.js";

interface FirebaseAppCreds {
  projectId: string;
  projectNumber: string;
  apiKey: string;
  appId: string;
  packageName: string;
}

/**
 * Firebase app identifiers per Android package. This is intentionally extensible so the
 * feature monitor can scale beyond Natura BR without code changes for each new package.
 *
 * Supported override format via env variable:
 *   ANDROID_FIREBASE_APPS_JSON='{"com.naturaeco.app.natura":{"projectId":"...","projectNumber":"...","apiKey":"...","appId":"...","packageName":"com.naturaeco.app.natura"}}'
 *
 * The JSON is merged on top of the static base map, letting CI/device-farm teams register new apps
 * without modifying the source every time a new brand/package is added.
 */
const BASE_FIREBASE_APPS: Record<string, FirebaseAppCreds> = {
  "net.natura.semprepresente": {
    projectId: "app-natura-4961a",
    projectNumber: "865562389217",
    apiKey: "AIzaSyArC2ee8qeBXSZrCobtI0QNaOFgGL_EhXc",
    appId: "1:865562389217:android:5679cc15b02e59b4",
    packageName: "net.natura.semprepresente",
  },
};

function loadFirebaseAppsFromEnv(): Record<string, FirebaseAppCreds> {
  const raw = process.env.ANDROID_FIREBASE_APPS_JSON;
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, FirebaseAppCreds>;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return parsed;
  } catch {
    console.warn(
      "⚠️ ANDROID_FIREBASE_APPS_JSON inválido — ignorei a configuração extra de Firebase apps.",
    );
    return {};
  }
}

const FIREBASE_APPS: Record<string, FirebaseAppCreds> = {
  ...BASE_FIREBASE_APPS,
  ...loadFirebaseAppsFromEnv(),
};

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
 * Fetches real Firebase Remote Config values for the Android app via the same public
 * REST endpoints the app's own SDK uses at runtime (Installations API to mint a FID/token,
 * then the Remote Config fetch API) — no device/Appium session needed, this is independent
 * of native UI state, so it can't be affected by deep-link/native-rendering flakiness.
 */
export async function fetchRemoteConfigFlagsAndroid(
  sku: SkuConfig,
  packageName: string,
): Promise<RemoteConfigFlags | null> {
  const app = FIREBASE_APPS[packageName];
  if (!app) {
    console.warn(
      `⚠️ Remote Config Android sem mapeamento Firebase para package ${packageName}. ` +
        "Adicione o app no mapa estático ou via ANDROID_FIREBASE_APPS_JSON para escalar para outras marcas/packagens.",
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
  };
}
