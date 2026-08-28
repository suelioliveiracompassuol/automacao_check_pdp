'use client';

import { useState, useMemo } from 'react';
import type { PdpCheckResult } from '@/lib/types';
import { FilterBar } from '@/components/filter-bar';
import { PdpCard } from '@/components/pdp-card';
import { OperationFlagsGrid } from '@/components/operation-flags-grid';
import { motion } from 'framer-motion';

type FilterStatus = 'all' | 'pass' | 'fail';

interface ReportClientProps {
  results: PdpCheckResult[];
  runId: string;
  screenshots: string[];
}

export function ReportClient({ results, runId, screenshots }: ReportClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVendor, setSelectedVendor] = useState('all');
  const [selectedOperation, setSelectedOperation] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<FilterStatus>('all');

  const filteredResults = useMemo(() => {
    return results.filter((r) => {
      if (selectedVendor !== 'all' && r.vendor.toLowerCase() !== selectedVendor) {
        return false;
      }
      if (selectedOperation !== 'all') {
        if (r.country.toUpperCase() !== selectedOperation) {
          return false;
        }
      }
      if (selectedStatus === 'pass') {
        return r.success;
      }
      if (selectedStatus === 'fail') {
        return !r.success;
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesSku = r.sku.toLowerCase().includes(q);
        const matchesName = r.name?.toLowerCase().includes(q);
        if (!matchesSku && !matchesName) {
          return false;
        }
      }

      return true;
    });
  }, [results, selectedVendor, selectedOperation, selectedStatus, searchQuery]);

  return (
    <div className="space-y-6">
      <FilterBar
        results={results}
        searchQuery={searchQuery}
        selectedVendor={selectedVendor}
        selectedOperation={selectedOperation}
        selectedStatus={selectedStatus}
        onSearchChange={setSearchQuery}
        onVendorChange={setSelectedVendor}
        onOperationChange={setSelectedOperation}
        onStatusChange={setSelectedStatus}
      />
      <OperationFlagsGrid results={filteredResults} />

      {/* Results section header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Resultados por PDP</h2>
        <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
          {filteredResults.length} {filteredResults.length === 1 ? 'item' : 'itens'}
        </span>
      </div>

      <div className="space-y-3">
        {filteredResults.map((result, i) => (
          <motion.div
            key={`${result.sku}-${result.timestamp}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03, duration: 0.3 }}
          >
            <PdpCard result={result} runId={runId} screenshots={screenshots} />
          </motion.div>
        ))}
        {filteredResults.length === 0 && (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-gray-500 font-medium">Nenhum resultado encontrado</p>
            <p className="text-gray-400 text-sm mt-1">Tente ajustar os filtros ou a busca</p>
          </div>
        )}
      </div>
    </div>
  );
}
