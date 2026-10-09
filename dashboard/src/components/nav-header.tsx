import Link from 'next/link';
import { cn, formatDate } from '@/lib/utils';

export interface LastRunSummary {
  startTime: string;
  failed: number;
  errors: number;
}

/** Health of the most recent daily (web) run — derived from the report index at build time,
 * so the badge never claims "all good" when the last run had failures. */
function LastRunStatus({ startTime, failed, errors }: LastRunSummary) {
  const problems = failed + errors;
  const ok = problems === 0;
  const label = ok
    ? 'Última execução sem falhas'
    : `${problems} ${problems === 1 ? 'falha' : 'falhas'} na última execução`;

  return (
    <div
      title={`${label} — ${formatDate(startTime)}`}
      className={cn(
        'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium',
        ok
          ? 'border-success-lightest bg-success-lightest/50 text-success-dark'
          : 'border-alert-lightest bg-alert-lightest/60 text-alert-dark',
      )}
    >
      <span
        aria-hidden="true"
        className={cn('h-2 w-2 shrink-0 rounded-full', ok ? 'bg-success' : 'bg-alert')}
      />
      <span className="sr-only sm:not-sr-only">{label}</span>
    </div>
  );
}

export function NavHeader({ lastRun }: { lastRun?: LastRunSummary | null }) {
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
          {lastRun && <LastRunStatus {...lastRun} />}
        </div>
      </div>
    </header>
  );
}
