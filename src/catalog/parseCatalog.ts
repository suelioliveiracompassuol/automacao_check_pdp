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

export function toNumber(value: string | undefined): number | null {
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

/** One row of the export keyed by column name (every column, trimmed). */
export type CatalogRow = Record<string, string>;

/**
 * One row per PDP, with every column of the export. Master rows (NATBRA-PAI…) are only
 * groupers of variations and have no page of their own, so they are skipped; the feed also
 * repeats rows, and only the first one of each SKU is kept.
 */
export function parseCatalogRows(text: string): CatalogRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) {
    return [];
  }
  const header = lines[0].split("|").map((column) => column.trim());
  if (!header.includes(COLUMNS.sku) || !header.includes(COLUMNS.url)) {
    throw new Error(`Cabeçalho inesperado no catálogo: ${lines[0].slice(0, 200)}`);
  }

  const bySku = new Map<string, CatalogRow>();
  for (const line of lines.slice(1)) {
    const cells = line.split("|");
    const row = Object.fromEntries(header.map((column, i) => [column, (cells[i] ?? "").trim()]));
    const sku = row[COLUMNS.sku];
    if (!sku || row[COLUMNS.isMaster] === "Y" || bySku.has(sku)) {
      continue;
    }
    bySku.set(sku, row);
  }
  return [...bySku.values()];
}

/** Parses the catalog export into one entry per PDP; each variation keeps its master in `productId`. */
export function parseCatalogPsv(text: string): ParsedCatalogProduct[] {
  return parseCatalogRows(text).map(toProduct);
}

export function toProduct(row: CatalogRow): ParsedCatalogProduct {
  const get = (key: keyof typeof COLUMNS) => row[COLUMNS[key]] ?? "";
  const sku = get("sku");
  const url = get("url");
  return {
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
  };
}

/** Numeric part of the code (NATBRA-294522 → 294522); newer products get higher codes. */
export function skuNumber(sku: string): number {
  const n = Number(sku.match(/(\d+)$/)?.[1]);
  return Number.isFinite(n) ? n : 0;
}
