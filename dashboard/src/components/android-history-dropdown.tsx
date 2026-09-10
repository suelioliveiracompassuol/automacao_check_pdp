import { getReportIndex } from '@/lib/data';
import { HistoryDropdown } from '@/components/history-dropdown';

/** Scoped history dropdown for /android pages — only lists Android runs, links under /android. */
export function AndroidHistoryDropdown() {
  const index = getReportIndex();
  const runs = index.reports.filter((r) => r.platform === 'android').slice(0, 15);
  const homeRunId = runs[0]?.runId;

  return (
    <HistoryDropdown runs={runs} homeRunId={homeRunId} basePath="/android" homeHref="/android" />
  );
}
