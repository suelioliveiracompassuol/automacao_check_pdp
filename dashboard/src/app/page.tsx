import { BarChart3 } from 'lucide-react';

import { EmptyState } from '@/components/empty-state';
import type { PlatformCoverageData } from '@/components/visao-geral/coverage-section';
import {
  HeroSection,
  type PlatformKpi,
  type PlatformStat,
} from '@/components/visao-geral/hero-section';
import { HighlightsSection } from '@/components/visao-geral/highlights-section';
import { PlatformTabs, type PlatformSectionData } from '@/components/visao-geral/platform-tabs';
import { TOTAL_CHECKS } from '@/lib/checks-catalog';
import { getReportById, getReportIndex, getReportsByPlatform } from '@/lib/data';
import { PLATFORMS, type PlatformMeta } from '@/lib/platforms';
import { groupByCountry, passRate } from '@/lib/report';
import type { MonitoringReport, PdpCheckResult, ReportIndexEntry } from '@/lib/types';

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

/** Map<país, Set> → objeto de arrays: os dados cruzam para um componente cliente (PlatformTabs),
 * e Map/Set não são serializáveis nessa fronteira. */
function toRecord(groups: Map<string, Set<string>>): Record<string, string[]> {
  return Object.fromEntries([...groups].map(([country, values]) => [country, [...values]]));
}

/** Checagens da plataforma: as declaradas em PLATFORMS ou, sem elas, as da última execução. */
const featureKeysOf = (meta: PlatformMeta, results: PdpCheckResult[]): string[] =>
  meta.featureKeys ?? [...new Set(results.flatMap((r) => r.features.map((f) => f.featureKey)))];

/** Execuções da plataforma, mais recentes primeiro; "em breve" não exibe nada, mesmo com dados. */
const runsOf = (meta: PlatformMeta) => (meta.upcoming ? [] : getReportsByPlatform(meta.platform));

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

  const platforms = PLATFORMS.map((meta) => {
    const runs = runsOf(meta);
    const latest = runs[0] ? getReportById(runs[0].runId) : null;
    return { meta, runs, latest, results: latest?.results ?? [] };
  });

  const platformKpis: PlatformKpi[] = platforms
    .filter(({ runs }) => runs.length > 0)
    .map(({ meta, runs, results }) => ({
      meta,
      runsCount: runs.length,
      countries: [...new Set(results.map((r) => r.country.toUpperCase()))].sort(),
      pdpsCount: results.length,
      // Web roda o catálogo inteiro; Android só as features que o app suporta.
      checksCount: meta.platform === 'web' ? TOTAL_CHECKS : featureKeysOf(meta, results).length,
      lastRunAt: runs[0].startTime,
    }));

  const platformSections: PlatformSectionData[] = platforms.map(({ meta, runs, results }) => {
    const vendorsByCountry = groupByCountry(results, (r) => r.vendor.toLowerCase());
    const coverage: PlatformCoverageData = {
      platform: meta.platform,
      hasRuns: results.length > 0,
      countries: [...vendorsByCountry.keys()].sort(),
      vendorsByCountry: toRecord(vendorsByCountry),
      channelsByCountry: toRecord(groupByCountry(results, (r) => r.channel ?? 'ecommerce')),
      featureKeys: meta.platform === 'web' ? undefined : featureKeysOf(meta, results),
    };
    return {
      platform: meta.platform,
      coverage,
      breakdown: {
        evolutionData: runs.slice(0, EVOLUTION_RUNS).reverse(),
        reports: loadReports(runs.slice(0, MATRIX_RUNS)).reverse(),
      },
    };
  });

  const platformStats: PlatformStat[] = platforms.map(({ meta, runs, latest }) => ({
    meta,
    passRate: latest && latest.summary.total > 0 ? entryPassRate(latest) : null,
    runsCount: runs.length,
    lastRunAt: runs[0]?.startTime ?? null,
    trend: runs.slice(0, EVOLUTION_RUNS).reverse().map(entryPassRate),
  }));

  return (
    <div className="space-y-16 animate-fade-in-up">
      <div id="hero" className="scroll-mt-24">
        <HeroSection platformKpis={platformKpis} platformStats={platformStats} />
      </div>

      <PlatformTabs data={platformSections} />

      <div id="highlights" className="scroll-mt-24">
        <HighlightsSection />
      </div>
    </div>
  );
}
