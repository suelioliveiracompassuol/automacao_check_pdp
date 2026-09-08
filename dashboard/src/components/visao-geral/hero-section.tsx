import { BarChart3, Globe, Shield, TrendingUp, Zap } from 'lucide-react';
import { HeroMetric } from './hero-metrics';

interface HeroSectionProps {
  totalRuns: number;
  latestPassRate: number;
  countriesCount: number;
  checksCount: number;
}

export function HeroSection({
  totalRuns,
  latestPassRate,
  countriesCount,
  checksCount,
}: HeroSectionProps) {
  return (
    <section aria-labelledby="hero-heading" className="-mx-4 -mt-6 sm:-mx-6">
      <div className="relative overflow-hidden bg-linear-to-br from-slate-900 via-indigo-950 to-slate-900 px-8 py-12 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-indigo-500 via-transparent to-transparent opacity-30" />
        <div className="relative z-10 mx-auto max-w-7xl">
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-indigo-400/20 bg-indigo-500/20 px-3 py-1 text-xs font-medium text-indigo-300">
            <Zap className="h-3 w-3" />
            Automação de Qualidade PDP
          </span>
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
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <HeroMetric label="Execuções realizadas" value={String(totalRuns)} icon={BarChart3} />
            <HeroMetric
              label="Taxa de aprovação atual"
              value={`${latestPassRate}%`}
              icon={TrendingUp}
            />
            <HeroMetric label="Países monitorados" value={String(countriesCount)} icon={Globe} />
            <HeroMetric label="Checks por PDP" value={String(checksCount)} icon={Shield} />
          </div>
        </div>
      </div>
    </section>
  );
}
