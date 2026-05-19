import React from "react";
import { CheckCircle, XCircle, AlertTriangle, Activity } from "lucide-react";
import { ReportSummary } from "@/types/report";

interface SummaryCardsProps {
  summary: ReportSummary;
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  const passRate =
    summary.total > 0 ? Math.round((summary.passed / summary.total) * 100) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center space-x-4">
        <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
          <Activity size={24} />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Total de Testes</p>
          <h3 className="text-2xl font-bold text-gray-900">{summary.total}</h3>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center space-x-4">
        <div className="p-3 bg-green-50 text-green-600 rounded-lg">
          <CheckCircle size={24} />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Passaram</p>
          <div className="flex items-baseline space-x-2">
            <h3 className="text-2xl font-bold text-gray-900">
              {summary.passed}
            </h3>
            <span className="text-sm font-medium text-green-600">
              ({passRate}%)
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center space-x-4">
        <div className="p-3 bg-red-50 text-red-600 rounded-lg">
          <XCircle size={24} />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Falharam</p>
          <h3 className="text-2xl font-bold text-gray-900">{summary.failed}</h3>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center space-x-4">
        <div className="p-3 bg-orange-50 text-orange-600 rounded-lg">
          <AlertTriangle size={24} />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Erros de Execução</p>
          <h3 className="text-2xl font-bold text-gray-900">{summary.errors}</h3>
        </div>
      </div>
    </div>
  );
}
