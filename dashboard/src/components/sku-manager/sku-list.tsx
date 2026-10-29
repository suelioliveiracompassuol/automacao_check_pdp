'use client';

import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { OperationGroupHeader } from '@/components/operation-group-header';
import { fieldControlClass } from '@/components/ui/form-field';
import { CHANNEL_INFO, CHANNELS, COUNTRIES, VENDOR_INFO, VENDORS } from '@/lib/constants';
import { groupByOperation } from '@/lib/operation-groups';
import type { Channel, Country, SkuEntry, Vendor } from '@/lib/types';
import { cn } from '@/lib/utils';
import { SkuCard } from './sku-card';

interface SkuListProps {
  skus: SkuEntry[];
  onEdit: (entry: SkuEntry) => void;
  onDelete: (id: string) => void;
  disabled?: boolean;
}

const ALL_OPTION = 'all';

export function SkuList({ skus, onEdit, onDelete, disabled }: SkuListProps) {
  const [search, setSearch] = useState('');
  const [vendor, setVendor] = useState<Vendor | typeof ALL_OPTION>(ALL_OPTION);
  const [country, setCountry] = useState<Country | typeof ALL_OPTION>(ALL_OPTION);
  const [channel, setChannel] = useState<Channel | typeof ALL_OPTION>(ALL_OPTION);

  const { groups, totalFiltered } = useMemo(() => {
    const q = search.toLowerCase().trim();

    const filtered = skus.filter((s) => {
      if (vendor !== ALL_OPTION && s.vendor !== vendor) {
        return false;
      }
      if (country !== ALL_OPTION && s.country !== country) {
        return false;
      }
      if (channel !== ALL_OPTION && s.channel !== channel) {
        return false;
      }
      if (q !== '' && !s.name.toLowerCase().includes(q) && !s.sku.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });

    return { groups: groupByOperation(filtered, (s) => s), totalFiltered: filtered.length };
  }, [skus, search, vendor, country, channel]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-48 flex-1">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-low-emphasis"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou SKU…"
            aria-label="Buscar SKUs"
            className={cn(fieldControlClass, 'w-full pl-9')}
          />
        </div>
        <select
          value={vendor}
          onChange={(e) => setVendor(e.target.value as Vendor | typeof ALL_OPTION)}
          aria-label="Filtrar por vendor"
          className={fieldControlClass}
        >
          <option value={ALL_OPTION}>Todos os vendors</option>
          {VENDORS.map((v) => (
            <option key={v} value={v}>
              {VENDOR_INFO[v].label}
            </option>
          ))}
        </select>
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value as Country | typeof ALL_OPTION)}
          aria-label="Filtrar por país"
          className={fieldControlClass}
        >
          <option value={ALL_OPTION}>Todos os países</option>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value as Channel | typeof ALL_OPTION)}
          aria-label="Filtrar por canal"
          className={fieldControlClass}
        >
          <option value={ALL_OPTION}>Todos os canais</option>
          {CHANNELS.map((ch) => (
            <option key={ch} value={ch}>
              {CHANNEL_INFO[ch].label}
            </option>
          ))}
        </select>
      </div>
      <p className="text-xs text-medium-emphasis" aria-live="polite">
        {totalFiltered} de {skus.length} SKUs
      </p>
      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-100 py-16 text-center">
          <p className="text-sm font-medium text-medium-emphasis">Nenhum SKU encontrado</p>
          <p className="text-xs text-low-emphasis">Tente ajustar os filtros ou a busca</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map((group) => (
            <section key={group.key} aria-labelledby={`group-${group.key}`}>
              <OperationGroupHeader
                groupKey={group.key}
                label={group.label}
                count={group.items.length}
                as="h2"
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {group.items.map((entry) => (
                  <SkuCard
                    key={entry.id}
                    entry={entry}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    disabled={disabled}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
