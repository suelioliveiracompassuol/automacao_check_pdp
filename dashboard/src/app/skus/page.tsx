import { SkusClient } from './skus-client';

export const metadata = {
  title: 'Gerenciar SKUs',
};

export default function SkusPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SkusClient />
      </div>
    </main>
  );
}
