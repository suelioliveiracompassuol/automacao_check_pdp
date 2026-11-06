/**
 * Unit tests for the catalog-only validation (quality.ts) — no browser, no network.
 */

import { test, expect } from "@playwright/test";
import type { CatalogRow } from "../catalog/parseCatalog.js";
import { CATALOG_RULES, checkCatalogQuality } from "../catalog/quality.js";
import type { CatalogRuleKey } from "../catalog/types.js";

const META = {
  operation: "natura-BR",
  fetchedAt: "2026-11-03T10:00:00.000Z",
  source: { file: "/Impex/catalog_export_retrofit.psv", rows: 1 },
};

/** A clean, available perfume; each test breaks one column. */
function row(overrides: CatalogRow = {}): CatalogRow {
  const sku = overrides.SkuID ?? "NATBRA-1";
  return {
    SkuID: sku,
    ProductID: sku,
    IsMaster: "N",
    IsVariant: "N",
    IsBundle: "false",
    ProductName: "Eau de Parfum Aura Alba Dourada 75ml",
    ProductLink: `https://www.natura.com.br/p/eau-de-parfum-aura-alba-dourada-75ml/${sku}`,
    ImageLink: "https://example.com/1.jpg",
    Description: "a união da rara Rosa Alba",
    OnlineAvailability: "true",
    RegularPrice: "329.9",
    SalePrice: "289.98",
    Discount: "39.92",
    OnSale: "true",
    "Type of Product": "eau de parfum",
    Concentration: "eau de parfum",
    Volume: "75 ml",
    "Olfactory Family": "floral",
    "Top Note": "lichia, priprioca",
    "Midle Note": "rosa alba, flor do mel",
    "Base Note": "âmbar, cumaru",
    ...overrides,
  };
}

const rulesOf = (rows: CatalogRow[]): CatalogRuleKey[] =>
  checkCatalogQuality(rows, META).issues.map((i) => i.rule);

test.describe("Catálogo: validação só com o arquivo", () => {
  test("linha coerente não gera problema", () => {
    const report = checkCatalogQuality([row()], META);
    expect(report.issues).toEqual([]);
    expect(report.checked).toBe(1);
    expect(report.rules).toBe(CATALOG_RULES);
  });

  test("tipo × concentração diferentes é erro (caso Aura Alba Dourada)", () => {
    const [issue] = checkCatalogQuality([row({ Concentration: "deo parfum" })], META).issues;
    expect(issue).toMatchObject({
      rule: "typeConcentration",
      severity: "error",
      fields: ["Type of Product", "Concentration"],
    });
    expect(issue.message).toContain('"deo parfum"');
  });

  test("sinônimos e valores genéricos não contam como conflito", () => {
    expect(rulesOf([row({ "Type of Product": "água de colônia", Concentration: "eau de cologne", ProductName: "Água de Colônia Mamãe e Bebê 100 ml", Volume: "100 ml", "Top Note": "", "Midle Note": "", "Base Note": "" })])).toEqual([]);
    expect(rulesOf([row({ "Type of Product": "deo perfume", Concentration: "deo parfum", ProductName: "Desodorante Perfume Ilía 75 ml" })])).toEqual([]);
    expect(rulesOf([row({ Concentration: "perfume" })])).toEqual([]);
    expect(rulesOf([row({ "Type of Product": "kits e combos", Concentration: "deo colônia", IsBundle: "true" })])).toEqual([]);
  });

  test("nome com outra concentração que o tipo é erro; nome com duas aceita qualquer uma", () => {
    expect(rulesOf([row({ ProductName: "Deo Parfum Ilía Dual 50 ml", Volume: "50 ml" })])).toEqual(["nameType"]);
    expect(
      rulesOf([
        row({
          ProductName: "Body Splash Desodorante Colônia Tododia 200 ml",
          "Type of Product": "body splash",
          Concentration: "body splash",
          Volume: "200 ml",
        }),
      ]),
    ).toEqual([]);
  });

  test("volume do nome diferente da coluna é erro; só a unidade diferente é alerta", () => {
    const [number] = checkCatalogQuality([row({ Volume: "100 ml" })], META).issues;
    expect(number).toMatchObject({ rule: "nameVolume", severity: "error" });
    const [unit] = checkCatalogQuality([row({ Volume: "75 g" })], META).issues;
    expect(unit).toMatchObject({ rule: "nameVolume", severity: "warning" });
    expect(rulesOf([row({ ProductName: "Óleo 1 l", Volume: "1000 ml" })])).toEqual([]);
  });

  test("desconto que não é de − por, por maior que de e promoção sem desconto", () => {
    expect(rulesOf([row({ Discount: "10" })])).toEqual(["priceDiscount"]);
    expect(rulesOf([row({ SalePrice: "400", Discount: "", OnSale: "false" })])).toEqual(["priceDiscount"]);
    expect(rulesOf([row({ SalePrice: "329.9", Discount: "0", OnSale: "true" })])).toEqual(["priceDiscount"]);
    expect(rulesOf([row({ OnSale: "false" })])).toEqual(["priceDiscount"]);
  });

  test("conteúdo faltando só conta em produto disponível", () => {
    const empty = { SalePrice: "", Discount: "", ImageLink: "", Description: "", "Product Details": "" };
    expect(rulesOf([row(empty)])).toEqual(["missingPrice", "missingImage", "missingDescription"]);
    expect(rulesOf([row({ ...empty, OnlineAvailability: "false" })])).toEqual([]);
  });

  test("perfume sem família olfativa ou sem notas não gera problema", () => {
    expect(rulesOf([row({ "Olfactory Family": "", "Top Note": "", "Midle Note": "", "Base Note": "" })])).toEqual([]);
  });

  test("nota rara a uma letra de uma comum vira alerta; pontuação e hífen não", () => {
    const common = Array.from({ length: 6 }, (_, i) => row({ SkuID: `NATBRA-${100 + i}` }));
    const report = checkCatalogQuality(
      [...common, row({ SkuID: "NATBRA-2", "Top Note": "licha, priprioca." }), row({ SkuID: "NATBRA-3", "Midle Note": "rosa-alba, flor do mel" })],
      META,
    );
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]).toMatchObject({ sku: "NATBRA-2", rule: "noteTypo", fields: ["Top Note"] });
    expect(report.issues[0].message).toBe('"licha" (seria "lichia"?)');
  });

  test("link que não termina no SKU é erro", () => {
    expect(rulesOf([row({ ProductLink: "https://www.natura.com.br/p/x/NATBRA-999" })])).toEqual(["pdpLink"]);
  });

  test("erros antes de alertas", () => {
    const report = checkCatalogQuality(
      [row({ SkuID: "NATBRA-1", Description: "" }), row({ SkuID: "NATBRA-2", Concentration: "deo colônia" })],
      META,
    );
    expect(report.issues.map((i) => i.severity)).toEqual(["error", "warning"]);
  });
});
