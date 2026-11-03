'use client';

import { useMemo, useState } from 'react';
import { ExternalLink, Search, Sparkles, X } from 'lucide-react';
import { ToggleButton, ToggleGroup } from '@/components/ui/toggle-group';
import {
  DEFAULT_CATALOG_FILTERS,
  filterCatalog,
  formatPrice,
  isNewProduct,
  type CatalogAvailability,
  type CatalogFilters,
  type CatalogKind,
} from '@/lib/catalog';
import { formatShortDate } from '@/lib/format';
import type { CatalogProduct, CatalogSnapshot } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Linhas renderizadas por vez; o catálogo do BR tem ~4 mil PDPs. */
export const CATALOG_PAGE_SIZE = 50;

const AVAILABILITY: { key: CatalogAvailability; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'available', label: 'Disponíveis' },
  { key: 'unavailable', label: 'Indisponíveis' },
];

const KINDS: { key: CatalogKind; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'product', label: 'Produtos' },
  { key: 'bundle', label: 'Kits' },
  { key: 'variant', label: 'Variações' },
];

function ProductRow({ product, isNew }: { product: CatalogProduct; isNew: boolean }) {
  const onSale =
    product.salePrice !== null &&
    product.regularPrice !== null &&
    product.salePrice < product.regularPrice;
  return (
    <tr className="border-t border-neutral-75 align-middle">
      <td className="py-2 pr-3">
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- imagem externa, export estático
          <img
            src={product.image}
            alt=""
            loading="lazy"
            className="h-12 w-12 rounded-md bg-neutral-50 object-contain"
          />
        ) : (
          <div className="h-12 w-12 rounded-md bg-neutral-50" aria-hidden="true" />
        )}
      </td>
      <td className="py-2 pr-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium text-high-emphasis">{product.name || product.sku}</span>
          {isNew && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-wash px-2 py-0.5 text-[11px] font-bold text-primary-darkest">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              novo · {formatShortDate(product.firstSeenAt)}
            </span>
          )}
        </div>
        <a
          href={product.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-mono text-xs text-medium-emphasis hover:text-primary-dark hover:underline"
        >
          {product.sku}
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
        {product.isVariant && (
          <span className="ml-2 text-xs text-low-emphasis">variação de {product.productId}</span>
        )}
      </td>
      <td className="hidden py-2 pr-3 text-xs text-medium-emphasis md:table-cell">
        <div>{product.brand ?? '—'}</div>
        <div className="text-low-emphasis">{product.category}</div>
      </td>
      <td className="py-2 pr-3 text-right text-sm whitespace-nowrap">
        <div className="font-medium text-high-emphasis">{formatPrice(product.salePrice)}</div>
        {onSale && (
          <div className="text-xs text-low-emphasis line-through">
            {formatPrice(product.regularPrice)}
          </div>
        )}
      </td>
      <td className="hidden py-2 pr-3 text-right text-sm sm:table-cell">
        {product.stock?.toLocaleString('pt-BR') ?? '—'}
      </td>
      <td className="py-2 text-right">
        <span
          className={cn(
            'inline-flex rounded-full px-2 py-0.5 text-xs font-semibold',
            product.available ? 'bg-success/10 text-success' : 'bg-alert/10 text-alert',
          )}
        >
          {product.available ? 'Disponível' : 'Indisponível'}
        </span>
      </td>
    </tr>
  );
}

export function CatalogTable({ snapshot }: { snapshot: CatalogSnapshot }) {
  const [filters, setFilters] = useState<CatalogFilters>(DEFAULT_CATALOG_FILTERS);
  const [visible, setVisible] = useState(CATALOG_PAGE_SIZE);

  const products = useMemo(() => filterCatalog(snapshot, filters), [snapshot, filters]);

  const update = (patch: Partial<CatalogFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setVisible(CATALOG_PAGE_SIZE);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block w-full lg:max-w-sm">
          <span className="sr-only">Buscar no catálogo</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-low-emphasis"
            aria-hidden="true"
          />
          <input
            type="search"
            value={filters.query}
            onChange={(e) => update({ query: e.target.value })}
            placeholder="Nome, SKU, marca ou categoria"
            className="w-full rounded-lg border border-neutral-75 bg-surface py-2 pr-9 pl-9 text-sm focus:border-primary focus:outline-none"
          />
          {filters.query && (
            <button
              type="button"
              aria-label="Limpar busca"
              onClick={() => update({ query: '' })}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-low-emphasis hover:text-high-emphasis"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup label="Filtrar por novidade">
            <ToggleButton
              size="sm"
              pressed={!filters.onlyNew}
              onClick={() => update({ onlyNew: false })}
            >
              Catálogo todo
            </ToggleButton>
            <ToggleButton
              size="sm"
              pressed={filters.onlyNew}
              onClick={() => update({ onlyNew: true })}
            >
              Só novos
            </ToggleButton>
          </ToggleGroup>
          <ToggleGroup label="Filtrar por disponibilidade">
            {AVAILABILITY.map(({ key, label }) => (
              <ToggleButton
                key={key}
                size="sm"
                pressed={filters.availability === key}
                onClick={() => update({ availability: key })}
              >
                {label}
              </ToggleButton>
            ))}
          </ToggleGroup>
          <ToggleGroup label="Filtrar por tipo">
            {KINDS.map(({ key, label }) => (
              <ToggleButton
                key={key}
                size="sm"
                pressed={filters.kind === key}
                onClick={() => update({ kind: key })}
              >
                {label}
              </ToggleButton>
            ))}
          </ToggleGroup>
        </div>
      </div>

      <p className="text-xs text-medium-emphasis" aria-live="polite">
        {products.length.toLocaleString('pt-BR')} PDP(s) · novos primeiro, depois pelo código mais
        alto
      </p>

      {products.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-75 p-6 text-center text-sm text-medium-emphasis">
          {filters.onlyNew
            ? 'Nenhum produto novo desde o primeiro download.'
            : 'Nenhum produto com esses filtros.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-low-emphasis uppercase">
              <tr>
                <th scope="col" className="w-14 py-2 pr-3">
                  <span className="sr-only">Imagem</span>
                </th>
                <th scope="col" className="py-2 pr-3">
                  Produto
                </th>
                <th scope="col" className="hidden py-2 pr-3 md:table-cell">
                  Marca / categoria
                </th>
                <th scope="col" className="py-2 pr-3 text-right">
                  Preço
                </th>
                <th scope="col" className="hidden py-2 pr-3 text-right sm:table-cell">
                  Estoque
                </th>
                <th scope="col" className="py-2 text-right">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {products.slice(0, visible).map((product) => (
                <ProductRow
                  key={product.sku}
                  product={product}
                  isNew={isNewProduct(product, snapshot.baselineAt)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {products.length > visible && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setVisible((v) => v + CATALOG_PAGE_SIZE)}
            className="rounded-lg border border-neutral-75 bg-surface px-4 py-2 text-sm font-medium text-high-emphasis shadow-tiny hover:bg-neutral-50"
          >
            Mostrar mais ({(products.length - visible).toLocaleString('pt-BR')} restantes)
          </button>
        </div>
      )}
    </div>
  );
}
