"use client";

import React, { useState } from "react";
import { SkuResult } from "@/types/report";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { FeatureList } from "./feature-list";
import Image from "next/image";

interface SkuTableProps {
  results: SkuResult[];
}

export function SkuTable({ results }: SkuTableProps) {
  // Use a combination of vendor, country, and sku to uniquely identify a row
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "failed" | "passed">("all");

  const toggleExpand = (rowId: string) => {
    setExpandedRowId(expandedRowId === rowId ? null : rowId);
  };

  const filteredResults = results.filter((result) => {
    if (filter === "failed") return !result.success;
    if (filter === "passed") return result.success;
    return true;
  });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
        <h2 className="text-lg font-semibold text-gray-800">
          Resultados por Produto
        </h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              filter === "all"
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilter("failed")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              filter === "failed"
                ? "bg-red-600 text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            Falhas
          </button>
          <button
            onClick={() => setFilter("passed")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              filter === "passed"
                ? "bg-green-600 text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            Sucesso
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white border-b border-gray-100 text-sm text-gray-500">
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium">SKU</th>
              <th className="p-4 font-medium">Produto</th>
              <th className="p-4 font-medium">Marca / País</th>
              <th className="p-4 font-medium text-right">Tempo (ms)</th>
              <th className="p-4 font-medium text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredResults.map((result, index) => {
              const rowId = `${result.vendor}-${result.country}-${result.sku}-${index}`;
              const isExpanded = expandedRowId === rowId;

              return (
                <React.Fragment key={rowId}>
                  <tr
                    className={`hover:bg-gray-50 transition-colors cursor-pointer ${isExpanded ? "bg-gray-50" : ""}`}
                    onClick={() => toggleExpand(rowId)}
                  >
                    <td className="p-4">
                      {result.success ? (
                        <CheckCircle2 className="text-green-500" size={20} />
                      ) : (
                        <XCircle className="text-red-500" size={20} />
                      )}
                    </td>
                    <td className="p-4 font-mono text-sm text-gray-600 min-w-40">
                      {result.sku}
                    </td>
                    <td className="p-4">
                      <div
                        className="font-medium text-gray-900 line-clamp-1"
                        title={result.name}
                      >
                        {result.name}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 capitalize">
                          {result.vendor}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                          <Image
                            src={`https://flagcdn.com/20x15/${result.country.toLowerCase()}.png`}
                            alt={result.country}
                            className="mr-1.5 w-4 h-3 object-cover rounded-sm"
                            width={20}
                            height={15}
                          />
                          {result.country}
                        </span>
                        {result.channel === "socialcommerce" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                            Minha Loja
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-right text-sm text-gray-500">
                      {result.loadTime}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center space-x-3">
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                          title="Abrir PDP"
                        >
                          <ExternalLink size={18} />
                        </a>
                        <button className="text-gray-400 hover:text-gray-600">
                          {isExpanded ? (
                            <ChevronUp size={20} />
                          ) : (
                            <ChevronDown size={20} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td
                        colSpan={6}
                        className="p-0 border-b-2 border-gray-100"
                      >
                        <div className="bg-gray-50/50 p-6 shadow-inner">
                          <FeatureList features={result.features} />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {filteredResults.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">
                  Nenhum resultado encontrado para o filtro selecionado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
