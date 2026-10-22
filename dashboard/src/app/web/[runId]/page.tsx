import { notFound } from 'next/navigation';
import { PlatformReportView } from '@/components/platform-report-view';
import { getReportById, getReportsByPlatform } from '@/lib/data';
import { runIdStaticParams } from '@/lib/report';

interface Props {
  params: Promise<{ runId: string }>;
}

export async function generateStaticParams() {
  return runIdStaticParams(getReportsByPlatform('web'));
}

export default async function WebReportPage({ params }: Props) {
  const { runId } = await params;
  const report = getReportById(runId);
  if (!report) {
    notFound();
  }

  return <PlatformReportView platform="web" report={report} />;
}
