'use client';

import { useMemo } from 'react';
import {
  Search,
  X,
  Globe,
  Tag,
  ListChecks,
  CheckCircle2,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { CountryFlag } from './ui/country-flag';
import { ToggleButton, ToggleGroup } from './ui/toggle-group';
import { VendorLogo } from './vendor-logo';
import { countryLabel } from '@/lib/constants';
import { brandKeyOf, filterResults, MINHA_LOJA, type StatusFilter } from '@/lib/report';
import type { PdpCheckResult } from '@/lib/types';
import { cn } from '@/lib/utils';

const STATUS_TABS: { key: StatusFilter; label: string; icon: LucideIcon; tone: string }[] = [
  { key: 'all', label: 'Todos', icon: ListChecks, tone: 'text-medium-emphasis' },
  { key: 'pass', label: 'Aprovados', icon: CheckCircle2, tone: 'text-success' },
  { key: 'fail', label: 'Reprovados', icon: XCircle, tone: 'text-alert' },
];

interface FilterBarProps {
  results: PdpCheckResult[];
  searchQuery: string;
  selectedVendor: string;
  selectedOperation: string;
  selectedStatus: StatusFilter;
  onSearchChange: (query: string) => void;
  onVendorChange: (vendor: string) => void;
  onOperationChange: (operation: string) => void;
  onStatusChange: (status: StatusFilter) => void;
}

export function FilterBar({
  results,
  searchQuery,
  selectedVendor,
  selectedOperation,
  selectedStatus,
  onSearchChange,
  onVendorChange,
  onOperationChange,
  onStatusChange,
}: FilterBarProps) {
  // Contagens de cada opção respeitando os outros filtros (busca, status e a outra dimensão),
  // para a pessoa saber quantos PDPs vai ver antes de clicar.
  const vendorOptions = useMemo(() => {
    const scope = filterResults(results, {
      search: searchQuery,
      vendor: 'all',
      country: selectedOperation,
      status: selectedStatus,
    });
    return countOptions(
      results.map(brandKeyOf),
      scope.map((r) => ({ key: brandKeyOf(r), failed: !r.success })),
      // Minha Loja por último, depois das marcas
      (a, b) => Number(a === MINHA_LOJA) - Number(b === MINHA_LOJA) || a.localeCompare(b),
    );
  }, [results, searchQuery, selectedOperation, selectedStatus]);

  const countryOptions = useMemo(() => {
    const scope = filterResults(results, {
      search: searchQuery,
      vendor: selectedVendor,
      country: 'all',
      status: selectedStatus,
    });
    return countOptions(
      results.map((r) => r.country.toUpperCase()),
      scope.map((r) => ({ key: r.country.toUpperCase(), failed: !r.success })),
    );
  }, [results, searchQuery, selectedVendor, selectedStatus]);

  // Hierarquia Marca → País: a marca é sempre clicável (mesmo com 0 PDPs no país atual) e só
  // zera o país quando ele não existe para a nova marca (ex.: Avon não tem Chile). Já os países
  // sem PDPs para a marca ficam desabilitados.
  // Trocar a marca só zera o país quando ele não existe para a nova marca (ex.: Avon não tem Chile).
  const selectVendor = (vendor: string) => {
    onVendorChange(vendor);
    if (
      selectedOperation !== 'all' &&
      vendor !== 'all' &&
      !results.some(
        (r) => brandKeyOf(r) === vendor && r.country.toUpperCase() === selectedOperation,
      )
    ) {
      onOperationChange('all');
    }
  };

  const hasActiveFilters =
    searchQuery !== '' ||
    selectedVendor !== 'all' ||
    selectedOperation !== 'all' ||
    selectedStatus !== 'all';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-neutral-75 p-4 space-y-3">
      {/* Row 1: Search + Status + Clear */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-low-emphasis"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="Buscar por SKU, nome ou URL"
            placeholder="Buscar por SKU, nome ou URL..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-neutral-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary-light transition-all"
          />
        </div>

        <ToggleGroup label="Filtrar por status">
          {STATUS_TABS.map((tab) => (
            <ToggleButton
              key={tab.key}
              pressed={selectedStatus === tab.key}
              onClick={() => onStatusChange(tab.key)}
              // Celular: as três abas dividem a largura em vez de estourar a caixa
              className="max-sm:min-w-0 max-sm:flex-1 max-sm:px-1.5 max-sm:text-xs"
            >
              <span className="flex items-center gap-1.5 max-sm:justify-center max-sm:gap-1">
                <tab.icon className={cn('h-4 w-4', tab.tone)} aria-hidden="true" />
                {tab.label}
              </span>
            </ToggleButton>
          ))}
        </ToggleGroup>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              onSearchChange('');
              onVendorChange('all');
              onOperationChange('all');
              onStatusChange('all');
            }}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-medium-emphasis hover:text-highlight hover:bg-neutral-75 rounded-lg transition-all cursor-pointer"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            Limpar
          </button>
        )}
      </div>

      {/* Row 2: Marca + País — cada grupo só aparece quando há o que escolher */}
      {(vendorOptions.length > 1 || countryOptions.length > 1) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5">
          {vendorOptions.length > 1 && (
            <div className="flex items-center gap-2">
              <GroupLabel icon={Tag}>Marca</GroupLabel>
              <ToggleGroup label="Filtrar por marca" className="flex-wrap">
                <ToggleButton
                  pressed={selectedVendor === 'all'}
                  onClick={() => selectVendor('all')}
                  className={OPTION}
                >
                  Todas
                </ToggleButton>
                {vendorOptions.map((o) => (
                  <ToggleButton
                    key={o.key}
                    ariaLabel={optionLabel(brandName(o.key), o)}
                    title={optionLabel(brandName(o.key), o)}
                    pressed={selectedVendor === o.key}
                    onClick={() => selectVendor(o.key)}
                    className={OPTION}
                  >
                    <VendorLogo vendor={o.key} size="compact" />
                    <OptionCount option={o} />
                  </ToggleButton>
                ))}
              </ToggleGroup>
            </div>
          )}

          {countryOptions.length > 1 && (
            <div className="flex items-center gap-2">
              <GroupLabel icon={Globe}>País</GroupLabel>
              <ToggleGroup label="Filtrar por país" className="flex-wrap">
                <ToggleButton
                  pressed={selectedOperation === 'all'}
                  onClick={() => onOperationChange('all')}
                  className={OPTION}
                >
                  Todos
                </ToggleButton>
                {countryOptions.map((o) => (
                  <ToggleButton
                    key={o.key}
                    ariaLabel={optionLabel(countryLabel(o.key), o)}
                    title={optionLabel(countryLabel(o.key), o)}
                    pressed={selectedOperation === o.key}
                    disabled={o.total === 0 && selectedOperation !== o.key}
                    onClick={() => onOperationChange(o.key)}
                    className={OPTION}
                  >
                    <CountryFlag code={o.key} width={20} height={14} className="h-3.5 w-5" />
                    {o.key}
                    <OptionCount option={o} />
                  </ToggleButton>
                ))}
              </ToggleGroup>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Mesma altura e alinhamento para as opções de Marca e País. */
const OPTION = 'flex h-8 items-center gap-1.5 text-sm';

interface FilterOption {
  key: string;
  /** PDPs com os outros filtros aplicados */
  total: number;
  failed: number;
}

/** Todas as opções do relatório em ordem alfabética, com as contagens do escopo atual. */
function countOptions(
  allKeys: string[],
  scoped: { key: string; failed: boolean }[],
  compare?: (a: string, b: string) => number,
): FilterOption[] {
  return [...new Set(allKeys)].sort(compare).map((key) => {
    const items = scoped.filter((s) => s.key === key);
    return { key, total: items.length, failed: items.filter((s) => s.failed).length };
  });
}

const brandName = (key: string) =>
  key === MINHA_LOJA ? 'Minha Loja' : key.charAt(0).toUpperCase() + key.slice(1);

function optionLabel(name: string, o: FilterOption): string {
  const pdps = `${o.total} ${o.total === 1 ? 'PDP' : 'PDPs'}`;
  return o.failed > 0 ? `${name}: ${pdps}, ${o.failed} com falha` : `${name}: ${pdps}`;
}

function OptionCount({ option }: { option: FilterOption }) {
  return (
    // "(4)" ou, com falhas, "(4 · ✗1)"
    <span aria-hidden="true" className="flex items-center text-xs text-low-emphasis tabular-nums">
      ({option.total}
      {option.failed > 0 && (
        <>
          <span className="mx-1">·</span>
          <span className="flex items-center gap-0.5 font-semibold text-alert-dark">
            <XCircle className="h-3 w-3" />
            {option.failed}
          </span>
        </>
      )}
      )
    </span>
  );
}

function GroupLabel({ icon: Icon, children }: { icon: LucideIcon; children: string }) {
  return (
    <span className="flex items-center gap-1 text-xs font-medium tracking-wide whitespace-nowrap text-medium-emphasis uppercase">
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {children}
    </span>
  );
}
