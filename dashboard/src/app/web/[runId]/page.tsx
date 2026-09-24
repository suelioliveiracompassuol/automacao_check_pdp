import { notFound } from 'next/navigation';
import { getReportById, getReportIndex, getScreenshotsForRun } from '@/lib/data';
import { PlatformHero } from '@/components/platform-hero';
import { SummaryCards } from '@/components/summary-cards';
import { WebHistoryDropdown } from '@/components/web-history-dropdown';
import { ReportClient } from './report-client';

interface Props {
  params: Promise<{ runId: string }>;
}

export async function generateStaticParams() {
  const index = getReportIndex();
  return index.reports
    .filter((r) => (r.platform ?? 'web') === 'web')
    .slice(0, 5)
    .map((r) => ({ runId: r.runId }));
}

export default async function WebReportPage({ params }: Props) {
  const { runId } = await params;
  const report = getReportById(runId);
  if (!report) {
    notFound();
  }

  const screenshots = getScreenshotsForRun(runId);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PlatformHero
        platform="web"
        title="PDP Feature Monitor — Web"
        report={report}
        action={<WebHistoryDropdown />}
      />

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
