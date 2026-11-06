import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeCatalogProduct } from '@/test/fixtures';
import type { CatalogSnapshot } from '@/lib/types';

const data = vi.hoisted(() => ({ snapshot: null as CatalogSnapshot | null }));
vi.mock('@/lib/data', () => ({ getCatalog: () => data.snapshot }));

import CatalogPage from '../catalogo/page';

const BASE = '2026-10-30T10:00:00.000Z';

describe('CatalogPage', () => {
  beforeEach(() => {
    data.snapshot = null;
  });

  it('sem download, explica como gerar o catálogo', () => {
    render(<CatalogPage />);
    expect(screen.getByRole('heading', { name: 'Catálogo' })).toBeInTheDocument();
    expect(screen.getByText('npm run catalog')).toBeInTheDocument();
  });

  it('no primeiro download avisa que ainda não há novos', () => {
    data.snapshot = {
      operation: 'natura-BR',
      fetchedAt: BASE,
      baselineAt: BASE,
      source: { file: '/Impex/mccfeeds/NatBrazil/catalog_export_retrofit.psv', rows: 3 },
      products: [makeCatalogProduct(), makeCatalogProduct({ sku: 'NATBRA-2', isBundle: true })],
    };
    render(<CatalogPage />);
    expect(screen.getByRole('heading', { name: 'Catálogo Natura BR' })).toBeInTheDocument();
    expect(screen.getByText(/catalog_export_retrofit\.psv/)).toBeInTheDocument();
    expect(screen.getByText(/Este é o primeiro download/)).toBeInTheDocument();
    const summary = within(screen.getByRole('region', { name: 'Resumo do catálogo' }));
    expect(summary.getByText('PDPs').nextSibling).toHaveTextContent('2');
    expect(summary.getByText('Kits').nextSibling).toHaveTextContent('1');
  });
});
