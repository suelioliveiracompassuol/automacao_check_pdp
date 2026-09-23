import type { Metadata } from 'next';
import './globals.css';
import { NavHeader } from '@/components/nav-header';
import { Sidebar } from '@/components/sidebar';
import { MobileBottomNav } from '@/components/mobile-bottom-nav';

export const metadata: Metadata = {
  title: 'PDP Monitor — Monitoramento de Features',
  description: 'Dashboard de monitoramento automatizado de features em PDPs Natura/Avon',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-(--color-bg)">
        <NavHeader />
        <div className="max-w-7xl mx-auto flex items-start">
          <Sidebar />
          {/* pb-20 clears the fixed mobile bottom nav (MobileBottomNav); md:pb-6 once it's hidden */}
          <main id="app-main" className="min-w-0 flex-1 px-4 sm:px-6 py-6 pb-20 md:pb-6">
            {children}
          </main>
        </div>
        <MobileBottomNav />
      </body>
    </html>
  );
}
