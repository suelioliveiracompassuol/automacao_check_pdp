import { ReportClient } from '@/app/web/[runId]/report-client';
import { PlatformHero } from '@/components/platform-hero';
import { PlatformHistoryDropdown } from '@/components/platform-history-dropdown';
import { SummaryCards } from '@/components/summary-cards';
import { getScreenshotsForRun } from '@/lib/data';
import { PLATFORM_META } from '@/lib/platforms';
import type { MonitoringReport, Platform } from '@/lib/types';

interface PlatformReportViewProps {
  platform: Platform;
  report: MonitoringReport;
  description?: string;
}

/** Página de uma execução (a mais recente ou uma do histórico) de /web e /android. */
export function PlatformReportView({ platform, report, description }: PlatformReportViewProps) {
  const screenshots = getScreenshotsForRun(report.runId);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PlatformHero
        platform={platform}
        title={`PDP Feature Monitor — ${PLATFORM_META[platform].label}`}
        description={description}
        report={report}
        action={<PlatformHistoryDropdown platform={platform} />}
      />
      <SummaryCards {...report.summary} />
      <ReportClient results={report.results} runId={report.runId} screenshots={screenshots} />
    </div>
  );
}
