import { notFound } from 'next/navigation';
import { WebReportView } from '@/components/web-report-view';
import { getReportById, getReportsByPlatform } from '@/lib/data';

interface Props {
  params: Promise<{ runId: string }>;
}

/** Quantas execuções recentes são pré-renderizadas no export estático. */
const PRERENDERED_RUNS = 5;

export async function generateStaticParams() {
  return getReportsByPlatform('web')
    .slice(0, PRERENDERED_RUNS)
    .map((r) => ({ runId: r.runId }));
}

export default async function WebReportPage({ params }: Props) {
  const { runId } = await params;
  const report = getReportById(runId);
  if (!report) {
    notFound();
  }

  return <WebReportView report={report} />;
}
