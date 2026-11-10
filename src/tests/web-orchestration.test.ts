/**
 * The Web orchestrator's decisions, outside of a browser: which SKUs and features a run checks
 * (env filters, smoke mode), which features are decided by flags without running a checker, and
 * when a PDP counts as passed.
 */
import { test, expect } from "@playwright/test";
import { FEATURES } from "../checks/configs/features.js";
import type { CommerceFeatureFlags, RemoteConfigFlags } from "../checks/remoteConfig.js";
import type { CheckResult, FeatureConfig, SkuConfig } from "../types.js";
import { gateFeatures } from "../web/featureGating.js";
import { isPdpSuccessful, legacyEndpointResult } from "../web/pdpResults.js";
import {
  groupByOperation,
  operationKey,
  parseRunOptions,
  selectSkus,
  usesFirefox,
} from "../web/runOptions.js";

const sku = (code: string, vendor: string, country: string, channel = "ecommerce"): SkuConfig =>
  ({ sku: code, name: code, slug: code.toLowerCase(), vendor, country, channel, expectedFeatures: [] }) as SkuConfig;

const SKUS = [
  sku("NATBRA-1", "natura", "BR"),
  sku("NATBRA-2", "natura", "BR"),
  sku("NATBRA-1", "natura", "BR", "socialcommerce"),
  sku("NATARG-1", "natura", "AR"),
  sku("AVNBRA-1", "avon", "BR"),
];

test.describe("Run options", () => {
  test("lê os filtros do ambiente (listas com espaços e vazias)", () => {
    const o = parseRunOptions({
      FEATURES_FILTER: " reviews, rating ,",
      OPERATIONS_FILTER: "natura-BR",
      SKU_FILTER: "",
      ENDPOINT_MATCH: "  /api/x ",
      MONITOR_ENDPOINTS: "false",
      MODE: "smoke",
    });
    expect({ ...o, featuresFilter: [...o.featuresFilter!] }).toEqual({
      featuresFilter: ["reviews", "rating"],
      operationsFilter: ["natura-BR"],
      skuFilter: null,
      endpointMatch: "/api/x",
      monitorEndpoints: false,
      isSmokeMode: true,
    });
  });

  test("sem variáveis: tudo, com monitor de endpoints ligado", () => {
    expect(parseRunOptions({})).toEqual({
      featuresFilter: null,
      operationsFilter: null,
      skuFilter: null,
      endpointMatch: null,
      monitorEndpoints: true,
      isSmokeMode: false,
    });
  });

  test("chave de operação distingue social commerce", () => {
    expect(SKUS.map(operationKey)).toEqual(["natura-BR", "natura-BR", "natura-BR-social", "natura-AR", "avon-BR"]);
  });

  test("filtro de operação e de SKU se combinam", () => {
    const { skus } = selectSkus(SKUS, parseRunOptions({ OPERATIONS_FILTER: "natura-BR,natura-BR-social", SKU_FILTER: "NATBRA-1" }));
    expect(skus.map(operationKey)).toEqual(["natura-BR", "natura-BR-social"]);
  });

  test("smoke: 1 SKU por operação e só as features de smoke (interseção com FEATURES_FILTER)", () => {
    const all = selectSkus(SKUS, parseRunOptions({ MODE: "smoke" }));
    expect(all.skus.map((s) => `${operationKey(s)}:${s.sku}`)).toEqual([
      "natura-BR:NATBRA-1",
      "natura-BR-social:NATBRA-1",
      "natura-AR:NATARG-1",
      "avon-BR:AVNBRA-1",
    ]);
    expect([...all.featuresFilter!]).toEqual(["images", "addToCart"]);

    const narrowed = selectSkus(SKUS, parseRunOptions({ MODE: "smoke", FEATURES_FILTER: "addToCart,reviews" }));
    expect([...narrowed.featuresFilter!]).toEqual(["addToCart"]);
  });

  test("agrupa por operação na ordem em que aparecem", () => {
    const groups = groupByOperation(SKUS);
    expect([...groups.entries()].map(([k, v]) => [k, v.length])).toEqual([
      ["natura-BR", 2],
      ["natura-BR-social", 1],
      ["natura-AR", 1],
      ["avon-BR", 1],
    ]);
  });

  test("Firefox só para e-commerce Natura fora do Brasil", () => {
    expect(SKUS.map(usesFirefox)).toEqual([false, false, false, true, false]);
  });
});

// ---------------------------------------------------------------------------

const feature = (key: string): FeatureConfig => FEATURES.find((f) => f.key === key)!;
const checker = async (): Promise<CheckResult> => ({ feature: "x", featureKey: "x", passed: true, status: "pass", message: "" });

test.describe("Gate de features", () => {
  const rc = (flags: Partial<RemoteConfigFlags>) => ({ capturedAt: "", locale: "pt-BR", ...flags }) as RemoteConfigFlags;

  test("flags desligam, ausência de flag obrigatória vira N/A, o resto roda", () => {
    const flags = rc({
      product_reviews: { enabled: true, filter: false, sort: true } as RemoteConfigFlags["product_reviews"],
    });
    const commerce = { capturedAt: "", couponCenter: true } as CommerceFeatureFlags;
    const gated = gateFeatures(
      [feature("reviewFilter"), feature("reviewSort"), feature("coupons"), feature("addToCart")],
      SKUS[0],
      flags,
      commerce,
      { reviewFilter: checker, reviewSort: checker, coupons: checker, addToCart: checker },
    );
    expect(gated.runnable.map((r) => r.featureConfig.key)).toEqual(["reviewSort", "addToCart"]);
    expect(gated.decided.map((d) => [d.featureKey, d.status, d.flagKey])).toEqual([
      ["reviewFilter", "disabled", "product_reviews.filter"],
      ["coupons", "na", "enable_coupons_pdp"],
    ]);
    expect(gated.runnable[0].rcCheck.flagKey).toBe("product_reviews.sort");
  });

  test("Commerce flag couponCenter=false desliga cupons mesmo com o Remote Config ligado", () => {
    const gated = gateFeatures(
      [feature("coupons")],
      SKUS[0],
      rc({ enable_coupons_pdp: true }),
      { capturedAt: "", couponCenter: false } as CommerceFeatureFlags,
      { coupons: checker },
    );
    expect(gated.decided.map((d) => [d.status, d.message])).toEqual([
      ["disabled", "Desabilitado via Commerce Feature Flag (couponCenter=false)"],
    ]);
  });

  test("feature sem checker registrado é reportada à parte", () => {
    const gated = gateFeatures([feature("addToCart")], SKUS[0], null, null, {});
    expect(gated).toEqual({ runnable: [], decided: [], missingCheckers: ["addToCart"] });
  });
});

// ---------------------------------------------------------------------------

test.describe("Veredito da PDP", () => {
  const r = (featureKey: string, status: CheckResult["status"]): CheckResult => ({
    feature: featureKey,
    featureKey,
    passed: status === "pass" || status === "warning",
    status,
    message: "",
  });

  test("N/A e desabilitado contam como ok; feature opcional não derruba a PDP", () => {
    const optional = FEATURES.find((f) => f.optional)!.key;
    expect(isPdpSuccessful([r("reviews", "na"), r("coupons", "disabled"), r(optional, "fail")], false)).toBe(true);
    expect(isPdpSuccessful([r("reviews", "fail")], false)).toBe(false);
  });

  test("endpoints estruturados e i18n são sempre obrigatórios; o legado só com ENDPOINT_MATCH", () => {
    expect(isPdpSuccessful([r("endpoint_reviews", "fail")], false)).toBe(false);
    expect(isPdpSuccessful([r("i18nKeys", "fail")], false)).toBe(false);
    expect(isPdpSuccessful([r("endpointResponse", "fail")], false)).toBe(true);
    expect(isPdpSuccessful([r("endpointResponse", "fail")], true)).toBe(false);
  });

  test("check legado de endpoint: sem chamada, com erro e ok", () => {
    expect(legacyEndpointResult("/x", []).message).toBe('Nenhuma chamada capturada para o endpoint contendo "/x"');
    const failed = legacyEndpointResult("/x", [
      { url: "u1", method: "GET", status: 200 },
      { url: "u2", method: "GET", status: 503 },
    ]);
    expect([failed.status, failed.message]).toEqual(["fail", '1/2 chamada(s) com erro (>= 400) para "/x"']);
    expect(legacyEndpointResult("/x", [{ url: "u1", method: "GET", status: 200 }]).status).toBe("pass");
  });
});
