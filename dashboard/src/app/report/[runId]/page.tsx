import { notFound } from "next/navigation";
import {
  getReportById,
  getReportIndex,
  getScreenshotsForRun,
} from "@/lib/data";
import { SummaryCards } from "@/components/summary-cards";
import { formatDuration, formatDate } from "@/lib/utils";
import { ReportClient } from "./report-client";

interface Props {
  params: Promise<{ runId: string }>;
}

export async function generateStaticParams() {
  const index = getReportIndex();
  return index.reports.slice(0, 5).map((r) => ({ runId: r.runId }));
}

export default async function ReportPage({ params }: Props) {
  const { runId } = await params;
  const report = getReportById(runId);
  if (!report) notFound();

  const screenshots = getScreenshotsForRun(runId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          🔍 PDP Feature Monitor
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {formatDate(report.startTime)} · Duração:{" "}
          {formatDuration(report.durationMs)} · {report.runId}
        </p>
      </div>
      <SummaryCards
        total={report.summary.total}
        passed={report.summary.passed}
        failed={report.summary.failed}
        errors={report.summary.errors}
      />
      <ReportClient
        results={report.results}
        runId={runId}
        screenshots={screenshots}
      />
    </div>
  );
}
