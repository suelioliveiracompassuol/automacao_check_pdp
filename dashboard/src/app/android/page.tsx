import { FaAndroid } from 'react-icons/fa';
import { EmptyState } from '@/components/empty-state';

export default function AndroidPage() {
  return (
    <EmptyState
      icon={<FaAndroid />}
      title="Monitoramento Android ainda não disponível"
      badge="Em breve"
    />
  );
}
