import { notFound } from 'next/navigation';
import { getReportById, getReportIndex, getScreenshotsForRun } from '@/lib/data';
import { SummaryCards } from '@/components/summary-cards';
import { AndroidHistoryDropdown } from '@/components/android-history-dropdown';
import { formatDuration, formatDate } from '@/lib/utils';
import { ReportClient } from '../../report/[runId]/report-client';

interface Props {
  params: Promise<{ runId: string }>;
}

export async function generateStaticParams() {
  const index = getReportIndex();
  return index.reports
    .filter((r) => r.platform === 'android')
    .slice(0, 5)
    .map((r) => ({ runId: r.runId }));
}

export default async function AndroidReportPage({ params }: Props) {
  const { runId } = await params;
  const report = getReportById(runId);
  if (!report) {
    notFound();
  }

  const screenshots = getScreenshotsForRun(runId);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-slate-900 via-emerald-950 to-slate-900 px-6 py-8 shadow-xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-60" />
        <div className="relative z-10">
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-xs font-medium text-emerald-300 bg-emerald-500/20 px-2.5 py-1 rounded-full border border-emerald-400/20">
              📱 App Android · Natura&Co
            </span>
            <AndroidHistoryDropdown />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            PDP Feature Monitor — Android
          </h1>
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-300 bg-white/5 border border-white/10 rounded-full px-3 py-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {formatDate(report?.startTime)}
            </span>
            <span className="text-xs text-slate-400 bg-white/5 border border-white/10 rounded-full px-3 py-1.5">
              ⏱ {formatDuration(report.durationMs)}
            </span>
            <span className="text-xs text-slate-400 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 font-mono">
              {report.runId}
            </span>
          </div>
        </div>
      </div>

      <SummaryCards
        total={report.summary.total}
        passed={report.summary.passed}
        failed={report.summary.failed}
        errors={report.summary.errors}
      />
      <ReportClient results={report.results} runId={runId} screenshots={screenshots} />
    </div>
  );
}
