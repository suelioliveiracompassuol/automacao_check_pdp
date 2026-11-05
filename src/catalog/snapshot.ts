import type { CatalogProduct, CatalogSnapshot } from "./types.js";
import { skuNumber, type ParsedCatalogProduct } from "./parseCatalog.js";

/**
 * Builds the new snapshot keeping each SKU's `firstSeenAt` from the previous one. SKUs not
 * in the previous snapshot are stamped with this download's time; on the first download
 * that time is also the baseline, so nothing counts as new yet.
 */
export function buildSnapshot(opts: {
  operation: string;
  fetchedAt: string;
  products: ParsedCatalogProduct[];
  source: CatalogSnapshot["source"];
  previous: CatalogSnapshot | null;
}): CatalogSnapshot {
  const { operation, fetchedAt, previous } = opts;
  const seen = new Map(previous?.products.map((p) => [p.sku, p.firstSeenAt]));
  const products = opts.products
    .map((p) => ({ ...p, firstSeenAt: seen.get(p.sku) ?? fetchedAt }))
    .sort((a, b) => skuNumber(b.sku) - skuNumber(a.sku) || a.sku.localeCompare(b.sku));
  return {
    operation,
    fetchedAt,
    baselineAt: previous?.baselineAt ?? fetchedAt,
    source: opts.source,
    products,
  };
}

/** Products that showed up after the first download, newest first. */
export function newProducts(snapshot: CatalogSnapshot): CatalogProduct[] {
  return snapshot.products
    .filter((p) => p.firstSeenAt > snapshot.baselineAt)
    .sort((a, b) => b.firstSeenAt.localeCompare(a.firstSeenAt) || skuNumber(b.sku) - skuNumber(a.sku));
}
