import {
  CommerceFeatureFlags,
  matchesCommerceFeatureFlagUrl,
  parseCommerceFeatureFlags,
} from "../checks/remoteConfig.js";
import { getDeviceFarmProvider } from "../deviceSetup.js";

const LT_SESSION_API =
  "https://mobile-api.lambdatest.com/mobile-automation/api/v1/sessions";

/** Network capture (`network: true` in LT:Options) is on unless explicitly disabled. */
export function isAndroidNetworkCaptureEnabled(): boolean {
  return process.env.ANDROID_NETWORK_CAPTURE !== "false";
}

interface CapturedEntry {
  url: string;
  status?: number;
  body?: string;
}

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined;
}

/** HAR content.text may be base64 (content.encoding === "base64"). */
function decodeBody(
  content: Record<string, unknown> | undefined,
): string | undefined {
  const text = content?.text;
  if (typeof text !== "string") {
    return undefined;
  }
  return content?.encoding === "base64"
    ? Buffer.from(text, "base64").toString("utf-8")
    : text;
}

/**
 * Normalizes the device farm network log into flat entries. Accepts a HAR ({log:{entries}}),
 * a bare entries array, or either wrapped in `data` — the LambdaTest payload shape isn't
 * formally documented, so this stays lenient.
 */
export function extractNetworkEntries(payload: unknown): CapturedEntry[] {
  const inner = asRecord(payload)?.data ?? payload;
  const innerRec = asRecord(inner);
  const list = Array.isArray(inner)
    ? inner
    : (asRecord(innerRec?.log)?.entries ?? innerRec?.entries);
  if (!Array.isArray(list)) {
    return [];
  }

  const entries: CapturedEntry[] = [];
  for (const item of list) {
    const e = asRecord(item);
    const req = asRecord(e?.request);
    const res = asRecord(e?.response);
    const url = req?.url ?? e?.url;
    if (typeof url !== "string") {
      continue;
    }
    entries.push({
      url,
      status: typeof res?.status === "number" ? res.status : undefined,
      body:
        decodeBody(asRecord(res?.content)) ??
        (typeof res?.body === "string" ? res.body : undefined),
    });
  }
  return entries;
}

/**
 * Latest successful JSON body, among the requests matching `matchesUrl`, that `accept` takes.
 * `found` tells "never called" apart from "called but no usable body" for the logs.
 */
function findLastJsonBody(
  entries: CapturedEntry[],
  matchesUrl: (url: string) => boolean,
  accept: (body: Record<string, unknown>) => boolean = () => true,
): { found: boolean; body: Record<string, unknown> | null } {
  const candidates = entries.filter(
    (e) =>
      matchesUrl(e.url) &&
      (e.status === undefined || (e.status >= 200 && e.status < 300)),
  );
  for (const entry of [...candidates].reverse()) {
    if (!entry.body) {
      continue;
    }
    try {
      const body = asRecord(JSON.parse(entry.body));
      if (body && accept(body)) {
        return { found: true, body };
      }
    } catch {
      // not JSON — try an older capture
    }
  }
  return { found: candidates.length > 0, body: null };
}

/**
 * Picks the last /feature-flag response the app itself received and parses it. Returns null
 * when the app never called it or the capture has no JSON body.
 */
export function findCommerceFlagsInNetworkLog(
  payload: unknown,
): CommerceFeatureFlags | null {
  const { found, body } = findLastJsonBody(
    extractNetworkEntries(payload),
    matchesCommerceFeatureFlagUrl,
  );
  if (body) {
    return parseCommerceFeatureFlags(body);
  }
  if (found) {
    console.log(
      "   ⚠️  Commerce flags: o app chamou /feature-flag, mas o log de rede veio sem corpo JSON (SSL pinning ou captura sem body).",
    );
  }
  return null;
}

/**
 * The app's Remote Config fetch: .../v1/projects/<number>/namespaces/firebase:fetch. Other
 * namespaces hit the same host with their own config (e.g. fireperf:fetch, Performance
 * Monitoring's fpr_* keys) and must not be read as the app's flags.
 */
export function matchesRemoteConfigFetchUrl(url: string): boolean {
  return /firebaseremoteconfig\.googleapis\.com\/.*\/namespaces\/firebase:fetch/.test(
    url,
  );
}

/**
 * Remote Config entries as the app itself received them (last fetch with `entries`). A fetch
 * answered with state NO_CHANGE carries no entries and is skipped. Returns null when the app
 * didn't fetch during the session (e.g. it used its cached values) or the body wasn't captured.
 */
export function findRemoteConfigEntriesInNetworkLog(
  payload: unknown,
): Record<string, string> | null {
  const { found, body } = findLastJsonBody(
    extractNetworkEntries(payload),
    matchesRemoteConfigFetchUrl,
    (b) => asRecord(b.entries) !== undefined,
  );
  if (body) {
    return body.entries as Record<string, string>;
  }
  console.log(
    found
      ? "   ⚠️  Remote Config: o app buscou as configs, mas o log de rede veio sem entries (resposta sem mudança, SSL pinning ou captura sem body)."
      : "   ⚠️  Remote Config: o app não buscou as configs nesta sessão (usou cache?).",
  );
  return null;
}

async function fetchLambdaTestNetworkLog(sessionId: string): Promise<unknown> {
  const user = process.env.LAMBDATEST_USERNAME;
  const key = process.env.LAMBDATEST_ACCESS_KEY;
  if (!user || !key) {
    throw new Error("LAMBDATEST_USERNAME/LAMBDATEST_ACCESS_KEY ausentes");
  }
  const auth = Buffer.from(`${user}:${key}`).toString("base64");

  // Logs are processed after the session closes, so the first attempts may 404.
  const maxAttempts = 5;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${LT_SESSION_API}/${sessionId}/log/network`, {
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    });
    if (res.ok) {
      const json = (await res.json()) as unknown;
      // Some log APIs answer with a signed URL to the actual file instead of inline data.
      const signedUrl = asRecord(json)?.url;
      if (typeof signedUrl === "string" && signedUrl.startsWith("http")) {
        const file = await fetch(signedUrl, {
          signal: AbortSignal.timeout(30_000),
        });
        return (await file.json()) as unknown;
      }
      return json;
    }
    if (res.status !== 404 || attempt >= maxAttempts) {
      throw new Error(`log de rede indisponível: HTTP ${res.status}`);
    }
    await new Promise((r) => setTimeout(r, attempt * 5000));
  }
}

export interface AppSessionFlags {
  commerce: CommerceFeatureFlags | null;
  remoteConfigEntries: Record<string, string> | null;
}

/**
 * Commerce feature flags and Remote Config as the Android app received them, read from the
 * device farm's network capture of the (already closed) session. The script never calls the
 * BFF or Firebase itself. Returns null when there's no capture for this provider/config.
 */
export async function readAppSessionFlags(
  sessionId: string,
): Promise<AppSessionFlags | null> {
  const provider = getDeviceFarmProvider();
  if (provider !== "lambdatest") {
    console.log(
      `   ℹ️  Flags do app: captura de rede só implementada para LambdaTest (provider atual: ${provider}).`,
    );
    return null;
  }
  if (!isAndroidNetworkCaptureEnabled()) {
    return null;
  }
  const log = await fetchLambdaTestNetworkLog(sessionId);
  return {
    commerce: findCommerceFlagsInNetworkLog(log),
    remoteConfigEntries: findRemoteConfigEntriesInNetworkLog(log),
  };
}
