"use client";

import React, { useState } from "react";
import { SkuResult } from "@/types/report";
import { Settings, ShoppingCart, ChevronDown, ChevronUp } from "lucide-react";
import Image from "next/image";

interface FeatureFlagsProps {
  results: SkuResult[];
}

export function FeatureFlags({ results }: FeatureFlagsProps) {
  const [expandedOp, setExpandedOp] = useState<string | null>(null);

  // Extract unique operations and their flags
  const operations = new Map<
    string,
    {
      vendor: string;
      country: string;
      channel?: string;
      remoteConfigFlags?: Record<string, unknown>;
      commerceFeatureFlags?: Record<string, unknown>;
    }
  >();

  for (const result of results) {
    const channel = result.channel ?? "ecommerce";
    const key = `${result.vendor}/${result.country}/${channel}`;
    if (!operations.has(key)) {
      operations.set(key, {
        vendor: result.vendor,
        country: result.country,
        channel,
        remoteConfigFlags: result.remoteConfigFlags,
        commerceFeatureFlags: result.commerceFeatureFlags,
      });
    } else {
      const op = operations.get(key)!;
      if (!op.remoteConfigFlags && result.remoteConfigFlags) {
        op.remoteConfigFlags = result.remoteConfigFlags;
      }
      if (!op.commerceFeatureFlags && result.commerceFeatureFlags) {
        op.commerceFeatureFlags = result.commerceFeatureFlags;
      }
    }
  }

  if (operations.size === 0) return null;

  const toggleExpand = (opKey: string) => {
    setExpandedOp(expandedOp === opKey ? null : opKey);
  };

  const formatValue = (v: unknown): React.ReactNode => {
    if (v === true) {
      return <span className="text-green-600 font-bold">✓</span>;
    }
    if (v === false) {
      return <span className="text-red-600 font-bold">✗</span>;
    }
    if (v === undefined || v === null) {
      return <span className="text-gray-400">-</span>;
    }
    if (typeof v === "object") {
      return <span className="text-gray-700">{JSON.stringify(v)}</span>;
    }
    return <span className="text-gray-700">{String(v)}</span>;
  };

  const renderFlagsSection = (
    title: string,
    icon: React.ReactNode,
    flags: Record<string, unknown> | undefined,
    locale?: string,
  ) => {
    if (!flags) {
      return (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg text-sm text-gray-500 italic">
          {title} não capturado
        </div>
      );
    }

    // Filter out internal properties like _raw, capturedAt, locale
    const displayFlags = Object.entries(flags).filter(
      ([key]) => !["_raw", "capturedAt", "locale"].includes(key),
    );

    if (displayFlags.length === 0) {
      return (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg text-sm text-gray-500 italic">
          Nenhuma flag capturada para {title}
        </div>
      );
    }

    return (
      <div className="mt-4">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
          {icon}
          {title} ({displayFlags.length} capturadas)
          {locale && (
            <span className="text-gray-500 font-normal">
              - locale: {locale}
            </span>
          )}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {displayFlags.map(([key, value]) => (
            <div
              key={key}
              className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-100 text-xs"
            >
              <code
                className="text-gray-700 bg-white px-1.5 py-0.5 rounded border border-gray-200 truncate max-w-[70%]"
                title={key}
              >
                {key}
              </code>
              <div className="ml-2 shrink-0">{formatValue(value)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">
        🔧 Feature Flags por Operação
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from(operations.entries()).map(([key, op]) => {
          const isSocialCommerce = op.channel === "socialcommerce";
          const isExpanded = expandedOp === key;

          return (
            <div
              key={key}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
            >
              <button
                onClick={() => toggleExpand(key)}
                className="w-full p-4 flex items-center justify-between bg-white hover:bg-gray-50 transition-colors text-left"
              >
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 capitalize">
                      {op.vendor} / {op.country}
                    </h3>
                    {isSocialCommerce && (
                      <span className="text-xs font-medium text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                        Minha Loja
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 capitalize">
                      {op.vendor}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                      <Image
                        src={`https://flagcdn.com/20x15/${op.country.toLowerCase()}.png`}
                        alt={op.country}
                        width={20}
                        height={15}
                        className="mr-1.5 w-4 h-3 object-cover rounded-sm"
                      />
                      {op.country}
                    </span>
                  </div>
                </div>
                <div className="text-gray-400">
                  {isExpanded ? (
                    <ChevronUp size={24} />
                  ) : (
                    <ChevronDown size={24} />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="p-4 border-t border-gray-100 bg-white">
                  {renderFlagsSection(
                    "Remote Config Flags",
                    <Settings size={16} className="text-blue-500" />,
                    op.remoteConfigFlags,
                    op.remoteConfigFlags?.locale as string,
                  )}

                  <div className="my-6 border-t border-gray-100"></div>

                  {renderFlagsSection(
                    "Commerce Feature Flags",
                    <ShoppingCart size={16} className="text-orange-500" />,
                    op.commerceFeatureFlags,
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
