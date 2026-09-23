import { BarChart3, Globe, Zap, type LucideIcon } from 'lucide-react';
import { FaAndroid, FaApple } from 'react-icons/fa';
import { cn } from '@/lib/utils';

export interface PlatformStat {
  label: string;
  /** null when the platform has no runs yet (e.g. iOS before it ships). */
  passRate: number | null;
  runsCount: number;
}

interface HeroSectionProps {
  totalRuns: number;
  /** Per-platform pass-rate breakdown — each stack has its own scope/checks, so they're shown
   * side by side instead of blended into one "overall" number that wouldn't mean much. */
  platformStats: PlatformStat[];
}

const PLATFORM_STYLE: Record<
  string,
  { icon: LucideIcon | typeof FaAndroid; accent: string; ring: string }
> = {
  Web: {
    icon: Globe,
    accent: 'text-indigo-300 bg-indigo-500/15 border-indigo-400/20',
    ring: 'ring-indigo-400/30',
  },
  Android: {
    icon: FaAndroid,
    accent: 'text-emerald-300 bg-emerald-500/15 border-emerald-400/20',
    ring: 'ring-emerald-400/30',
  },
  iOS: {
    icon: FaApple,
    accent: 'text-slate-300 bg-white/5 border-white/10',
    ring: 'ring-white/10',
  },
};

function PlatformStatCard({ label, passRate, runsCount }: PlatformStat) {
  const style = PLATFORM_STYLE[label] ?? PLATFORM_STYLE.Web;
  const Icon = style.icon;
  const hasRuns = runsCount > 0 && passRate !== null;

  return (
    <div
      className={cn(
        'rounded-xl border p-4 backdrop-blur-sm ring-1 ring-inset',
        hasRuns ? style.accent : 'border-white/10 bg-white/5 text-slate-400 ring-white/5',
        hasRuns && style.ring,
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <span className="text-sm font-semibold">{label}</span>
      </div>
      {hasRuns ? (
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white">{passRate}%</span>
          <span className="text-xs opacity-70">
            {runsCount} execuç{runsCount === 1 ? 'ão' : 'ões'}
          </span>
        </div>
      ) : (
        <div className="mt-2 text-sm text-slate-500">Sem execuções ainda</div>
      )}
    </div>
  );
}

export function HeroSection({ totalRuns, platformStats }: HeroSectionProps) {
  return (
    <section aria-labelledby="hero-heading" className="-mx-4 -mt-6 sm:-mx-6">
      <div className="relative overflow-hidden bg-linear-to-br from-slate-900 via-indigo-950 to-slate-900 px-8 py-12 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-indigo-500 via-transparent to-transparent opacity-30" />
        <div className="relative z-10 mx-auto max-w-7xl">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-400/20 bg-indigo-500/20 px-3 py-1 text-xs font-medium text-indigo-300">
              <Zap className="h-3 w-3" />
              Automação de Qualidade PDP
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
              <BarChart3 className="h-3 w-3" />
              {totalRuns} execuções ao todo
            </span>
          </div>
          <h1
            id="hero-heading"
            className="mb-3 text-3xl font-bold tracking-tight text-white md:text-4xl"
          >
            Visão Geral da Automação
          </h1>
          <p className="mb-8 max-w-2xl text-base text-indigo-200/80">
            Monitoramento contínuo de features nas páginas de produto das operações Natura &amp;
            Avon em múltiplos países da América Latina.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {platformStats.map((stat) => (
              <PlatformStatCard key={stat.label} {...stat} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
