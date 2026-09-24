'use client';

import { useMemo, useState } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { ChevronDown } from 'lucide-react';
import { VendorLogo } from './vendor-logo';
import { getCountryFlag, getOperationKey } from '@/lib/utils';
import type { PdpCheckResult } from '@/lib/types';

interface OperationFlagsGridProps {
  results: PdpCheckResult[];
}

function renderValue(value: unknown): React.ReactNode {
  if (value === true) {
    return <span className="text-success-dark font-bold">✓</span>;
  }
  if (value === false) {
    return <span className="text-alert font-bold">✗</span>;
  }
  if (value === null || value === undefined) {
    return <span className="text-neutral-300">—</span>;
  }
  if (typeof value === 'object') {
    return null;
  }
  return <span className="text-high-emphasis">{String(value)}</span>;
}

// Individual review flags captured redundantly via product_reviews object — hide from table
const HIDDEN_FLAGS = new Set([
  'enable_image_and_upload_review',
  'enable_konfidency_review',
  'enable_pdp_review',
  'enable_product_card_rating',
  'enable_review_ai_summary',
  'enable_review_feedback',
  'enable_reviews_filter',
  'enable_reviews_sorting',
]);

function flattenFlags(flags: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(flags)) {
    if (key === '_raw' || key === 'capturedAt' || key === 'locale') continue;
    if (HIDDEN_FLAGS.has(key)) continue;
    if (typeof val === 'object' && val !== null) {
      const nested = flattenFlags(val as Record<string, unknown>);
      for (const [nk, nv] of Object.entries(nested)) {
        result[`${key}.${nk}`] = nv;
      }
    } else {
      result[key] = val;
    }
  }
  return result;
}

interface OperationData {
  key: string;
  vendor: string;
  country: string;
  channel?: string;
  remoteConfigFlags?: Record<string, unknown>;
  commerceFeatureFlags?: Record<string, unknown>;
}

function FlagsTable({
  title,
  icon,
  operations,
  flagsKey,
}: {
  title: string;
  icon: string;
  operations: OperationData[];
  flagsKey: 'remoteConfigFlags' | 'commerceFeatureFlags';
}) {
  const allKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const op of operations) {
      for (const k of Object.keys(flattenFlags(op[flagsKey] || {}))) {
        keys.add(k);
      }
    }
    return [...keys].sort();
  }, [operations, flagsKey]);

  if (allKeys.length === 0) return null;

  // pre-compute flattened flags per operation
  const flatByOp = operations.map((op) => flattenFlags(op[flagsKey] || {}));

  return (
    <div className="mb-6">
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-high-emphasis">
          {icon} {title}
        </h3>
        <span className="text-[10px] text-low-emphasis sm:hidden">→ arraste para o lado</span>
      </div>
      {/* Single scroll container (both axes) so the sticky header row and sticky flag column
          stay pinned together — needed for embeds with a short viewport (e.g. Google Sites
          iframe), where the table would otherwise push the flag names far below the fold. */}
      <div className="overflow-auto max-h-104 rounded-xl border border-neutral-100">
        <table className="min-w-full text-[11px] sm:text-xs border-separate border-spacing-0">
          <thead>
            <tr className="align-top">
              <th className="sticky top-0 left-0 z-30 min-w-36 max-w-44 whitespace-normal wrap-break-word border-b border-neutral-100 bg-neutral-50 px-2 py-2 text-left font-semibold text-medium-emphasis shadow-[2px_0_4px_-2px_rgba(0,0,0,0.12)]">
                Flag
              </th>
              {operations.map((op) => {
                const locale = (op.remoteConfigFlags as Record<string, unknown> | undefined)
                  ?.locale as string | undefined;
                const isSocial = op.channel === 'socialcommerce';
                return (
                  <th
                    key={op.key}
                    className="sticky top-0 z-20 min-w-15 whitespace-nowrap border-b border-neutral-100 bg-neutral-50 px-1.5 py-2 text-center"
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <VendorLogo vendor={op.vendor} size="sm" />
                      <img
                        src={getCountryFlag(op.country)}
                        alt={op.country}
                        width={14}
                        height={10}
                        className="rounded-sm"
                      />
                      {isSocial && (
                        <span className="text-[8px] font-bold px-1 py-0.5 bg-success-lightest text-success-dark rounded uppercase">
                          ML
                        </span>
                      )}
                      {flagsKey === 'remoteConfigFlags' && locale && (
                        <span className="text-[8px] text-low-emphasis font-mono font-normal">
                          {locale}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {allKeys.map((k, i) => {
              const rowBg = i % 2 === 0 ? 'bg-white' : 'bg-neutral-50';
              return (
                <tr key={k} className={`${rowBg} align-top`}>
                  <td
                    className={`sticky left-0 z-10 ${rowBg} whitespace-normal wrap-break-word border-b border-neutral-75 px-2 py-2 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.12)]`}
                  >
                    <code className="text-medium-emphasis">{k}</code>
                  </td>
                  {flatByOp.map((flat, j) => {
                    const raw = flat[k];
                    return (
                      <td
                        key={operations[j].key}
                        title={typeof raw === 'string' ? raw : undefined}
                        className="max-w-26 truncate border-b border-neutral-75 px-1.5 py-2 text-center"
                      >
                        {renderValue(raw)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function OperationFlagsGrid({ results }: OperationFlagsGridProps) {
  const operations = useMemo(() => {
    const map = new Map<string, OperationData>();
    for (const r of results) {
      const key = getOperationKey(r);
      if (map.has(key)) continue;
      if (!r.remoteConfigFlags && !r.commerceFeatureFlags) {
        continue;
      }
      map.set(key, {
        key,
        vendor: r.vendor,
        country: r.country,
        channel: r.channel,
        remoteConfigFlags: r.remoteConfigFlags,
        commerceFeatureFlags: r.commerceFeatureFlags,
      });
    }
    return [...map.values()];
  }, [results]);

  const [open, setOpen] = useState(false);

  if (operations.length === 0) {
    return null;
  }

  const rcOps = operations.filter(
    (op) => op.remoteConfigFlags && Object.keys(op.remoteConfigFlags).length > 0,
  );
  const commerceOps = operations.filter(
    (op) => op.commerceFeatureFlags && Object.keys(op.commerceFeatureFlags).length > 0,
  );

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger className="flex items-center gap-2 w-full text-left py-3 px-4 rounded-xl bg-white border border-neutral-75 shadow-sm hover:bg-neutral-50 transition-colors cursor-pointer">
        <ChevronDown
          className={`w-4 h-4 text-medium-emphasis transition-transform ${open ? 'rotate-0' : '-rotate-90'}`}
        />
        <h2 className="text-lg font-semibold text-highlight">Feature Flags por Operação</h2>
        <span className="text-xs text-medium-emphasis bg-neutral-75 px-2 py-0.5 rounded-full">
          {operations.length} operações
        </span>
      </Collapsible.Trigger>
      <Collapsible.Content className="mt-4 space-y-2">
        <FlagsTable
          title="Remote Config Flags"
          icon="🔧"
          operations={rcOps}
          flagsKey="remoteConfigFlags"
        />
        <FlagsTable
          title="Commerce Feature Flags"
          icon="🛒"
          operations={commerceOps}
          flagsKey="commerceFeatureFlags"
        />
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
