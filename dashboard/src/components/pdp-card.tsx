"use client";

import { Card, Badge } from "./ui/card";
import { FeatureTable } from "./feature-table";
import { RemoteConfigPanel } from "./remote-config-panel";
import { ScreenshotViewer } from "./screenshot-viewer";
import { VendorLogo } from "./vendor-logo";
import { getCountryFlag } from "@/lib/utils";
import type { PdpCheckResult } from "@/lib/types";
import { useState } from "react";
import { ChevronDown, ExternalLink, Clock, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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

  const testableFeatures = result.features.filter((f) => f.status !== "na");
  const passedCount = testableFeatures.filter(
    (f) => f.passed || f.status === "disabled",
  ).length;
  const totalFeatures = testableFeatures.length;
  const passPercentage =
    totalFeatures > 0 ? Math.round((passedCount / totalFeatures) * 100) : 0;

  return (
    <Card
      className={`border-l-4 overflow-hidden transition-all duration-200 hover:shadow-md ${result.success
        ? "border-l-emerald-500 hover:border-l-emerald-600"
        : "border-l-red-500 hover:border-l-red-600"
        }`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left cursor-pointer"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${result.success ? "bg-emerald-100" : "bg-red-100"
                }`}
            >
              <span className="text-lg">{result.success ? "✅" : "❌"}</span>
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 truncate text-sm">
                {result.name}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-500 font-mono bg-gray-50 px-1.5 py-0.5 rounded">
                  {result.sku}
                </span>
                {result.loadTime && (
                  <span className="flex items-center gap-0.5 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    {result.loadTime}ms
                  </span>
                )}
                <span className="text-xs text-gray-400">
                  {passPercentage}% features ok
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {result.channel === 'socialcommerce' && (
              <Badge className="bg-purple-50 text-purple-700 border border-purple-200 font-semibold">
                Minha Loja
              </Badge>
            )}
            <VendorLogo vendor={result.vendor} />
            <Badge className="bg-gray-50 text-gray-700 border border-gray-200">
              <img
                src={getCountryFlag(result.country)}
                alt={result.country}
                width={16}
                height={12}
                className="rounded-sm mr-1"
              />
              {result.country.toUpperCase()}
            </Badge>
            <ChevronDown
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            />
          </div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <ExternalLink className="w-3 h-3" />
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:text-indigo-800 hover:underline break-all transition-colors"
                >
                  {result.url}
                </a>
              </div>

              {result.error && (
                <div className="flex items-start gap-2 bg-red-50 text-red-700 text-sm px-3 py-2.5 rounded-lg border border-red-100">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{result.error}</span>
                </div>
              )}

              <FeatureTable
                features={result.features}
                runId={runId}
                pageScreenshot={result.pageScreenshot}
              />

              <RemoteConfigPanel
                flags={result.remoteConfigFlags}
                locale={
                  (result.remoteConfigFlags as Record<string, unknown>)
                    ?.locale as string | undefined
                }
              />

              <ScreenshotViewer screenshots={skuScreenshots} runId={runId} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
