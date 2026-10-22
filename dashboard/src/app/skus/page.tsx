import { AuthProvider } from '@/components/auth-context';
import { AuthLogin } from '@/components/auth-login';
import { SkusClient } from './skus-client';

export const metadata = {
  title: 'Gerenciar SKUs',
};

export default function SkusPage() {
  return (
    <AuthProvider>
      {/* O <main> já vem do layout raiz; aqui é só o conteúdo da página. */}
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-end gap-4">
          <AuthLogin />
        </div>
        <SkusClient />
      </div>
    </AuthProvider>
  );
}
