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

const LOG_DOWNLOAD_TIMEOUT_MS = 90_000;

function isTimeout(e: unknown): boolean {
  return e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
}

async function fetchLambdaTestNetworkLog(sessionId: string): Promise<unknown> {
  const user = process.env.LAMBDATEST_USERNAME;
  const key = process.env.LAMBDATEST_ACCESS_KEY;
  if (!user || !key) {
    throw new Error("LAMBDATEST_USERNAME/LAMBDATEST_ACCESS_KEY ausentes");
  }
  const auth = Buffer.from(`${user}:${key}`).toString("base64");

  // Logs are processed after the session closes, so the first attempts may 404; a log with a
  // lot of traffic (e.g. an app retrying a blocked API) can also take long to download.
  const maxAttempts = 5;
  for (let attempt = 1; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${LT_SESSION_API}/${sessionId}/log/network`, {
        headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
        signal: AbortSignal.timeout(LOG_DOWNLOAD_TIMEOUT_MS),
      });
      if (res.ok) {
        const json = (await res.json()) as unknown;
        // Some log APIs answer with a signed URL to the actual file instead of inline data.
        const signedUrl = asRecord(json)?.url;
        if (typeof signedUrl === "string" && signedUrl.startsWith("http")) {
          const file = await fetch(signedUrl, {
            signal: AbortSignal.timeout(LOG_DOWNLOAD_TIMEOUT_MS),
          });
          return (await file.json()) as unknown;
        }
        return json;
      }
    } catch (e) {
      if (!isTimeout(e) || attempt >= maxAttempts) {
        throw e;
      }
      await new Promise((r) => setTimeout(r, attempt * 5000));
      continue;
    }
    if (res.status !== 404 || attempt >= maxAttempts) {
      throw new Error(`log de rede indisponível: HTTP ${res.status}`);
    }
    await new Promise((r) => setTimeout(r, attempt * 5000));
  }
}

/** A failed response of the PDP API (BFF pages/v2/product/<SKU>) the app called. */
export interface PdpApiError {
  status: number;
  /** BFF the app called, e.g. "bff-app-natura-colombia" — shows a wrong-country app at a glance. */
  bff: string;
  /** 403 with Akamai's "Access Denied" page: the WAF blocked the device, not the BFF. */
  blockedByWaf: boolean;
}

/**
 * The app's own PDP API response per SKU, from the session's network log: when it failed, the
 * check results only say "nothing on screen", while the real cause is the API (blocked by the
 * WAF, product missing in the BFF of the country the app opened in...). Only failures are
 * returned, keyed by SKU.
 */
export function findPdpApiErrors(
  payload: unknown,
  skuCodes: readonly string[],
): Record<string, PdpApiError> {
  const entries = extractNetworkEntries(payload);
  const errors: Record<string, PdpApiError> = {};
  for (const sku of skuCodes) {
    const last = entries
      .filter((e) => e.url.includes(`/pages/v2/product/${sku}`))
      .pop();
    if (!last?.status || last.status < 400) {
      continue;
    }
    errors[sku] = {
      status: last.status,
      bff: /bff-app-[a-z-]+/.exec(last.url)?.[0] ?? new URL(last.url).host,
      blockedByWaf: last.status === 403 && /access denied/i.test(last.body ?? ""),
    };
  }
  return errors;
}

/** Report message for a PdpApiError. */
export function describePdpApiError(error: PdpApiError): string {
  if (error.blockedByWaf) {
    return `API da PDP bloqueada pelo WAF (403 Access Denied) em ${error.bff}`;
  }
  const hint =
    error.status === 404
      ? " — produto não existe nesse BFF (o app abriu no país certo?)"
      : "";
  return `API da PDP respondeu ${error.status} em ${error.bff}${hint}`;
}

/** Product images the PDP API sent the app, and how the app's download of each one went. */
export interface PdpApiImages {
  /** "variations" (selected variant's bannerCollection) or "images" (product without variants). */
  source: "variations" | "images";
  urls: string[];
  /** Downloads that came back with an HTTP error. */
  failed: { url: string; status: number }[];
  /** URLs with a successful download in the session's capture. */
  downloadedCount: number;
}

function stringList(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((s): s is string => typeof s === "string" && s.length > 0)
    : [];
}

/**
 * The carousel images in a PDP API body, the way ncf-whitelabel-cf-android picks them
 * (ProductBaseInformationViewHolder): with variants, the selected variant's bannerCollection
 * (the SKU's own variant, else the first one); without, images.large (or medium) absURLs.
 */
export function extractPdpImageUrls(
  body: Record<string, unknown>,
  sku: string,
): Pick<PdpApiImages, "source" | "urls"> {
  const product =
    "variations" in body || "images" in body
      ? body
      : (asRecord(body.data) ?? body);
  const variations = (
    Array.isArray(product.variations) ? product.variations : []
  )
    .map(asRecord)
    .filter((v): v is Record<string, unknown> => v !== undefined);
  if (variations.length > 0) {
    const variant =
      variations.find((v) => v.productId === sku) ?? variations[0];
    return { source: "variations", urls: stringList(variant.bannerCollection) };
  }
  const images = asRecord(product.images);
  const list = Array.isArray(images?.large) ? images.large : images?.medium;
  return {
    source: "images",
    urls: (Array.isArray(list) ? list : [])
      .map((i) => asRecord(i)?.absURL)
      .filter((u): u is string => typeof u === "string" && u.length > 0),
  };
}

const withoutQuery = (url: string) => url.split("?")[0];

/** The app's downloads of `urls` in the capture (it adds CDN resize params to the query string). */
function crossWithDownloads(
  entries: CapturedEntry[],
  urls: string[],
): Pick<PdpApiImages, "failed" | "downloadedCount"> {
  const failed: PdpApiImages["failed"] = [];
  let downloadedCount = 0;
  for (const url of urls) {
    const download = entries
      .filter(
        (e) => e.url === url || withoutQuery(e.url) === withoutQuery(url),
      )
      .pop();
    if (download?.status && download.status >= 400) {
      failed.push({ url, status: download.status });
    } else if (download) {
      downloadedCount++;
    }
  }
  return { failed, downloadedCount };
}

/** Last successful PDP API JSON body of `sku` in the capture. */
function findPdpApiBody(
  entries: CapturedEntry[],
  sku: string,
): Record<string, unknown> | null {
  return findLastJsonBody(entries, (url) =>
    url.includes(`/pages/v2/product/${sku}`),
  ).body;
}

/**
 * Per SKU, the images its PDP API response (last successful pages/v2/product/<SKU> with a JSON
 * body) listed for the carousel, crossed with the app's own downloads of those URLs in the same
 * capture. SKUs whose API body wasn't captured are left out.
 */
export function findPdpApiImages(
  payload: unknown,
  skuCodes: readonly string[],
): Record<string, PdpApiImages> {
  const entries = extractNetworkEntries(payload);
  const result: Record<string, PdpApiImages> = {};
  for (const sku of skuCodes) {
    const body = findPdpApiBody(entries, sku);
    if (!body) {
      continue;
    }
    const { source, urls } = extractPdpImageUrls(body, sku);
    result[sku] = { source, urls, ...crossWithDownloads(entries, urls) };
  }
  return result;
}

/** Content banners the PDP API sent the app, and how the app's download of their images went. */
export interface PdpApiContentBanners {
  /** One per neProductPageMediaContent component: "type1" is a single banner, any other a widepic. */
  components: { type: string; urls: string[] }[];
  /** Every component's image URLs. */
  urls: string[];
  failed: { url: string; status: number }[];
  downloadedCount: number;
}

/**
 * The content banner components of a PDP API body, the way ncf-whitelabel-cf-android reads them
 * (ProductDetailsResponseToModelAdapter.biuldComponentMediaContent): productComponents entries
 * with entity "neProductPageMediaContent", each image from mediaItems[].image.mobile.url.
 */
export function extractPdpContentBanners(
  body: Record<string, unknown>,
): PdpApiContentBanners["components"] {
  const product =
    "productComponents" in body ? body : (asRecord(body.data) ?? body);
  return (
    Array.isArray(product.productComponents) ? product.productComponents : []
  )
    .map(asRecord)
    .filter((c) => c?.entity === "neProductPageMediaContent")
    .map((c) => {
      const media = asRecord(c?.neProductPageMediaContent);
      const items = Array.isArray(media?.mediaItems) ? media.mediaItems : [];
      return {
        type: typeof media?.type === "string" ? media.type : "",
        urls: items
          .map((i) => asRecord(asRecord(asRecord(i)?.image)?.mobile)?.url)
          .filter((u): u is string => typeof u === "string" && u.length > 0),
      };
    });
}

/**
 * Per SKU, the content banners its PDP API response listed, crossed with the app's downloads of
 * their images. Widepic pages are only loaded when shown, so images never downloaded aren't a
 * failure. SKUs whose API body wasn't captured are left out.
 */
export function findPdpApiContentBanners(
  payload: unknown,
  skuCodes: readonly string[],
): Record<string, PdpApiContentBanners> {
  const entries = extractNetworkEntries(payload);
  const result: Record<string, PdpApiContentBanners> = {};
  for (const sku of skuCodes) {
    const body = findPdpApiBody(entries, sku);
    if (!body) {
      continue;
    }
    const components = extractPdpContentBanners(body);
    const urls = components.flatMap((c) => c.urls);
    result[sku] = { components, urls, ...crossWithDownloads(entries, urls) };
  }
  return result;
}

/**
 * LambdaTest answers 200 with a partial log while it's still processing a session that just
 * closed (seen on a short session that ended while another was still running: no flags at all).
 * The app always calls the PDP API when a PDP opens, so a log without the last SKU's call is
 * incomplete and is downloaded again.
 */
const INCOMPLETE_LOG_RETRIES = 4;
const INCOMPLETE_LOG_WAIT_MS = 15_000;

/** Whether the captured log already has the app's PDP API call for `sku`. */
export function hasPdpApiCall(payload: unknown, sku: string): boolean {
  return extractNetworkEntries(payload).some((e) =>
    e.url.includes(`/pages/v2/product/${sku}`),
  );
}

export interface AppSessionFlags {
  commerce: CommerceFeatureFlags | null;
  remoteConfigEntries: Record<string, string> | null;
  pdpApiErrors: Record<string, PdpApiError>;
  pdpApiImages: Record<string, PdpApiImages>;
  pdpApiContentBanners: Record<string, PdpApiContentBanners>;
}

/**
 * Commerce feature flags, Remote Config and the PDP API errors, images and content banners of `skuCodes`, as the Android app
 * received them, read from the device farm's network capture of the (already closed) session.
 * The script never calls the BFF or Firebase itself. Returns null when there's no capture for
 * this provider/config.
 */
export async function readAppSessionFlags(
  sessionId: string,
  skuCodes: readonly string[],
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
  let log = await fetchLambdaTestNetworkLog(sessionId);
  const lastSku = skuCodes[skuCodes.length - 1];
  for (
    let attempt = 1;
    lastSku &&
    !hasPdpApiCall(log, lastSku) &&
    attempt <= INCOMPLETE_LOG_RETRIES;
    attempt++
  ) {
    console.log(
      `   ⏳ Log de rede da sessão ${sessionId} ainda incompleto (sem a API da PDP de ${lastSku}, ` +
        `${extractNetworkEntries(log).length} requisições); nova tentativa ${attempt}/${INCOMPLETE_LOG_RETRIES} em ${INCOMPLETE_LOG_WAIT_MS / 1000}s`,
    );
    await new Promise((r) => setTimeout(r, INCOMPLETE_LOG_WAIT_MS));
    log = await fetchLambdaTestNetworkLog(sessionId);
  }
  if (lastSku && !hasPdpApiCall(log, lastSku)) {
    console.log(
      `   ⚠️  Log de rede da sessão ${sessionId} sem a API da PDP de ${lastSku} mesmo após as tentativas: flags e imagens da API podem faltar.`,
    );
  }
  return {
    commerce: findCommerceFlagsInNetworkLog(log),
    remoteConfigEntries: findRemoteConfigEntriesInNetworkLog(log),
    pdpApiErrors: findPdpApiErrors(log, skuCodes),
    pdpApiImages: findPdpApiImages(log, skuCodes),
    pdpApiContentBanners: findPdpApiContentBanners(log, skuCodes),
  };
}
