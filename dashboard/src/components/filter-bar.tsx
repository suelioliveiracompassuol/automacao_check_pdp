'use client';

import { useMemo } from 'react';
import { Search, X, Globe, ListChecks, CheckCircle2, XCircle, type LucideIcon } from 'lucide-react';
import { CountryFlag } from './ui/country-flag';
import { ToggleButton, ToggleGroup } from './ui/toggle-group';
import { VendorLogo } from './vendor-logo';
import type { StatusFilter } from '@/lib/report';
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
  const vendors = useMemo(() => {
    const set = new Set<string>();
    for (const r of results) {
      set.add(r.vendor.charAt(0).toUpperCase() + r.vendor.slice(1).toLowerCase());
    }
    return [...set].sort();
  }, [results]);

  // Countries available for current vendor selection
  const countries = useMemo(() => {
    const set = new Set<string>();
    for (const r of results) {
      if (selectedVendor === 'all' || r.vendor.toLowerCase() === selectedVendor) {
        set.add(r.country.toUpperCase());
      }
    }
    return [...set].sort();
  }, [results, selectedVendor]);

  // Trocar a marca zera o país, pois a lista de países depende da marca.
  const selectVendor = (vendor: string) => {
    onVendorChange(vendor);
    onOperationChange('all');
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
            >
              <span className="flex items-center gap-1.5">
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
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-alert-dark hover:text-alert-dark hover:bg-alert-lightest/50 rounded-lg transition-all cursor-pointer"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            Limpar
          </button>
        )}
      </div>

      {/* Row 2: Vendor + Operations */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Vendor */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-medium-emphasis uppercase tracking-wide whitespace-nowrap">
            Marca
          </span>
          <ToggleGroup label="Filtrar por marca">
            <ToggleButton pressed={selectedVendor === 'all'} onClick={() => selectVendor('all')}>
              Todos
            </ToggleButton>
            {vendors.map((vendor) => (
              <ToggleButton
                key={vendor}
                ariaLabel={vendor}
                pressed={vendor.toLowerCase() === selectedVendor}
                onClick={() => selectVendor(vendor.toLowerCase())}
              >
                <span className="flex items-center gap-1.5">
                  <VendorLogo vendor={vendor} size="sm" />
                </span>
              </ToggleButton>
            ))}
          </ToggleGroup>
        </div>

        {/* Operations */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-medium-emphasis uppercase tracking-wide whitespace-nowrap">
            <Globe className="w-3.5 h-3.5 inline -mt-0.5 mr-0.5" aria-hidden="true" />
            País
          </span>
          <ToggleGroup label="Filtrar por país" className="flex-wrap">
            <ToggleButton
              size="sm"
              pressed={selectedOperation === 'all'}
              onClick={() => onOperationChange('all')}
            >
              Todas
            </ToggleButton>
            {countries.map((country) => (
              <ToggleButton
                key={country}
                size="sm"
                pressed={selectedOperation === country}
                onClick={() => onOperationChange(country)}
              >
                <span className="flex items-center gap-1">
                  <CountryFlag code={country} width={20} height={14} className="h-3.5 w-5" />
                  {country}
                </span>
              </ToggleButton>
            ))}
          </ToggleGroup>
        </div>
      </div>
    </div>
  );
}
