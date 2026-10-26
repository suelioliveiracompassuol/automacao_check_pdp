import type { Metadata } from 'next';
import { Roboto, Roboto_Mono } from 'next/font/google';
import './globals.css';
import { NavHeader } from '@/components/nav-header';
import { Sidebar } from '@/components/sidebar';
import { MobileBottomNav } from '@/components/mobile-bottom-nav';
import { MotionProvider } from '@/components/motion-provider';
import { getReportsByPlatform } from '@/lib/data';
import { PLATFORMS } from '@/lib/platforms';
import type { LastRunSummary } from '@/components/nav-header';

// next/font auto-hospeda as fontes no build: sem requisição bloqueante ao Google Fonts e sem
// layout shift na troca de fonte.
const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  display: 'swap',
  variable: '--font-roboto',
});

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-roboto-mono',
});

export const metadata: Metadata = {
  title: 'PDP Monitor — Monitoramento de Features',
  description: 'Dashboard de monitoramento automatizado de features em PDPs Natura/Avon',
};

/** Last run of each live platform (iOS still "em breve" has none), for the header badges. */
function getLastRuns(): LastRunSummary[] {
  return PLATFORMS.filter((p) => !p.upcoming).flatMap(({ platform }) => {
    try {
      const entry = getReportsByPlatform(platform)[0];
      if (!entry) return [];
      const { failed, errors } = entry.summary;
      return [{ platform, runId: entry.runId, startTime: entry.startTime, failed, errors }];
    } catch {
      return [];
    }
  });
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${roboto.variable} ${robotoMono.variable}`}>
      <body className="min-h-dvh bg-background">
        <a
          href="#app-main"
          className="sr-only z-50 rounded-lg bg-surface text-sm font-semibold text-highlight shadow-lift focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:px-4 focus:py-2"
        >
          Pular para o conteúdo
        </a>
        <MotionProvider>
          <NavHeader lastRuns={getLastRuns()} />
          {/* Altura mínima = tela menos o header (69px), para a sidebar ir até o fim em páginas curtas. */}
          <div className="mx-auto flex min-h-[calc(100dvh-69px)] max-w-360 items-start">
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
