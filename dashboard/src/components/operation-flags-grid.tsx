"use client";

import { useMemo, useState } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { ChevronDown } from "lucide-react";
import { VendorLogo } from "./vendor-logo";
import { getCountryFlag, getOperationKey } from "@/lib/utils";
import type { PdpCheckResult } from "@/lib/types";

interface OperationFlagsGridProps {
  results: PdpCheckResult[];
}

function renderValue(value: unknown): React.ReactNode {
  if (value === true) { return <span className="text-emerald-600 font-bold">✓</span>; }
  if (value === false) { return <span className="text-red-500 font-bold">✗</span>; }
  if (value === null || value === undefined) { return <span className="text-gray-300">—</span>; }
  if (typeof value === "object") { return null; }
  return <span className="text-gray-700 text-xs">{String(value)}</span>;
}

// Individual review flags captured redundantly via product_reviews object — hide from table
const HIDDEN_FLAGS = new Set([
  "enable_image_and_upload_review",
  "enable_konfidency_review",
  "enable_pdp_review",
  "enable_product_card_rating",
  "enable_review_ai_summary",
  "enable_review_feedback",
  "enable_reviews_filter",
  "enable_reviews_sorting",
]);

function flattenFlags(flags: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(flags)) {
    if (key === "_raw" || key === "capturedAt" || key === "locale") continue;
    if (HIDDEN_FLAGS.has(key)) continue;
    if (typeof val === "object" && val !== null) {
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
  flagsKey: "remoteConfigFlags" | "commerceFeatureFlags";
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
      <h3 className="text-sm font-semibold text-gray-700 mb-2">
        {icon} {title}
      </h3>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 align-top">
              <th className="text-left px-3 py-2 font-semibold text-gray-600 sticky left-0 bg-gray-50 min-w-[200px] z-10">
                Flag
              </th>
              {operations.map((op) => {
                const locale = (op.remoteConfigFlags as Record<string, unknown> | undefined)?.locale as string | undefined;
                const isSocial = op.channel === "socialcommerce";
                return (
                  <th key={op.key} className="px-3 py-2 text-center whitespace-nowrap">
                    <div className="flex flex-col items-center  gap-0.5">
                      <VendorLogo vendor={op.vendor} />
                      <img
                        src={getCountryFlag(op.country)}
                        alt={op.country}
                        width={16}
                        height={12}
                        className="rounded-sm"
                      />

                      {isSocial && (
                        <span className="text-[9px] font-bold px-1 py-0.5 bg-emerald-100 text-emerald-700 rounded uppercase">
                          ML
                        </span>
                      )}
                      {flagsKey === "remoteConfigFlags" && locale && (
                        <span className="text-[9px] text-gray-400 font-mono font-normal">
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
            {allKeys.map((k, i) => (
              <tr
                key={k}
                className={`border-b border-gray-100 last:border-0 align-top ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}
              >
                <td className="px-3 py-2 sticky left-0 bg-inherit z-10">
                  <code className="text-gray-600">{k}</code>
                </td>
                {flatByOp.map((flat, j) => (
                  <td key={operations[j].key} className="px-3 py-2 text-center">
                    {renderValue(flat[k])}
                  </td>
                ))}
              </tr>
            ))}
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

  const rcOps = operations.filter((op) => op.remoteConfigFlags && Object.keys(op.remoteConfigFlags).length > 0);
  const commerceOps = operations.filter((op) => op.commerceFeatureFlags && Object.keys(op.commerceFeatureFlags).length > 0);

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger className="flex items-center gap-2 w-full text-left py-3 px-4 rounded-xl bg-white border border-gray-100 shadow-sm hover:bg-gray-50 transition-colors cursor-pointer">
        <ChevronDown
          className={`w-4 h-4 text-gray-500 transition-transform ${open ? "rotate-0" : "-rotate-90"}`}
        />
        <h2 className="text-lg font-semibold text-gray-900">
          Feature Flags por Operação
        </h2>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
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
