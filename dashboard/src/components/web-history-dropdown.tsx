import { getReportsByPlatform } from '@/lib/data';
import { HistoryDropdown } from '@/components/history-dropdown';

const MAX_RUNS = 15;

/** Scoped history dropdown for /web pages — only lists Web runs, links under /web.
 * Entries with no `platform` field are legacy Web runs, so they count too. */
export function WebHistoryDropdown() {
  const runs = getReportsByPlatform('web').slice(0, MAX_RUNS);

  return <HistoryDropdown runs={runs} basePath="/web" homeHref="/web" />;
}
