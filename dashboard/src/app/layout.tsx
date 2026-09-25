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
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&family=Roboto+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-background">
        <NavHeader />
        <div className="mx-auto flex max-w-360 items-start">
          <Sidebar />
          <main
            id="app-main"
            className="@container min-w-0 flex-1 px-4 pt-6 pb-24 sm:px-6 md:pb-10 xl:px-10"
          >
            {children}
          </main>
        </div>
        <MobileBottomNav />
      </body>
    </html>
  );
}
