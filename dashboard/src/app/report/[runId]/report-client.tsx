"use client";

import { useState, useMemo } from "react";
import type { PdpCheckResult } from "@/lib/types";
import { FilterBar } from "@/components/filter-bar";
import { PdpCard } from "@/components/pdp-card";
import { OperationFlagsGrid } from "@/components/operation-flags-grid";

type FilterStatus = "all" | "pass" | "fail";

interface ReportClientProps {
  results: PdpCheckResult[];
  runId: string;
  screenshots: string[];
}

export function ReportClient({
  results,
  runId,
  screenshots,
}: ReportClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVendor, setSelectedVendor] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState<FilterStatus>("all");

  const filteredResults = useMemo(() => {
    return results.filter((r) => {
      if (
        selectedVendor !== "all" &&
        r.vendor.toLowerCase() !== selectedVendor
      ) {
        return false;
      }
      if (selectedStatus === "pass") {
        return r.success;
      }
      if (selectedStatus === "fail") {
        return !r.success;
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesSku = r.sku.toLowerCase().includes(q);
        const matchesName = r.name?.toLowerCase().includes(q);
        if (!matchesSku && !matchesName) {
          return false;
        }
      }

      return true;
    });
  }, [results, selectedVendor, selectedStatus, searchQuery]);

  return (
    <div className="space-y-6">
      <FilterBar
        results={results}
        searchQuery={searchQuery}
        selectedVendor={selectedVendor}
        selectedStatus={selectedStatus}
        onSearchChange={setSearchQuery}
        onVendorChange={setSelectedVendor}
        onStatusChange={setSelectedStatus}
      />
      <OperationFlagsGrid results={filteredResults} />
      <div className="space-y-3">
        {filteredResults.map((result) => (
          <PdpCard
            key={`${result.sku}-${result.timestamp}`}
            result={result}
            runId={runId}
            screenshots={screenshots}
          />
        ))}
        {filteredResults.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            Nenhum resultado encontrado com os filtros selecionados.
          </div>
        )}
      </div>
    </div>
  );
}
