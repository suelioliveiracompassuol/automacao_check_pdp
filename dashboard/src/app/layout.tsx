import type { Metadata } from 'next';
import './globals.css';
import { NavHeader } from '@/components/nav-header';
import { Sidebar } from '@/components/sidebar';
import { MobileBottomNav } from '@/components/mobile-bottom-nav';
import { MotionProvider } from '@/components/motion-provider';
import { getReportIndex } from '@/lib/data';
import type { LastRunSummary } from '@/components/nav-header';

export const metadata: Metadata = {
  title: 'PDP Monitor — Monitoramento de Features',
  description: 'Dashboard de monitoramento automatizado de features em PDPs Natura/Avon',
};

function getLastWebRun(): LastRunSummary | null {
  try {
    const entry = getReportIndex().reports.find((r) => (r.platform ?? 'web') === 'web');
    if (!entry) return null;
    return {
      startTime: entry.startTime,
      failed: entry.summary.failed,
      errors: entry.summary.errors,
    };
  } catch {
    return null;
  }
}

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
      <body className="min-h-dvh bg-background">
        <a
          href="#app-main"
          className="sr-only z-50 rounded-lg bg-surface text-sm font-semibold text-highlight shadow-lift focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:px-4 focus:py-2"
        >
          Pular para o conteúdo
        </a>
        <MotionProvider>
          <NavHeader lastRun={getLastWebRun()} />
          <div className="mx-auto flex max-w-360 items-start">
            <Sidebar />
            <main
              id="app-main"
              tabIndex={-1}
              className="@container min-w-0 flex-1 px-4 pt-6 pb-24 sm:px-6 md:pb-10 xl:px-10"
            >
              {children}
            </main>
          </div>
          <MobileBottomNav />
        </MotionProvider>
      </body>
    </html>
  );
}
