import { PlatformReportView } from '@/components/platform-report-view';
import { getLastReport } from '@/lib/data';

export default function WebPage() {
  return (
    <PlatformReportView
      platform="web"
      report={getLastReport()}
      description="Verificação automatizada de features nas páginas de produto (PDP) das operações Natura & Avon em múltiplos países."
    />
  );
}
