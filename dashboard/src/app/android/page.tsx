import { getLastAndroidReport, getScreenshotsForRun } from '@/lib/data';
import { SummaryCards } from '@/components/summary-cards';
import { AndroidHistoryDropdown } from '@/components/android-history-dropdown';
import { formatDuration, formatDate } from '@/lib/utils';
import { ReportClient } from '../report/[runId]/report-client';

export default function AndroidPage() {
  const report = getLastAndroidReport();

  if (!report) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="text-5xl mb-4">📱</div>
        <h1 className="text-xl font-bold text-gray-900">Nenhuma execução Android ainda</h1>
        <p className="text-gray-500 text-sm mt-2">
          Rode <code className="bg-gray-100 px-1.5 py-0.5 rounded">npm run check:android</code> no
          repositório principal para gerar o primeiro relatório.
        </p>
      </div>
    );
  }

  const screenshots = getScreenshotsForRun(report.runId);

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
          <p className="text-emerald-200/80 text-sm mt-2 max-w-xl">
            Verificação automatizada de features nas PDPs do app nativo Android (Appium + device
            farm), separada do monitoramento do site.
          </p>
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
      <ReportClient results={report.results} runId={report.runId} screenshots={screenshots} />
    </div>
  );
}
