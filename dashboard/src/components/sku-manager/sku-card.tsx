'use client';

import { Edit2, Trash2 } from 'lucide-react';
import type { SkuEntry } from '@/lib/types';

interface SkuCardProps {
  entry: SkuEntry;
  onEdit: (entry: SkuEntry) => void;
  onDelete: (id: string) => void;
  disabled?: boolean;
}

const VENDOR_STYLES: Record<string, string> = {
  natura: 'bg-success-lightest text-success-dark',
  avon: 'bg-pink-100 text-pink-800',
};

const CHANNEL_STYLES: Record<string, string> = {
  ecommerce: 'bg-primary-lightest text-primary-dark',
  socialcommerce: 'bg-info-lightest text-info-dark',
};

export function SkuCard({ entry, onEdit, onDelete, disabled }: SkuCardProps) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border border-neutral-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-[10px] text-low-emphasis">{entry.id}</p>
          <h3 className="mt-0.5 text-sm font-semibold leading-snug text-highlight">{entry.name}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(entry)}
            disabled={disabled}
            className="rounded-lg p-1.5 text-low-emphasis transition-colors hover:bg-primary-wash hover:text-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Editar ${entry.name}`}
            title={disabled ? 'Faça login para editar' : undefined}
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(entry.id)}
            disabled={disabled}
            className="rounded-lg p-1.5 text-low-emphasis transition-colors hover:bg-alert-lightest/50 hover:text-alert-dark disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Excluir ${entry.name}`}
            title={disabled ? 'Faça login para excluir' : undefined}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${VENDOR_STYLES[entry.vendor] ?? 'bg-neutral-75 text-medium-emphasis'}`}
        >
          {entry.vendor}
        </span>
        <span className="rounded-full bg-neutral-75 px-2 py-0.5 text-[10px] font-semibold uppercase text-medium-emphasis">
          {entry.country}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${CHANNEL_STYLES[entry.channel] ?? 'bg-neutral-75 text-medium-emphasis'}`}
        >
          {entry.channel === 'socialcommerce' ? 'Social' : 'E-com'}
        </span>
      </div>
      {entry.expectedFeatures.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {entry.expectedFeatures.map((f) => (
            <span
              key={f}
              className="rounded bg-primary-wash px-1.5 py-0.5 text-[9px] font-medium text-primary-dark"
            >
              {f}
            </span>
          ))}
        </div>
      )}
      {entry.slug !== undefined && (
        <p className="truncate font-mono text-[10px] text-low-emphasis">{entry.slug}</p>
      )}
    </div>
  );
}
