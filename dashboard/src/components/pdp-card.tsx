"use client";

import { Card, Badge } from "./ui/card";
import { FeatureTable } from "./feature-table";
import { RemoteConfigPanel } from "./remote-config-panel";
import { ScreenshotViewer } from "./screenshot-viewer";
import { VendorLogo } from "./vendor-logo";
import { getCountryFlag } from "@/lib/utils";
import type { PdpCheckResult } from "@/lib/types";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface PdpCardProps {
  result: PdpCheckResult;
  runId: string;
  screenshots: string[];
}

export function PdpCard({ result, runId, screenshots }: PdpCardProps) {
  const [expanded, setExpanded] = useState(!result.success);

  // Filter screenshots for this SKU
  const skuScreenshots = screenshots.filter((s) =>
    s.toLowerCase().includes(result.sku.toLowerCase().replace(/-/g, "")),
  );

  return (
    <Card
      className={`border-l-4 ${result.success ? "border-l-emerald-500" : "border-l-red-500"}`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left cursor-pointer"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xl">{result.success ? "✅" : "❌"}</span>
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">
                {result.name}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                SKU: {result.sku} ·{" "}
                {result.loadTime ? `${result.loadTime}ms` : "—"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <VendorLogo vendor={result.vendor} />
            <Badge className="bg-emerald-50 text-emerald-800">
              <img
                src={getCountryFlag(result.country)}
                alt={result.country}
                width={16}
                height={12}
                className="rounded-sm mr-1"
              />
              {result.country}
            </Badge>
            <ChevronDown
              className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </div>
        </div>
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          <div className="text-xs text-gray-500">
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline break-all"
            >
              {result.url}
            </a>
          </div>

          {result.error && (
            <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">
              {result.error}
            </div>
          )}

          <FeatureTable features={result.features} />

          <RemoteConfigPanel
            flags={result.remoteConfigFlags}
            locale={
              (result.remoteConfigFlags as Record<string, unknown>)?.locale as
                | string
                | undefined
            }
          />

          <ScreenshotViewer screenshots={skuScreenshots} runId={runId} />
        </div>
      )}
    </Card>
  );
}
