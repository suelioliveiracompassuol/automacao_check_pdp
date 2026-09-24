import Link from 'next/link';
import { ArrowUpRight, CalendarClock, Globe2, ListChecks, PlayCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import type { PlatformMeta } from '@/lib/platforms';
import { cn, formatDate } from '@/lib/utils';

export interface PlatformStat {
  meta: PlatformMeta;
  /** null when the platform has no runs yet (e.g. iOS before it ships). */
  passRate: number | null;
  runsCount: number;
  lastRunAt: string | null;
  /** Pass rate of the most recent runs, oldest first — drawn as a sparkline. */
  trend: number[];
}

interface HeroSectionProps {
  totalRuns: number;
  countriesCount: number;
  checksCount: number;
  lastRunAt: string | null;
  /** Per-platform pass-rate breakdown — each stack has its own scope/checks, so they're shown
   * side by side instead of blended into one "overall" number that wouldn't mean much. */
  platformStats: PlatformStat[];
}

function rateTone(rate: number) {
  if (rate >= 90) return { text: 'text-success-dark', bar: 'bg-success', stroke: '#2f833e' };
  if (rate >= 70) return { text: 'text-secondary-darkest', bar: 'bg-warning', stroke: '#e5b815' };
  return { text: 'text-alert-dark', bar: 'bg-alert', stroke: '#de3529' };
}

function Sparkline({ values, stroke }: { values: number[]; stroke: string }) {
  if (values.length < 2) return null;
  const w = 120;
  const h = 36;
  const min = Math.min(...values, 50);
  const range = Math.max(100 - min, 1);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - ((v - min) / range) * h]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg viewBox={`-2 -4 ${w + 4} ${h + 8}`} className="h-9 w-28" aria-hidden="true">
      <path d={d} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r={3} fill={stroke} />
    </svg>
  );
}

function PlatformCard({ meta, passRate, runsCount, lastRunAt, trend }: PlatformStat) {
  const Icon = meta.icon;
  const live = !meta.upcoming && passRate !== null;
  const tone = live ? rateTone(passRate) : null;

  return (
    <Link
      href={meta.href}
      className={cn(
        'group relative flex flex-col rounded-card border bg-surface p-5 transition-all duration-200',
        live
          ? 'border-neutral-75 shadow-soft hover:-translate-y-0.5 hover:border-primary-lightest hover:shadow-lift'
          : 'border-dashed border-neutral-100 hover:border-primary-lightest',
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full',
              live ? 'bg-primary-wash text-brand' : 'bg-neutral-50 text-low-emphasis',
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <p className="font-bold text-highlight">{meta.label}</p>
            <p className="text-xs text-medium-emphasis">{meta.channel}</p>
          </div>
        </div>
        {live ? (
          <ArrowUpRight className="h-4 w-4 text-low-emphasis transition-colors group-hover:text-primary-dark" />
        ) : (
          <span className="rounded-full bg-secondary-lightest/60 px-2.5 py-0.5 text-[10px] font-bold tracking-widest text-secondary-darkest uppercase">
            {meta.upcoming ? 'Em breve' : 'Sem dados'}
          </span>
        )}
      </div>

      {live && tone ? (
        <>
          <div className="mt-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium tracking-wide text-low-emphasis uppercase">
                Taxa de aprovação
              </p>
              <p className={cn('text-4xl font-bold tracking-tight', tone.text)}>{passRate}%</p>
            </div>
            <Sparkline values={trend} stroke={tone.stroke} />
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-75">
            <div
              className={cn('h-full rounded-full', tone.bar)}
              style={{ width: `${passRate}%` }}
            />
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-neutral-75 pt-3 text-xs text-medium-emphasis">
            <span>
              {runsCount} execuç{runsCount === 1 ? 'ão' : 'ões'}
            </span>
            {lastRunAt && <span>Última: {formatDate(lastRunAt)}</span>}
          </div>
        </>
      ) : (
        <p className="mt-5 text-sm text-medium-emphasis">
          {meta.upcoming
            ? 'Monitoramento planejado no roadmap. Os resultados aparecem aqui após a primeira execução.'
            : 'Nenhuma execução registrada ainda.'}
        </p>
      )}
    </Link>
  );
}

function Kpi({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-primary-dark shadow-tiny">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium tracking-wide text-medium-emphasis uppercase">
          {label}
        </p>
        <p className="truncate text-sm font-bold text-highlight">{value}</p>
      </div>
    </div>
  );
}

export function HeroSection({
  totalRuns,
  countriesCount,
  checksCount,
  lastRunAt,
  platformStats,
}: HeroSectionProps) {
  return (
    <section aria-labelledby="hero-heading" className="space-y-5">
      <div className="relative overflow-hidden rounded-card bg-primary-wash px-6 py-8 sm:px-10 sm:py-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 -right-20 h-80 w-80 rounded-full bg-secondary-lightest/60 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-1/3 -bottom-40 h-72 w-72 rounded-full bg-primary-lightest/50 blur-3xl"
        />
        <div className="relative">
          <p className="mb-2 text-[11px] font-bold tracking-widest text-primary-dark uppercase">
            Automação de Qualidade PDP
          </p>
          <h1
            id="hero-heading"
            className="text-3xl font-bold tracking-tight text-highlight md:text-4xl"
          >
            Visão geral da automação
          </h1>
          <p className="mt-3 max-w-2xl text-base text-medium-emphasis">
            Monitoramento contínuo de features nas páginas de produto das operações Natura &amp;
            Avon em múltiplos países da América Latina.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-5 lg:grid-cols-4">
            <Kpi icon={<PlayCircle className="h-4 w-4" />} label="Execuções" value={totalRuns} />
            <Kpi
              icon={<Globe2 className="h-4 w-4" />}
              label="Países"
              value={`${countriesCount} monitorados`}
            />
            <Kpi
              icon={<ListChecks className="h-4 w-4" />}
              label="Checagens"
              value={`${checksCount} por PDP`}
            />
            <Kpi
              icon={<CalendarClock className="h-4 w-4" />}
              label="Última execução"
              value={lastRunAt ? formatDate(lastRunAt) : '—'}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {platformStats.map((stat) => (
          <PlatformCard key={stat.meta.platform} {...stat} />
        ))}
      </div>
    </section>
  );
}
