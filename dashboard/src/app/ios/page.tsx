import { FaApple } from 'react-icons/fa6';
import { EmptyState } from '@/components/empty-state';

export default function IosPage() {
  return (
    <EmptyState
      platform="ios"
      icon={<FaApple />}
      title="Monitoramento iOS ainda não disponível"
      badge="Em breve"
    />
  );
}
