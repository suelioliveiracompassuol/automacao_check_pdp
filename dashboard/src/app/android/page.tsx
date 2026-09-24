import { getLastAndroidReport, getScreenshotsForRun } from '@/lib/data';
import { EmptyState } from '@/components/empty-state';
import { PlatformHero } from '@/components/platform-hero';
import { SummaryCards } from '@/components/summary-cards';
import { AndroidHistoryDropdown } from '@/components/android-history-dropdown';
import { ReportClient } from '../web/[runId]/report-client';
import { FaAndroid } from 'react-icons/fa';

export default function AndroidPage() {
  const report = getLastAndroidReport();

  if (!report) {
    return (
      <EmptyState icon={<FaAndroid />} title="Nenhuma execução Android ainda">
        Rode{' '}
        <code className="rounded bg-neutral-50 px-1.5 py-0.5 font-mono text-high-emphasis">
          npm run check:android
        </code>{' '}
        no repositório principal para gerar o primeiro relatório.
      </EmptyState>
    );
  }

  const screenshots = getScreenshotsForRun(report.runId);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PlatformHero
        platform="android"
        title="PDP Feature Monitor — Android"
        description="Verificação automatizada de features nas PDPs do app nativo Android (Appium + device farm), separada do monitoramento do site."
        report={report}
        action={<AndroidHistoryDropdown />}
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
