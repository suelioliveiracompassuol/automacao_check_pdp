'use client';

import { Edit2, Trash2 } from 'lucide-react';
import type { SkuEntry } from '@/lib/types';

interface SkuCardProps {
  entry: SkuEntry;
  onEdit: (entry: SkuEntry) => void;
  onDelete: (id: string) => void;
}

const VENDOR_STYLES: Record<string, string> = {
  natura: 'bg-emerald-100 text-emerald-700',
  avon: 'bg-rose-100 text-rose-700',
};

const CHANNEL_STYLES: Record<string, string> = {
  ecommerce: 'bg-blue-100 text-blue-700',
  socialcommerce: 'bg-purple-100 text-purple-700',
};

export function SkuCard({ entry, onEdit, onDelete }: SkuCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-[10px] text-gray-400">{entry.id}</p>
          <h3 className="mt-0.5 text-sm font-semibold leading-snug text-gray-900">{entry.name}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(entry)}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
            aria-label={`Editar ${entry.name}`}
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(entry.id)}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
            aria-label={`Excluir ${entry.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${VENDOR_STYLES[entry.vendor] ?? 'bg-gray-100 text-gray-600'}`}
        >
          {entry.vendor}
        </span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-gray-600">
          {entry.country}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${CHANNEL_STYLES[entry.channel] ?? 'bg-gray-100 text-gray-600'}`}
        >
          {entry.channel === 'socialcommerce' ? 'Social' : 'E-com'}
        </span>
      </div>
      {entry.expectedFeatures.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {entry.expectedFeatures.map((f) => (
            <span
              key={f}
              className="rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-medium text-indigo-600"
            >
              {f}
            </span>
          ))}
        </div>
      )}
      {entry.slug !== undefined && (
        <p className="truncate font-mono text-[10px] text-gray-400">{entry.slug}</p>
      )}
    </div>
  );
}
