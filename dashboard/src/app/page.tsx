import { BarChart3 } from 'lucide-react';

import { EmptyState } from '@/components/empty-state';
import { CoverageSection } from '@/components/visao-geral/coverage-section';
import { HeroSection, type PlatformStat } from '@/components/visao-geral/hero-section';
import { HighlightsSection } from '@/components/visao-geral/highlights-section';
import {
  PlatformBreakdownSection,
  type PlatformBreakdownData,
} from '@/components/visao-geral/platform-breakdown-section';
import { TOTAL_CHECKS } from '@/lib/checks-catalog';
import { getReportById, getReportIndex, getReportsByPlatform } from '@/lib/data';
import { PLATFORM_META, PLATFORMS } from '@/lib/platforms';
import { groupByCountry, passRate } from '@/lib/report';
import type { MonitoringReport, ReportIndexEntry } from '@/lib/types';

/** Execuções exibidas no gráfico de evolução e na matriz de erros. */
const EVOLUTION_RUNS = 10;
const MATRIX_RUNS = 4;

function loadReports(entries: ReportIndexEntry[]): MonitoringReport[] {
  return entries
    .map((r) => getReportById(r.runId))
    .filter((r): r is MonitoringReport => r !== null);
}

const entryPassRate = (r: { summary: { passed: number; total: number } }) =>
  passRate(r.summary.passed, r.summary.total);

export default function HomePage() {
  if (getReportIndex().reports.length === 0) {
    return (
      <EmptyState
        icon={<BarChart3 />}
        title="Nenhuma execução disponível"
        description="As métricas aparecerão aqui após a primeira execução."
      />
    );
  }

  // Plataformas "em breve" não têm execuções a exibir, mesmo que existam entradas de teste.
  const runsOf = (meta: (typeof PLATFORMS)[number]) =>
    meta.upcoming ? [] : getReportsByPlatform(meta.platform);

  const webRuns = getReportsByPlatform('web');
  const latestWebReport = webRuns[0] ? getReportById(webRuns[0].runId) : null;
  const webResults = latestWebReport?.results ?? [];

  const channelsByCountry = groupByCountry(webResults, (r) => r.channel ?? 'ecommerce');
  const vendorsByCountry = groupByCountry(webResults, (r) => r.vendor.toLowerCase());
  const countries = [...channelsByCountry.keys()].sort();

  const platformStats: PlatformStat[] = PLATFORMS.map((meta) => {
    const runs = runsOf(meta);
    const latest = runs[0] ? getReportById(runs[0].runId) : null;
    return {
      meta,
      passRate: latest && latest.summary.total > 0 ? entryPassRate(latest) : null,
      runsCount: runs.length,
      lastRunAt: runs[0]?.startTime ?? null,
      trend: runs.slice(0, EVOLUTION_RUNS).reverse().map(entryPassRate),
    };
  });

  // Todas as plataformas ganham uma aba; as sem execuções mostram um estado vazio.
  const platformBreakdown: PlatformBreakdownData[] = PLATFORMS.map((meta) => {
    const runs = runsOf(meta);
    return {
      platform: meta.platform,
      label: meta.label,
      evolutionData: runs.slice(0, EVOLUTION_RUNS).reverse(),
      reports: loadReports(runs.slice(0, MATRIX_RUNS)).reverse(),
    };
  });

  return (
    <div className="space-y-16 animate-fade-in-up">
      <div id="hero" className="scroll-mt-24">
        <HeroSection
          kpiPlatform={PLATFORM_META.web}
          totalRuns={webRuns.length}
          countriesCount={countries.length}
          checksCount={TOTAL_CHECKS}
          lastRunAt={webRuns[0]?.startTime ?? null}
          platformStats={platformStats}
        />
      </div>
      <div id="coverage" className="scroll-mt-24">
        <CoverageSection
          countries={countries}
          channelsByCountry={channelsByCountry}
          vendorsByCountry={vendorsByCountry}
        />
      </div>

      <div id="platform-breakdown" className="scroll-mt-24">
        <PlatformBreakdownSection data={platformBreakdown} />
      </div>

      <div id="highlights" className="scroll-mt-24">
        <HighlightsSection />
      </div>
    </div>
  );
}
