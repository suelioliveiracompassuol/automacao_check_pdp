'use client';

import { useMemo, useState } from 'react';
import { m } from 'framer-motion';
import { FilterBar } from '@/components/filter-bar';
import { OperationFlagsGrid } from '@/components/operation-flags-grid';
import { PdpCard } from '@/components/pdp-card';
import { filterResults, NO_FILTERS, type ResultFilters } from '@/lib/report';
import type { FeatureRefIndex } from '@/lib/feature-refs';
import type { PdpCheckResult } from '@/lib/types';

/** Só os primeiros cards entram escalonados; o resto aparece junto (listas longas não esperam). */
const MAX_STAGGERED = 10;

interface ReportClientProps {
  results: PdpCheckResult[];
  runId: string;
  screenshots: string[];
  featureRefs?: FeatureRefIndex;
}

export function ReportClient({ results, runId, screenshots, featureRefs }: ReportClientProps) {
  const [filters, setFilters] = useState<ResultFilters>(NO_FILTERS);

  const setFilter =
    <K extends keyof ResultFilters>(key: K) =>
    (value: ResultFilters[K]) =>
      setFilters((prev) => ({ ...prev, [key]: value }));

  const filteredResults = useMemo(() => filterResults(results, filters), [results, filters]);

  return (
    <div className="space-y-6">
      <FilterBar
        results={results}
        searchQuery={filters.search}
        selectedVendor={filters.vendor}
        selectedOperation={filters.country}
        selectedStatus={filters.status}
        onSearchChange={setFilter('search')}
        onVendorChange={setFilter('vendor')}
        onOperationChange={setFilter('country')}
        onStatusChange={setFilter('status')}
      />
      <OperationFlagsGrid results={filteredResults} />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-highlight">Resultados por PDP</h2>
        <span
          aria-live="polite"
          className="text-xs text-medium-emphasis bg-neutral-75 px-2.5 py-1 rounded-full"
        >
          {filteredResults.length} {filteredResults.length === 1 ? 'item' : 'itens'}
        </span>
      </div>

      <div className="space-y-3">
        {filteredResults.map((result, i) => (
          <m.div
            key={`${result.sku}-${result.timestamp}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i, MAX_STAGGERED) * 0.03, duration: 0.3 }}
          >
            <PdpCard
              result={result}
              runId={runId}
              screenshots={screenshots}
              featureRefs={featureRefs}
            />
          </m.div>
        ))}
        {filteredResults.length === 0 && (
          <div className="text-center py-16">
            <div className="text-4xl mb-3" aria-hidden="true">
              🔍
            </div>
            <p className="text-medium-emphasis font-medium">Nenhum resultado encontrado</p>
            <p className="text-low-emphasis text-sm mt-1">Tente ajustar os filtros ou a busca</p>
          </div>
        )}
      </div>
    </div>
  );
}
