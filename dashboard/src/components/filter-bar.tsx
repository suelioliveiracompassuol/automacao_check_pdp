"use client";

import type { PdpCheckResult } from "@/lib/types";
import { useMemo } from "react";
import { Search, X, Globe } from "lucide-react";
import { VendorLogo } from "./vendor-logo";
import { getCountryFlag } from "@/lib/utils";

type FilterStatus = "all" | "pass" | "fail";

interface FilterBarProps {
  results: PdpCheckResult[];
  searchQuery: string;
  selectedVendor: string;
  selectedOperation: string;
  selectedStatus: FilterStatus;
  onSearchChange: (query: string) => void;
  onVendorChange: (vendor: string) => void;
  onOperationChange: (operation: string) => void;
  onStatusChange: (status: FilterStatus) => void;
}

export function FilterBar({
  results,
  searchQuery,
  selectedVendor,
  selectedOperation,
  selectedStatus,
  onSearchChange,
  onVendorChange,
  onOperationChange,
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

  // Countries available for current vendor selection
  const countries = useMemo(() => {
    const set = new Set<string>();
    for (const r of results) {
      if (
        selectedVendor === "all" ||
        r.vendor.toLowerCase() === selectedVendor
      ) {
        set.add(r.country.toUpperCase());
      }
    }
    return [...set].sort();
  }, [results, selectedVendor]);

  const vendorTabs = ["Todos", ...vendors];
  const statusTabs: { key: FilterStatus; label: string; icon: string }[] = [
    { key: "all", label: "Todos", icon: "📋" },
    { key: "pass", label: "Aprovados", icon: "✅" },
    { key: "fail", label: "Reprovados", icon: "❌" },
  ];

  const hasActiveFilters =
    searchQuery !== "" ||
    selectedVendor !== "all" ||
    selectedOperation !== "all" ||
    selectedStatus !== "all";

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
      {/* Row 1: Search + Status + Clear */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por SKU, nome ou URL..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
          />
        </div>

        {/* Status */}
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

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={() => {
              onSearchChange("");
              onVendorChange("all");
              onOperationChange("all");
              onStatusChange("all");
            }}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            Limpar
          </button>
        )}
      </div>

      {/* Row 2: Vendor + Operations */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Vendor */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
            Marca
          </span>
          <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-lg">
            {vendorTabs.map((vendor) => {
              const isActive =
                (vendor === "Todos" && selectedVendor === "all") ||
                vendor.toLowerCase() === selectedVendor;
              return (
                <button
                  key={vendor}
                  onClick={() => {
                    onVendorChange(
                      vendor === "Todos" ? "all" : vendor.toLowerCase(),
                    );
                    onOperationChange("all");
                  }}
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
                    "Todos"
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Operations */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
            <Globe className="w-3.5 h-3.5 inline -mt-0.5 mr-0.5" />
            País
          </span>
          <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-lg flex-wrap">
            <button
              onClick={() => onOperationChange("all")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                selectedOperation === "all"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Todas
            </button>
            {countries.map((country) => (
              <button
                key={country}
                onClick={() => onOperationChange(country)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                  selectedOperation === country
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <span className="flex items-center gap-1">
                  <img
                    src={getCountryFlag(country)}
                    alt={country}
                    className="w-5 h-3.5 object-cover rounded-sm"
                  />
                  {country}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
