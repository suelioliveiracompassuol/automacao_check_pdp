import type { CatalogProduct, CatalogSnapshot } from './types';

export type CatalogAvailability = 'all' | 'available' | 'unavailable';
export type CatalogKind = 'all' | 'product' | 'bundle' | 'variant';

export interface CatalogFilters {
  query: string;
  availability: CatalogAvailability;
  kind: CatalogKind;
  onlyNew: boolean;
}

export const DEFAULT_CATALOG_FILTERS: CatalogFilters = {
  query: '',
  availability: 'all',
  kind: 'all',
  onlyNew: false,
};

/** Apareceu depois do primeiro download (o feed não tem data de lançamento). */
export function isNewProduct(product: CatalogProduct, baselineAt: string): boolean {
  return product.firstSeenAt > baselineAt;
}

/** Parte numérica do código (NATBRA-294522 → 294522): códigos maiores são mais recentes. */
export function skuNumber(sku: string): number {
  const n = Number(sku.match(/(\d+)$/)?.[1]);
  return Number.isFinite(n) ? n : 0;
}

function kindOf(product: CatalogProduct): Exclude<CatalogKind, 'all'> {
  if (product.isVariant) {
    return 'variant';
  }
  return product.isBundle ? 'bundle' : 'product';
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/** Filtra e ordena: novos primeiro (pela data em que surgiram), depois pelo maior código. */
export function filterCatalog(
  snapshot: CatalogSnapshot,
  filters: CatalogFilters,
): CatalogProduct[] {
  const query = normalize(filters.query.trim());
  return snapshot.products
    .filter((p) => {
      if (filters.onlyNew && !isNewProduct(p, snapshot.baselineAt)) {
        return false;
      }
      if (
        filters.availability !== 'all' &&
        p.available !== (filters.availability === 'available')
      ) {
        return false;
      }
      if (filters.kind !== 'all' && kindOf(p) !== filters.kind) {
        return false;
      }
      if (query) {
        const haystack = normalize(`${p.sku} ${p.name} ${p.brand ?? ''} ${p.category ?? ''}`);
        return haystack.includes(query);
      }
      return true;
    })
    .sort(
      (a, b) =>
        b.firstSeenAt.localeCompare(a.firstSeenAt) ||
        skuNumber(b.sku) - skuNumber(a.sku) ||
        a.sku.localeCompare(b.sku),
    );
}

export interface CatalogSummary {
  total: number;
  available: number;
  bundles: number;
  variants: number;
  newProducts: number;
}

export function summarizeCatalog(snapshot: CatalogSnapshot): CatalogSummary {
  const { products, baselineAt } = snapshot;
  return {
    total: products.length,
    available: products.filter((p) => p.available).length,
    bundles: products.filter((p) => p.isBundle && !p.isVariant).length,
    variants: products.filter((p) => p.isVariant).length,
    newProducts: products.filter((p) => isNewProduct(p, baselineAt)).length,
  };
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatPrice(value: number | null): string {
  return value === null ? '—' : BRL.format(value);
}
