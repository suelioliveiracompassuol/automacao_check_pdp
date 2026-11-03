import type { CatalogProduct } from "./types.js";

export type ParsedCatalogProduct = Omit<CatalogProduct, "firstSeenAt">;

/** Columns of the SFCC "retrofit" catalog export (pipe-separated, one header line). */
const COLUMNS = {
  sku: "SkuID",
  productId: "ProductID",
  isMaster: "IsMaster",
  isVariant: "IsVariant",
  isBundle: "IsBundle",
  name: "ProductName",
  productType: "ProductType",
  url: "ProductLink",
  image: "ImageLink",
  brand: "Brand",
  category: "CategoryName",
  stock: "StockLevel",
  available: "OnlineAvailability",
  regularPrice: "RegularPrice",
  salePrice: "SalePrice",
  rating: "AverageRating",
} as const;

function toNumber(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Slug of a PDP URL (`{domain}/p/{slug}/{sku}`), the same piece `buildPdpUrl` needs. */
export function slugFromPdpUrl(url: string): string {
  return url.match(/\/p\/([^/]+)\/[^/]+\/?$/)?.[1] ?? "";
}

/**
 * Parses the catalog export into one entry per PDP. Master rows (NATBRA-PAI…) are only
 * groupers of variations and have no page of their own, so they are skipped; each
 * variation keeps its master in `productId`.
 */
export function parseCatalogPsv(text: string): ParsedCatalogProduct[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) {
    return [];
  }
  const header = lines[0].split("|");
  const index = Object.fromEntries(
    Object.entries(COLUMNS).map(([key, column]) => [key, header.indexOf(column)]),
  ) as Record<keyof typeof COLUMNS, number>;
  if (index.sku < 0 || index.url < 0) {
    throw new Error(`Cabeçalho inesperado no catálogo: ${lines[0].slice(0, 200)}`);
  }

  const bySku = new Map<string, ParsedCatalogProduct>();
  for (const line of lines.slice(1)) {
    const cells = line.split("|");
    const get = (key: keyof typeof COLUMNS) => (index[key] >= 0 ? (cells[index[key]] ?? "").trim() : "");
    const sku = get("sku");
    if (!sku || get("isMaster") === "Y" || bySku.has(sku)) {
      continue;
    }
    const url = get("url");
    bySku.set(sku, {
      sku,
      productId: get("productId") || sku,
      name: get("name"),
      slug: slugFromPdpUrl(url),
      url,
      image: get("image") || undefined,
      brand: get("brand") || undefined,
      category: get("category") || undefined,
      productType: get("productType") || undefined,
      isVariant: get("isVariant") === "Y",
      isBundle: get("isBundle") === "true",
      available: get("available") === "true",
      stock: toNumber(get("stock")),
      regularPrice: toNumber(get("regularPrice")),
      salePrice: toNumber(get("salePrice")),
      rating: toNumber(get("rating")),
    });
  }
  return [...bySku.values()];
}

/** Numeric part of the code (NATBRA-294522 → 294522); newer products get higher codes. */
export function skuNumber(sku: string): number {
  const n = Number(sku.match(/(\d+)$/)?.[1]);
  return Number.isFinite(n) ? n : 0;
}
