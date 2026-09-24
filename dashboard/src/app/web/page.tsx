import { PlatformHero } from '@/components/platform-hero';
import { SummaryCards } from '@/components/summary-cards';
import { WebHistoryDropdown } from '@/components/web-history-dropdown';
import { getLastReport, getScreenshotsForRun } from '@/lib/data';

import { ReportClient } from './[runId]/report-client';

export default function WebPage() {
  const report = getLastReport();
  const screenshots = getScreenshotsForRun(report.runId);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PlatformHero
        platform="web"
        title="PDP Feature Monitor — Web"
        description="Verificação automatizada de features nas páginas de produto (PDP) das operações Natura & Avon em múltiplos países."
        report={report}
        action={<WebHistoryDropdown />}
      />

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
