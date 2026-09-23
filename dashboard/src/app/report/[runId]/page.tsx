import { redirect } from 'next/navigation';
import { getReportIndex } from '@/lib/data';

interface Props {
  params: Promise<{ runId: string }>;
}

export async function generateStaticParams() {
  const index = getReportIndex();
  return index.reports.slice(0, 5).map((r) => ({ runId: r.runId }));
}

/** /report/[runId] moved to /web/[runId] (mirrors /android/[runId]) — kept as a redirect so
 * older links/bookmarks keep working. */
export default async function LegacyReportRedirect({ params }: Props) {
  const { runId } = await params;
  redirect(`/web/${runId}/`);
}
