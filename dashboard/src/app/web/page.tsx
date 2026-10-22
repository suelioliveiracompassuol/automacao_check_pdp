import { WebReportView } from '@/components/web-report-view';
import { getLastReport } from '@/lib/data';

export default function WebPage() {
  return (
    <WebReportView
      report={getLastReport()}
      description="Verificação automatizada de features nas páginas de produto (PDP) das operações Natura & Avon em múltiplos países."
    />
  );
}
