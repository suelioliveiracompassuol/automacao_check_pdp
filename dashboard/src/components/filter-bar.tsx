"use client";

import type { PdpCheckResult } from "@/lib/types";
import { useMemo } from "react";
import { Search, Filter } from "lucide-react";
import { VendorLogo } from "./vendor-logo";

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
  const statusTabs: { key: FilterStatus; label: string; icon: string }[] = [
    { key: "all", label: "Todos", icon: "📋" },
    { key: "pass", label: "Aprovados", icon: "✅" },
    { key: "fail", label: "Reprovados", icon: "❌" },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por SKU, nome ou URL..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
          />
        </div>

        {/* Vendor tabs */}
        <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-lg">
          {vendorTabs.map((vendor) => {
            const isActive =
              (vendor === "Todos" && selectedVendor === "all") ||
              vendor.toLowerCase() === selectedVendor;
            return (
              <button
                key={vendor}
                onClick={() =>
                  onVendorChange(
                    vendor === "Todos" ? "all" : vendor.toLowerCase(),
                  )
                }
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all cursor-pointer ${
                  isActive
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {vendor !== "Todos" ? (
                  <span className="flex items-center gap-1.5">
                    <VendorLogo vendor={vendor} size="sm" />
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Filter className="w-3.5 h-3.5" />
                    Todos
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Status tabs */}
        <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-lg">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onStatusChange(tab.key)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all cursor-pointer ${
                selectedStatus === tab.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <span className="flex items-center gap-1">
                <span className="text-xs">{tab.icon}</span>
                {tab.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
