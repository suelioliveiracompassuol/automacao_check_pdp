import { FaApple } from 'react-icons/fa6';
import { EmptyState } from '@/components/empty-state';

export default function IosPage() {
  return (
    <EmptyState icon={<FaApple />} title="Monitoramento iOS ainda não disponível" badge="Em breve">
      O orquestrador iOS está planejado como próxima fase do roadmap (após Android). Assim que o
      primeiro relatório for gerado, esta página passa a mostrar os resultados automaticamente —
      mesmo padrão de{' '}
      <code className="rounded bg-neutral-50 px-1.5 py-0.5 font-mono text-high-emphasis">
        /android
      </code>
      .
    </EmptyState>
  );
}
