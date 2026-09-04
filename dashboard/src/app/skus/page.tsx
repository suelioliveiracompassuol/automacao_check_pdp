import { AuthProvider } from '@/components/auth-context';
import { AuthLogin } from '@/components/auth-login';
import { SkusClient } from './skus-client';

export const metadata = {
  title: 'Gerenciar SKUs',
};

export default function SkusPage() {
  return (
    <AuthProvider>
      <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex items-center justify-end gap-4">
            <AuthLogin />
          </div>
          <SkusClient />
        </div>
      </main>
    </AuthProvider>
  );
}
