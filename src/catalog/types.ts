/** One PDP of the SFCC catalog export (a standalone product, kit or variation). */
export interface CatalogProduct {
  /** Code used in the PDP URL and by the monitor (e.g. NATBRA-44452). */
  sku: string;
  /** Master product for variations (NATBRA-PAI…), otherwise the SKU itself. */
  productId: string;
  name: string;
  slug: string;
  url: string;
  image?: string;
  brand?: string;
  category?: string;
  productType?: string;
  isVariant: boolean;
  isBundle: boolean;
  /** OnlineAvailability: the PDP can be bought. */
  available: boolean;
  stock: number | null;
  regularPrice: number | null;
  salePrice: number | null;
  rating: number | null;
  /**
   * When the SKU first showed up in a download. The export has no launch date, so new
   * products are the ones that appear after the first download (`baselineAt`).
   */
  firstSeenAt: string;
}

export interface CatalogSnapshot {
  /** vendor-COUNTRY, e.g. natura-BR. */
  operation: string;
  fetchedAt: string;
  /** First download of this operation: SKUs seen then are the existing catalog, not launches. */
  baselineAt: string;
  source: {
    file: string;
    /** Last-Modified of the export on WebDAV (the feed is regenerated during the day). */
    lastModified?: string;
    /** Rows in the file, master rows included. */
    rows: number;
  };
  products: CatalogProduct[];
}
