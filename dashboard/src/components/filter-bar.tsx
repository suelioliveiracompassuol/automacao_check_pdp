"use client";

import type { PdpCheckResult } from "@/lib/types";
import { useMemo } from "react";

type FilterStatus = "all" | "pass" | "fail";

interface FilterBarProps {
  results: PdpCheckResult[];
  searchQuery: string;
  selectedVendor: string;
  selectedStatus: FilterStatus;
  onSearchChange: (query: string) => void;
  onVendorChange: (vendor: string) => void;
  onStatusChange: (status: FilterStatus) => void;
}

export function FilterBar({
  results,
  searchQuery,
  selectedVendor,
  selectedStatus,
  onSearchChange,
  onVendorChange,
  onStatusChange,
}: FilterBarProps) {
  const vendors = useMemo(() => {
    const set = new Set<string>();
    for (const r of results) {
      set.add(
        r.vendor.charAt(0).toUpperCase() + r.vendor.slice(1).toLowerCase(),
      );
    }
    return [...set].sort();
  }, [results]);

  const vendorTabs = ["Todos", ...vendors];
  const statusTabs: { key: FilterStatus; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "pass", label: "Pass" },
    { key: "fail", label: "Fail" },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="Buscar por SKU ou nome..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        <div className="flex border border-gray-200 rounded-lg overflow-hidden">
          {vendorTabs.map((vendor) => (
            <button
              key={vendor}
              onClick={() =>
                onVendorChange(
                  vendor === "Todos" ? "all" : vendor.toLowerCase(),
                )
              }
              className={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
                (vendor === "Todos" && selectedVendor === "all") ||
                vendor.toLowerCase() === selectedVendor
                  ? "bg-gray-200 text-gray-900"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {vendor}
            </button>
          ))}
        </div>
        <div className="flex border border-gray-200 rounded-lg overflow-hidden">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onStatusChange(tab.key)}
              className={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
                selectedStatus === tab.key
                  ? "bg-gray-200 text-gray-900"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
