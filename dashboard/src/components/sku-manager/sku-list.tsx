'use client';

import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Channel, Country, SkuEntry, Vendor } from '@/lib/types';
import { SkuCard } from './sku-card';

interface SkuListProps {
  skus: SkuEntry[];
  onEdit: (entry: SkuEntry) => void;
  onDelete: (id: string) => void;
}

interface SkuGroup {
  key: string;
  label: string;
  match: (s: SkuEntry) => boolean;
}

const SKU_GROUPS: SkuGroup[] = [
  {
    key: 'natura-br',
    label: 'Natura Brasil',
    match: (s) => s.vendor === 'natura' && s.country === 'BR' && s.channel === 'ecommerce',
  },
  {
    key: 'natura-ar',
    label: 'Natura Argentina',
    match: (s) => s.vendor === 'natura' && s.country === 'AR' && s.channel === 'ecommerce',
  },
  {
    key: 'natura-cl',
    label: 'Natura Chile',
    match: (s) => s.vendor === 'natura' && s.country === 'CL' && s.channel === 'ecommerce',
  },
  {
    key: 'natura-co',
    label: 'Natura Colômbia',
    match: (s) => s.vendor === 'natura' && s.country === 'CO' && s.channel === 'ecommerce',
  },
  {
    key: 'natura-mx',
    label: 'Natura México',
    match: (s) => s.vendor === 'natura' && s.country === 'MX' && s.channel === 'ecommerce',
  },
  {
    key: 'natura-pe',
    label: 'Natura Peru',
    match: (s) => s.vendor === 'natura' && s.country === 'PE' && s.channel === 'ecommerce',
  },
  {
    key: 'social-br',
    label: 'Social Commerce — Minha Loja (BR) Avon/Natura',
    match: (s) => s.channel === 'socialcommerce' && s.country === 'BR',
  },
  {
    key: 'avon-br',
    label: 'Avon Brasil',
    match: (s) => s.vendor === 'avon' && s.country === 'BR' && s.channel === 'ecommerce',
  },
  {
    key: 'avon-ar',
    label: 'Avon Argentina',
    match: (s) => s.vendor === 'avon' && s.country === 'AR' && s.channel === 'ecommerce',
  },
  {
    key: 'avon-mx',
    label: 'Avon México',
    match: (s) => s.vendor === 'avon' && s.country === 'MX' && s.channel === 'ecommerce',
  },
];

const ALL_OPTION = 'all';

export function SkuList({ skus, onEdit, onDelete }: SkuListProps) {
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
      if (country !== ALL_OPTION && s.country !== country) return false;
      if (channel !== ALL_OPTION && s.channel !== channel) return false;
      if (q !== '' && !s.name.toLowerCase().includes(q) && !s.sku.toLowerCase().includes(q))
        return false;
      return true;
    });

    const assigned = new Set<string>();
    const result = SKU_GROUPS.map((group) => {
      const entries = filtered.filter((s) => {
        if (group.match(s)) {
          assigned.add(s.id);
          return true;
        }
        return false;
      });
      return { group, entries };
    }).filter(({ entries }) => entries.length > 0);

    const others = filtered.filter((s) => !assigned.has(s.id));
    if (others.length > 0) {
      result.push({
        group: { key: 'outros', label: 'Outros', match: () => false },
        entries: others,
      });
    }

    return { groups: result, totalFiltered: filtered.length };
  }, [skus, search, vendor, country, channel]);

  const selectClass =
    'rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-48 flex-1">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou SKU…"
            aria-label="Buscar SKUs"
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <select
          value={vendor}
          onChange={(e) => setVendor(e.target.value as Vendor | typeof ALL_OPTION)}
          aria-label="Filtrar por vendor"
          className={selectClass}
        >
          <option value={ALL_OPTION}>Todos os vendors</option>
          <option value="natura">Natura</option>
          <option value="avon">Avon</option>
        </select>
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value as Country | typeof ALL_OPTION)}
          aria-label="Filtrar por país"
          className={selectClass}
        >
          <option value={ALL_OPTION}>Todos os países</option>
          {(['BR', 'AR', 'CL', 'CO', 'MX', 'PE'] as Country[]).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value as Channel | typeof ALL_OPTION)}
          aria-label="Filtrar por canal"
          className={selectClass}
        >
          <option value={ALL_OPTION}>Todos os canais</option>
          <option value="ecommerce">E-commerce</option>
          <option value="socialcommerce">Social Commerce</option>
        </select>
      </div>
      <p className="text-xs text-gray-500" aria-live="polite">
        {totalFiltered} de {skus.length} SKUs
      </p>
      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 py-16 text-center">
          <p className="text-sm font-medium text-gray-500">Nenhum SKU encontrado</p>
          <p className="text-xs text-gray-400">Tente ajustar os filtros ou a busca</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map(({ group, entries }) => (
            <section key={group.key} aria-labelledby={`group-${group.key}`}>
              <div className="mb-3 flex items-center gap-3">
                <h2
                  id={`group-${group.key}`}
                  className="text-xs font-semibold uppercase tracking-widest text-gray-400"
                >
                  {group.label}
                </h2>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                  {entries.length}
                </span>
                <div className="h-px flex-1 bg-gray-100" aria-hidden="true" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {entries.map((entry) => (
                  <SkuCard key={entry.id} entry={entry} onEdit={onEdit} onDelete={onDelete} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
