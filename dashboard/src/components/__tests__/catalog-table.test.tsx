import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { CATALOG_PAGE_SIZE, CatalogTable } from '../catalog/catalog-table';
import { makeCatalogProduct } from '@/test/fixtures';
import type { CatalogSnapshot } from '@/lib/types';

const BASE = '2026-10-30T10:00:00.000Z';

function makeSnapshot(products: CatalogSnapshot['products']): CatalogSnapshot {
  return {
    operation: 'natura-BR',
    fetchedAt: '2026-10-31T10:00:00.000Z',
    baselineAt: BASE,
    source: { file: 'catalog.psv', rows: products.length },
    products,
  };
}

const rows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);

describe('CatalogTable', () => {
  it('miniatura pede ao SFCC a imagem já no tamanho exibido; só as primeiras linhas sem lazy', () => {
    const products = Array.from({ length: 6 }, (_, i) =>
      makeCatalogProduct({
        sku: `NATBRA-${100 - i}`,
        image: `https://production.na01.natura.com/on/demandware.static/-/Sites-natura-br-storefront-catalog/default/x/Produtos/NATBRA-${100 - i}_1.jpg`,
      }),
    );
    const { container } = render(<CatalogTable snapshot={makeSnapshot(products)} />);
    const imgs = [...container.querySelectorAll('img')];
    const [first] = imgs;
    expect(first).toHaveAttribute('width', '48');
    expect(first.getAttribute('src')).toContain('/dw/image/v2/BFKR_PRD/on/demandware.static/');
    expect(first.getAttribute('src')).toContain('sw=96');
    expect(first.getAttribute('srcset')).toMatch(/sw=48&q=75 1x, .*sw=96&q=75 2x/);
    expect(imgs.map((img) => img.getAttribute('loading'))).toEqual([
      null,
      null,
      null,
      null,
      'lazy',
      'lazy',
    ]);
  });

  it('lista os PDPs com link, preço e status, marcando os novos', () => {
    render(
      <CatalogTable
        snapshot={makeSnapshot([
          makeCatalogProduct({ sku: 'NATBRA-1', name: 'Antigo', available: false }),
          makeCatalogProduct({
            sku: 'NATBRA-2',
            name: 'Lançamento',
            firstSeenAt: '2026-10-31T10:00:00.000Z',
          }),
        ])}
      />,
    );
    const [first, second] = rows();
    expect(within(first).getByText('Lançamento')).toBeInTheDocument();
    expect(within(first).getByText(/novo/)).toBeInTheDocument();
    expect(within(first).getByRole('link', { name: /NATBRA-2/ })).toHaveAttribute(
      'href',
      'https://www.natura.com.br/p/produto/NATBRA-2',
    );
    expect(within(second).queryByText(/novo/)).not.toBeInTheDocument();
    expect(within(second).getByText('Indisponível')).toBeInTheDocument();
  });

  it('filtra por busca e por "Só novos"', async () => {
    const user = userEvent.setup();
    render(
      <CatalogTable
        snapshot={makeSnapshot([
          makeCatalogProduct({ sku: 'NATBRA-1', name: 'Kaiak' }),
          makeCatalogProduct({ sku: 'NATBRA-2', name: 'Ekos' }),
        ])}
      />,
    );
    await user.type(screen.getByRole('searchbox', { name: /buscar/i }), 'kaiak');
    expect(rows()).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Só novos' }));
    expect(screen.getByText('Nenhum produto novo desde o primeiro download.')).toBeInTheDocument();
  });

  it('mostra as linhas aos poucos', async () => {
    const user = userEvent.setup();
    const products = Array.from({ length: CATALOG_PAGE_SIZE + 5 }, (_, i) =>
      makeCatalogProduct({ sku: `NATBRA-${i + 1}` }),
    );
    render(<CatalogTable snapshot={makeSnapshot(products)} />);
    expect(rows()).toHaveLength(CATALOG_PAGE_SIZE);
    await user.click(screen.getByRole('button', { name: /mostrar mais \(5 restantes\)/i }));
    expect(rows()).toHaveLength(CATALOG_PAGE_SIZE + 5);
  });
});
