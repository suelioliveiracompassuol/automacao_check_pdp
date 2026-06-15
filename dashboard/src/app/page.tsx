import { getLastReport, getScreenshotsForRun } from "@/lib/data";
import { SummaryCards } from "@/components/summary-cards";
import { formatDuration, formatDate } from "@/lib/utils";
import { ReportClient } from "./report/[runId]/report-client";

export default function HomePage() {
  const report = getLastReport();
  const screenshots = getScreenshotsForRun(report.runId);

  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          🔍 PDP Feature Monitor
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {formatDate(report.startTime)} · Duração: {formatDuration(report.durationMs)} · {report.runId}
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
        runId={report.runId}
        screenshots={screenshots}
      />
    </div>
  );
}
