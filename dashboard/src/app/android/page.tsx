import { FaAndroid } from 'react-icons/fa';
import { EmptyState } from '@/components/empty-state';

export default function AndroidPage() {
  return (
    <EmptyState
      icon={<FaAndroid />}
      title="Monitoramento Android ainda não disponível"
      badge="Em breve"
    >
      A verificação de features nas PDPs do app nativo Android (Appium + device farm) está em fase
      de prova de conceito. Assim que o primeiro relatório for publicado, esta página passa a
      mostrar os resultados automaticamente — mesmo padrão de{' '}
      <code className="rounded bg-neutral-50 px-1.5 py-0.5 font-mono text-high-emphasis">/web</code>
      .
    </EmptyState>
  );
}
