import Link from 'next/link';
import { formatDate } from '@/lib/format';
import { PLATFORM_META } from '@/lib/platforms';
import type { Platform } from '@/lib/types';
import { cn } from '@/lib/utils';

export interface LastRunSummary {
  platform: Platform;
  runId: string;
  startTime: string;
  failed: number;
  errors: number;
}

/** Health of a platform's most recent run — derived from the report index at build time,
 * so the badge never claims "all good" when the last run had failures. Links to that run. */
function LastRunStatus({ platform, runId, startTime, failed, errors }: LastRunSummary) {
  const { label: platformLabel, href } = PLATFORM_META[platform];
  const problems = failed + errors;
  const ok = problems === 0;
  const status = ok ? 'sem falhas' : `${problems} ${problems === 1 ? 'falha' : 'falhas'}`;
  const label = `${platformLabel}: ${status} na última execução`;

  return (
    <Link
      href={`${href}/${runId}`}
      aria-label={label}
      title={`${label} — ${formatDate(startTime)}`}
      className={cn(
        'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
        ok
          ? 'border-success-lightest bg-success-lightest/50 text-success-dark hover:bg-success-lightest'
          : 'border-alert-lightest bg-alert-lightest/60 text-alert-dark hover:bg-alert-lightest',
      )}
    >
      <span
        aria-hidden="true"
        className={cn('h-2 w-2 shrink-0 rounded-full', ok ? 'bg-success' : 'bg-alert')}
      />
      <span aria-hidden="true">
        <span className="font-bold">{platformLabel}</span>
        <span className="hidden sm:inline"> · {status}</span>
      </span>
    </Link>
  );
}

export function NavHeader({ lastRuns = [] }: { lastRuns?: LastRunSummary[] }) {
  return (
    <header id="app-nav-header" className="sticky top-0 z-40 bg-surface/90 backdrop-blur-lg">
      <div className="bg-brand-gradient h-1" aria-hidden="true" />
      <div className="border-b border-neutral-75">
        <div className="mx-auto flex h-16 max-w-360 items-center justify-between px-4 sm:px-8 lg:px-10">
          <Link href="/" className="group flex items-center gap-3">
            {/* <span className="text-2xl leading-none font-bold tracking-tight text-brand lowercase">
              natura
            </span> */}
            {/* <span className="h-6 w-px bg-neutral-100" aria-hidden="true" /> */}
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-bold text-highlight transition-colors group-hover:text-primary-darkest">
                PDP Monitor
              </span>
              <span className="hidden text-[11px] text-medium-emphasis sm:block">
                Página de Detalhes de Produto
              </span>
            </span>
          </Link>
          {lastRuns.length > 0 && (
            <nav aria-label="Status das automações" className="flex items-center gap-2">
              {lastRuns.map((run) => (
                <LastRunStatus key={run.platform} {...run} />
              ))}
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}
