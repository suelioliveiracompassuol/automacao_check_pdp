import { FaApple } from 'react-icons/fa6';
import { EmptyState } from '@/components/empty-state';

export default function IosPage() {
  return (
    <EmptyState
      icon={<FaApple />}
      title="Monitoramento iOS ainda não disponível"
      badge="Em breve"
    />
  );
}
