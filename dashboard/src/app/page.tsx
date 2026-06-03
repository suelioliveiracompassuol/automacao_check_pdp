"use client";

import React, { useState, useEffect } from "react";
import { ReportData } from "@/types/report";
import { SummaryCards } from "@/components/summary-card";
import { SkuTable } from "@/components/sku-table";
import { FeatureFlags } from "@/components/feature-flags";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, Calendar, ShieldCheck } from "lucide-react";
import OperationFilter from "@/components/OperationFilter";

interface Report {
  runId: string;
  startTime: string;
}

async function getReportData(
  runId: string,
): Promise<ReportData | null> {
  try {
    const res = await fetch(`./reports/${runId}/report.json`);
    if (!res.ok) {
      throw new Error(`Failed to fetch report for runId: ${runId}`);
    }
    return await res.json();
  } catch (error) {
    console.error("Error loading report data:", error);
    return null;
  }
}

async function getReports(): Promise<Report[]> {
  try {
    const res = await fetch("./reports/index.json");
    if (!res.ok) {
      throw new Error("Failed to fetch reports index");
    }
    const data = await res.json();
    return data.reports;
  } catch (error) {
    console.error("Error loading reports:", error);
    return [];
  }
}

export default function Dashboard() {
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [reportData, setReportData] = useState<ReportData | null>(null);

  useEffect(() => {
    const loadReports = async () => {
      const reports = await getReports();
      setReports(reports);
      if (reports.length > 0) {
        setSelectedRunId(reports[0].runId);
      }
    };
    loadReports();
  }, []);

  useEffect(() => {
    if (selectedRunId) {
      const loadReportData = async () => {
        const data = await getReportData(selectedRunId);
        setReportData(data);
      };
      loadReportData();
    }
  }, [selectedRunId]);

  const handleSelectOperation = (runId: string) => {
    setSelectedRunId(runId);
  };

  if (!reportData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-red-100 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldCheck size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Relatório não encontrado
          </h2>
          <p className="text-gray-600 mb-6">
            Não foi possível carregar os dados do relatório. Verifique se o
            arquivo JSON está disponível.
          </p>
        </div>
      </div>
    );
  }

  const startTime = new Date(reportData.startTime);
  const durationSecs = Math.round(reportData.durationMs / 1000);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold">
                N
              </div>
              <h1 className="text-xl font-bold text-gray-900">
                PDP Feature Monitor
              </h1>
            </div>

            <div className="flex items-center space-x-6 text-sm text-gray-500">
              <div className="flex items-center space-x-2">
                <Calendar size={16} />
                <span>
                  {format(startTime, "dd 'de' MMMM, yyyy", { locale: ptBR })}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock size={16} />
                <span>
                  {format(startTime, "HH:mm")} ({durationSecs}s)
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Operações</h2>
          <OperationFilter
            reports={reports}
            selectedRunId={selectedRunId}
            onSelectOperation={handleSelectOperation}
          />
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Visão Geral</h2>
          <p className="text-gray-600">
            Resumo da execução dos testes automatizados nas páginas de produto.
          </p>
        </div>

        <SummaryCards summary={reportData.summary} />

        <FeatureFlags results={reportData.results} />

        <SkuTable results={reportData.results} />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500">
          <p>
            Gerado automaticamente por PDP Feature Monitor • Run ID:{" "}
            <span className="font-mono text-xs">{reportData.runId}</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
