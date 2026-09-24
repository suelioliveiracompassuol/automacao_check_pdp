import { getReportIndex } from '@/lib/data';
import { HistoryDropdown } from '@/components/history-dropdown';

/** Scoped history dropdown for /web pages — only lists Web runs, links under /web.
 * Entries with no `platform` field are legacy Web runs, so they count too. */
export function WebHistoryDropdown() {
  const index = getReportIndex();
  const runs = index.reports.filter((r) => (r.platform ?? 'web') === 'web').slice(0, 15);
  const homeRunId = runs[0]?.runId;

  return <HistoryDropdown runs={runs} homeRunId={homeRunId} basePath="/web" homeHref="/web" />;
}
