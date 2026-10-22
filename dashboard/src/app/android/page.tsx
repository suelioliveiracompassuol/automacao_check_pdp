import { FaAndroid } from 'react-icons/fa';
import { EmptyState } from '@/components/empty-state';
import { PlatformReportView } from '@/components/platform-report-view';
import { getLastReportByPlatform } from '@/lib/data';

export default function AndroidPage() {
  const report = getLastReportByPlatform('android');

  if (!report) {
    return (
      <EmptyState
        icon={<FaAndroid />}
        title="Nenhuma execução Android ainda"
        description={
          <>
            Rode{' '}
            <code className="rounded bg-neutral-50 px-1.5 py-0.5 font-mono text-high-emphasis">
              npm run check:android
            </code>{' '}
            no repositório principal para gerar o primeiro relatório.
          </>
        }
      />
    );
  }

  return (
    <PlatformReportView
      platform="android"
      report={report}
      description="Verificação automatizada de features nas PDPs do app nativo Android (Appium + device farm), separada do monitoramento do site."
    />
  );
}
