import { ReportClient } from '@/app/web/[runId]/report-client';
import { PlatformHero } from '@/components/platform-hero';
import { SummaryCards } from '@/components/summary-cards';
import { WebHistoryDropdown } from '@/components/web-history-dropdown';
import { getScreenshotsForRun } from '@/lib/data';
import type { MonitoringReport } from '@/lib/types';

interface WebReportViewProps {
  report: MonitoringReport;
  description?: string;
}

/** Conteúdo das páginas /web (última execução) e /web/[runId] (execução do histórico). */
export function WebReportView({ report, description }: WebReportViewProps) {
  const screenshots = getScreenshotsForRun(report.runId);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PlatformHero
        platform="web"
        title="PDP Feature Monitor — Web"
        description={description}
        report={report}
        action={<WebHistoryDropdown />}
      />
      <SummaryCards {...report.summary} />
      <ReportClient results={report.results} runId={report.runId} screenshots={screenshots} />
    </div>
  );
}
