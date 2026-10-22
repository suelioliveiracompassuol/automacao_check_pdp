import {
  RemoteConfigFlags,
  COUNTRY_TO_LOCALE,
  parseRemoteConfigEntries,
} from "../checks/remoteConfig.js";

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
 * Remote Config flags for a SKU from the entries the app received (see
 * findRemoteConfigEntriesInNetworkLog): same shape the Web monitor records, plus the app-only
 * `wl_notify_me` resolved for the SKU's locale/channel.
 */
export function buildRemoteConfigFlags(
  entries: Record<string, string>,
  sku: { country: string; channel?: string },
): RemoteConfigFlags {
  const locale = COUNTRY_TO_LOCALE[sku.country] || "pt-BR";
  return {
    capturedAt: new Date().toISOString(),
    locale,
    _raw: entries,
    ...parseRemoteConfigEntries(entries, locale),
    wl_notify_me: resolveNotifyMeFlag(entries, locale, sku.channel),
  };
}
