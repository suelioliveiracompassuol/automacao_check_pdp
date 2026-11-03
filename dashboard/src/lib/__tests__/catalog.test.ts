import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CATALOG_FILTERS,
  filterCatalog,
  formatPrice,
  isNewProduct,
  skuNumber,
  summarizeCatalog,
} from '../catalog';
import { makeCatalogProduct } from '@/test/fixtures';
import type { CatalogProduct, CatalogSnapshot } from '../types';

const BASE = '2026-10-30T10:00:00.000Z';
const LATER = '2026-10-31T10:00:00.000Z';

const snapshot: CatalogSnapshot = {
  operation: 'natura-BR',
  fetchedAt: LATER,
  baselineAt: BASE,
  source: { file: '/Impex/catalog_export_retrofit.psv', rows: 5 },
  products: [
    makeCatalogProduct({ sku: 'NATBRA-500', name: 'Kit Ekos', isBundle: true, brand: 'Ekos' }),
    makeCatalogProduct({ sku: 'NATBRA-10', name: 'Batom Una', firstSeenAt: LATER }),
    makeCatalogProduct({ sku: 'NATBRA-900', name: 'Perfume Lúna', available: false }),
    makeCatalogProduct({ sku: 'NATBRA-77', productId: 'NATBRA-PAI77', isVariant: true }),
  ],
};

const skus = (products: CatalogProduct[]) => products.map((p) => p.sku);

describe('catálogo', () => {
  it('novos primeiro, depois pelo maior código', () => {
    expect(skus(filterCatalog(snapshot, DEFAULT_CATALOG_FILTERS))).toEqual([
      'NATBRA-10',
      'NATBRA-900',
      'NATBRA-500',
      'NATBRA-77',
    ]);
  });

  it('só novos', () => {
    expect(skus(filterCatalog(snapshot, { ...DEFAULT_CATALOG_FILTERS, onlyNew: true }))).toEqual([
      'NATBRA-10',
    ]);
    expect(isNewProduct(snapshot.products[0], BASE)).toBe(false);
  });

  it('filtra por disponibilidade e tipo', () => {
    expect(
      skus(filterCatalog(snapshot, { ...DEFAULT_CATALOG_FILTERS, availability: 'unavailable' })),
    ).toEqual(['NATBRA-900']);
    expect(skus(filterCatalog(snapshot, { ...DEFAULT_CATALOG_FILTERS, kind: 'bundle' }))).toEqual([
      'NATBRA-500',
    ]);
    expect(skus(filterCatalog(snapshot, { ...DEFAULT_CATALOG_FILTERS, kind: 'variant' }))).toEqual([
      'NATBRA-77',
    ]);
    expect(skus(filterCatalog(snapshot, { ...DEFAULT_CATALOG_FILTERS, kind: 'product' }))).toEqual([
      'NATBRA-10',
      'NATBRA-900',
    ]);
  });

  it('busca por nome sem acento, SKU ou marca', () => {
    const search = (query: string) =>
      skus(filterCatalog(snapshot, { ...DEFAULT_CATALOG_FILTERS, query }));
    expect(search('luna')).toEqual(['NATBRA-900']);
    expect(search('natbra-50')).toEqual(['NATBRA-500']);
    expect(search('EKOS')).toEqual(['NATBRA-500']);
  });

  it('resumo', () => {
    expect(summarizeCatalog(snapshot)).toEqual({
      total: 4,
      available: 3,
      bundles: 1,
      variants: 1,
      newProducts: 1,
    });
  });

  it('código e preço', () => {
    expect(skuNumber('NATBRA-294522')).toBe(294522);
    expect(skuNumber('sem-numero-x')).toBe(0);
    expect(formatPrice(null)).toBe('—');
    expect(formatPrice(92.95).replace(/\s/g, ' ')).toBe('R$ 92,95');
  });
});
