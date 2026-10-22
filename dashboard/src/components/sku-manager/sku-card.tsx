'use client';

import { Edit2, Trash2 } from 'lucide-react';
import { CHANNEL_INFO, vendorInfo } from '@/lib/constants';
import type { SkuEntry } from '@/lib/types';
import { cn } from '@/lib/utils';

interface SkuCardProps {
  entry: SkuEntry;
  onEdit: (entry: SkuEntry) => void;
  onDelete: (id: string) => void;
  disabled?: boolean;
}

const tagClass = 'rounded-full px-2 py-0.5 text-[11px] font-semibold';

export function SkuCard({ entry, onEdit, onDelete, disabled }: SkuCardProps) {
  const channel = CHANNEL_INFO[entry.channel];

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-neutral-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-[11px] text-low-emphasis">{entry.id}</p>
          <h3 className="mt-0.5 text-sm font-semibold leading-snug text-highlight">{entry.name}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(entry)}
            disabled={disabled}
            className="rounded-lg p-2 text-low-emphasis transition-colors hover:bg-primary-wash hover:text-primary-darkest disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Editar ${entry.name}`}
            title={disabled ? 'Faça login para editar' : undefined}
          >
            <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(entry.id)}
            disabled={disabled}
            className="rounded-lg p-2 text-low-emphasis transition-colors hover:bg-alert-lightest/50 hover:text-alert-dark disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Excluir ${entry.name}`}
            title={disabled ? 'Faça login para excluir' : undefined}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className={cn(tagClass, 'uppercase', vendorInfo(entry.vendor).className)}>
          {entry.vendor}
        </span>
        <span className={cn(tagClass, 'bg-neutral-75 uppercase text-medium-emphasis')}>
          {entry.country}
        </span>
        <span className={cn(tagClass, channel?.className ?? 'bg-neutral-75 text-medium-emphasis')}>
          {channel?.shortLabel ?? entry.channel}
        </span>
      </div>
      {entry.expectedFeatures.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {entry.expectedFeatures.map((f) => (
            <span
              key={f}
              className="rounded bg-primary-wash px-1.5 py-0.5 text-[11px] font-medium text-primary-darkest"
            >
              {f}
            </span>
          ))}
        </div>
      )}
      {entry.slug !== undefined && (
        <p className="truncate font-mono text-[11px] text-low-emphasis">{entry.slug}</p>
      )}
    </div>
  );
}
