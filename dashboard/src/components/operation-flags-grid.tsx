"use client";

import { useMemo, useState } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { ChevronDown } from "lucide-react";
import { Card } from "./ui/card";
import { VendorLogo } from "./vendor-logo";
import { getCountryFlag, getOperationKey } from "@/lib/utils";
import type { PdpCheckResult } from "@/lib/types";

interface OperationFlagsGridProps {
  results: PdpCheckResult[];
}

// Category mapping for Remote Config flags
const RC_CATEGORIES: Record<string, { label: string; icon: string }> = {
  product_reviews: { label: "Reviews (product_reviews)", icon: "📝" },
};

function renderValue(value: unknown): React.ReactNode {
  if (value === true) {
    return <span className="text-emerald-600 font-bold">✓</span>;
  }
  if (value === false) {
    return <span className="text-red-500 font-bold">✗</span>;
  }
  if (value === null || value === undefined) {
    return <span className="text-gray-400">-</span>;
  }
  if (typeof value === "object") {
    return null;
  }
  return <span className="text-gray-700 text-xs">{String(value)}</span>;
}

interface FlagsSectionProps {
  title: string;
  flags: Record<string, unknown>;
  count: number;
}

function FlagsSection({ title, flags, count }: FlagsSectionProps) {
  const [open, setOpen] = useState(false);

  // Separate nested (category) and flat entries
  const nested = Object.entries(flags).filter(
    ([key, val]) =>
      key !== "_raw" &&
      key !== "capturedAt" &&
      key !== "locale" &&
      typeof val === "object" &&
      val !== null,
  );
  const flat = Object.entries(flags).filter(
    ([key, val]) =>
      key !== "_raw" &&
      key !== "capturedAt" &&
      key !== "locale" &&
      typeof val !== "object",
  );

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger className="flex items-center gap-2 w-full text-left py-2.5 px-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700 cursor-pointer">
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform shrink-0 ${open ? "rotate-0" : "-rotate-90"}`}
        />
        <span>{title}</span>
        <span className="text-gray-400 font-normal text-xs ml-auto">
          ({count} capturadas)
        </span>
      </Collapsible.Trigger>

      <Collapsible.Content className="mt-2 space-y-3 pl-2">
        {/* Nested categories (e.g. product_reviews) */}
        {nested.map(([category, obj]) => {
          const cat = RC_CATEGORIES[category];
          const entries = Object.entries(obj as Record<string, unknown>).filter(
            ([, v]) => typeof v !== "object",
          );
          // Also handle nested-nested (e.g. recommendation.enabled)
          const nestedInner = Object.entries(
            obj as Record<string, unknown>,
          ).filter(([, v]) => typeof v === "object" && v !== null);

          return (
            <div
              key={category}
              className="border border-gray-100 rounded-lg p-3"
            >
              <h4 className="text-xs font-semibold text-gray-600 mb-2">
                {cat?.icon || "📁"} {cat?.label || category}
              </h4>
              <div className="space-y-1">
                {entries.map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-center justify-between py-1 px-2 border-b border-gray-50 last:border-0"
                  >
                    <code className="text-xs text-gray-600">{k}</code>
                    {renderValue(v)}
                  </div>
                ))}
                {nestedInner.map(([nk, nv]) =>
                  Object.entries(nv as Record<string, unknown>).map(
                    ([ik, iv]) => (
                      <div
                        key={`${nk}.${ik}`}
                        className="flex items-center justify-between py-1 px-2 border-b border-gray-50 last:border-0"
                      >
                        <code className="text-xs text-gray-600">
                          {nk}.{ik}
                        </code>
                        {renderValue(iv)}
                      </div>
                    ),
                  ),
                )}
              </div>
            </div>
          );
        })}

        {/* Flat PDP-related flags grouped by category */}
        {flat.length > 0 && (
          <div className="border border-gray-100 rounded-lg p-3">
            <h4 className="text-xs font-semibold text-gray-600 mb-2">
              🛍️ PDP Features
            </h4>
            <div className="space-y-1">
              {flat.map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center justify-between py-1 px-2 border-b border-gray-50 last:border-0"
                >
                  <code className="text-xs text-gray-600">{k}</code>
                  {renderValue(v)}
                </div>
              ))}
            </div>
          </div>
        )}
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

interface OperationData {
  key: string;
  vendor: string;
  country: string;
  channel?: string;
  remoteConfigFlags?: Record<string, unknown>;
  commerceFeatureFlags?: Record<string, unknown>;
}

export function OperationFlagsGrid({ results }: OperationFlagsGridProps) {
  const operations = useMemo(() => {
    const map = new Map<string, OperationData>();
    for (const r of results) {
      const key = getOperationKey(r);
      if (map.has(key)) {
        continue;
      } // Take first per operation
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

  if (operations.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Feature Flags por Operação
        </h2>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
          {operations.length} operações
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {operations.map((op) => {
          const rcFlags = op.remoteConfigFlags || {};
          const commerceFlags = op.commerceFeatureFlags || {};
          const rcCount = Object.keys(rcFlags).filter(
            (k) => k !== "_raw" && k !== "capturedAt",
          ).length;
          const commerceCount = Object.keys(commerceFlags).filter(
            (k) => k !== "_raw" && k !== "capturedAt",
          ).length;
          const locale = (rcFlags as Record<string, unknown>).locale as
            | string
            | undefined;
          const isSocial = op.channel === "socialcommerce";

          return (
            <Card key={op.key} className="space-y-3">
              {/* Operation Header */}
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 capitalize">
                  {op.vendor} / {op.country}
                  {isSocial && (
                    <span className="text-xs text-gray-400 font-normal ml-1">
                      (Minha Loja)
                    </span>
                  )}
                </h3>
                <div className="flex items-center gap-2">
                  <VendorLogo vendor={op.vendor} />
                  <img
                    src={getCountryFlag(op.country)}
                    alt={op.country}
                    width={20}
                    height={15}
                    className="rounded-sm"
                  />
                  <span className="text-xs font-semibold text-gray-600">
                    {op.country}
                  </span>
                  {isSocial && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded uppercase">
                      Minha Loja
                    </span>
                  )}
                </div>
              </div>

              {/* Remote Config */}
              {rcCount > 0 && (
                <FlagsSection
                  title={`🔧 Remote Config Flags (${rcCount} capturadas) - locale: ${locale || "?"}`}
                  flags={rcFlags}
                  count={rcCount}
                />
              )}

              {/* Commerce Feature Flags */}
              {commerceCount > 0 && (
                <FlagsSection
                  title={`🛒 Commerce Feature Flags`}
                  flags={commerceFlags}
                  count={commerceCount}
                />
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
