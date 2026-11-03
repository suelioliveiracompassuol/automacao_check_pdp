/**
 * Unit tests for the SFCC catalog export (parse + snapshot) — no browser, no network.
 */

import { test, expect } from "@playwright/test";
import { parseCatalogPsv, skuNumber, slugFromPdpUrl } from "../catalog/parseCatalog.js";
import { buildSnapshot, newProducts } from "../catalog/snapshot.js";

const HEADER =
  "SiteID|SkuID|ProductID|ProductCode|IsMaster|IsVariant|ProductName|ProductType|ProductLink|ImageLink|StockLevel|OnlineAvailability|CategoryName|RegularPrice|SalePrice|Brand|AverageRating|IsBundle";
const row = (cells: Record<string, string>) =>
  HEADER.split("|")
    .map((column) => cells[column] ?? "")
    .join("|");

const PSV = [
  HEADER,
  row({
    SiteID: "NatBrazil",
    SkuID: "NATBRA-44452",
    ProductID: "NATBRA-44452",
    IsMaster: "N",
    IsVariant: "N",
    ProductName: "Desodorante Colônia Luna 75 ml",
    ProductLink: "https://www.natura.com.br/p/desodorante-colonia-luna-75-ml/NATBRA-44452",
    StockLevel: "27239",
    OnlineAvailability: "true",
    RegularPrice: "185.9",
    SalePrice: "92.95",
    Brand: "Luna",
    AverageRating: "4.7",
    IsBundle: "false",
  }),
  row({
    SkuID: "NATBRA-PAI122122",
    ProductID: "NATBRA-PAI122122",
    IsMaster: "Y",
    IsVariant: "N",
    ProductLink: "https://www.natura.com.br/p/corretivo-una/NATBRA-PAI122122",
  }),
  row({
    SkuID: "NATBRA-122120",
    ProductID: "NATBRA-PAI122122",
    IsMaster: "N",
    IsVariant: "Y",
    ProductName: "Corretivo Una",
    ProductLink: "https://www.natura.com.br/p/corretivo-una/NATBRA-122120",
    OnlineAvailability: "false",
  }),
  "",
].join("\r\n");

test.describe("Catálogo SFCC: parse", () => {
  test("uma entrada por PDP, sem as linhas de produto pai", () => {
    const products = parseCatalogPsv(PSV);
    expect(products.map((p) => p.sku)).toEqual(["NATBRA-44452", "NATBRA-122120"]);
  });

  test("lê os campos usados pela checagem e pelo dashboard", () => {
    const [luna, variation] = parseCatalogPsv(PSV);
    expect(luna).toMatchObject({
      productId: "NATBRA-44452",
      name: "Desodorante Colônia Luna 75 ml",
      slug: "desodorante-colonia-luna-75-ml",
      brand: "Luna",
      available: true,
      stock: 27239,
      regularPrice: 185.9,
      salePrice: 92.95,
      rating: 4.7,
      isVariant: false,
      isBundle: false,
    });
    expect(variation).toMatchObject({
      productId: "NATBRA-PAI122122",
      isVariant: true,
      available: false,
      stock: null,
    });
  });

  test("falha com cabeçalho desconhecido", () => {
    expect(() => parseCatalogPsv("a|b|c\n1|2|3")).toThrow(/Cabeçalho inesperado/);
  });

  test("slug e número do código", () => {
    expect(slugFromPdpUrl("https://www.natura.com.br/p/kit-x/NATBRA-1")).toBe("kit-x");
    expect(skuNumber("NATBRA-294522")).toBe(294522);
  });
});

test.describe("Catálogo SFCC: snapshot", () => {
  const products = parseCatalogPsv(PSV);
  const source = { file: "catalog.psv", rows: 3 };

  test("o primeiro download vira a base e não tem produtos novos", () => {
    const snapshot = buildSnapshot({
      operation: "natura-BR",
      fetchedAt: "2026-10-30T10:00:00.000Z",
      products,
      source,
      previous: null,
    });
    expect(snapshot.baselineAt).toBe("2026-10-30T10:00:00.000Z");
    expect(newProducts(snapshot)).toEqual([]);
    // Maior código primeiro
    expect(snapshot.products[0].sku).toBe("NATBRA-122120");
  });

  test("SKUs que aparecem depois da base são novos e mantêm a data em que surgiram", () => {
    const base = buildSnapshot({
      operation: "natura-BR",
      fetchedAt: "2026-10-30T10:00:00.000Z",
      products: products.slice(0, 1),
      source,
      previous: null,
    });
    const next = buildSnapshot({
      operation: "natura-BR",
      fetchedAt: "2026-10-31T10:00:00.000Z",
      products,
      source,
      previous: base,
    });
    const later = buildSnapshot({
      operation: "natura-BR",
      fetchedAt: "2026-11-01T10:00:00.000Z",
      products,
      source,
      previous: next,
    });
    expect(newProducts(later).map((p) => [p.sku, p.firstSeenAt])).toEqual([
      ["NATBRA-122120", "2026-10-31T10:00:00.000Z"],
    ]);
    expect(later.baselineAt).toBe("2026-10-30T10:00:00.000Z");
  });
});
