import { BarChart3 } from 'lucide-react';

import type { PlatformCoverageData } from '@/components/visao-geral/coverage-section';
import {
  HeroSection,
  type PlatformKpi,
  type PlatformStat,
} from '@/components/visao-geral/hero-section';
import { HighlightsSection } from '@/components/visao-geral/highlights-section';
import { PlatformTabs, type PlatformSectionData } from '@/components/visao-geral/platform-tabs';
import { Card } from '@/components/ui/card';
import { getReportById, getReportIndex } from '@/lib/data';
import { TOTAL_CHECKS } from '@/lib/checks-catalog';
import { PLATFORMS } from '@/lib/platforms';
import { type MonitoringReport, type Platform, type ReportIndexEntry } from '@/lib/types';

const PLATFORM_IDS: Platform[] = PLATFORMS.map((p) => p.platform);

function passRateOf(report: MonitoringReport | null): number | null {
  if (!report || report.summary.total === 0) return null;
  return Math.round((report.summary.passed / report.summary.total) * 100);
}

function loadReports(entries: ReportIndexEntry[]): MonitoringReport[] {
  return entries
    .map((r) => getReportById(r.runId))
    .filter((r): r is MonitoringReport => r !== null);
}

export default function HomePage() {
  const index = getReportIndex();
  const allRuns = index.reports;

  const latestEntry = allRuns[0];
  if (!latestEntry) {
    return (
      <Card className="py-16 text-center">
        <BarChart3 className="mx-auto mb-3 h-8 w-8 text-primary-light" />
        <h1 className="text-lg font-bold text-highlight">Nenhuma execução disponível</h1>
        <p className="mt-1 text-sm text-medium-emphasis">
          As métricas aparecerão aqui após a primeira execução.
        </p>
      </Card>
    );
  }

  const runsByPlatform = Object.fromEntries(
    PLATFORM_IDS.map((p) => [p, allRuns.filter((r) => (r.platform ?? 'web') === p)]),
  ) as Record<Platform, ReportIndexEntry[]>;

  const platformKpis: PlatformKpi[] = PLATFORMS.filter(
    (meta) => !meta.upcoming && runsByPlatform[meta.platform].length > 0,
  ).map((meta) => {
    const runs = runsByPlatform[meta.platform];
    const latest = getReportById(runs[0].runId);
    const results = latest?.results ?? [];
    const featureKeys = new Set(results.flatMap((r) => r.features.map((f) => f.featureKey)));
    return {
      meta,
      runsCount: runs.length,
      countries: [...new Set(results.map((r) => r.country.toUpperCase()))].sort(),
      pdpsCount: results.length,
      checksCount: meta.platform === 'web' ? TOTAL_CHECKS : featureKeys.size,
      lastRunAt: runs[0].startTime,
    };
  });

  const platformSections: PlatformSectionData[] = PLATFORMS.map(({ platform, upcoming }) => {
    const runs = upcoming ? [] : runsByPlatform[platform];
    const latest = runs[0] ? getReportById(runs[0].runId) : null;
    const results = latest?.results ?? [];
    const vendorsByCountry: Record<string, Set<string>> = {};
    const channelsByCountry: Record<string, Set<string>> = {};
    for (const r of results) {
      const country = r.country.toUpperCase();
      (vendorsByCountry[country] ??= new Set()).add(r.vendor.toLowerCase());
      (channelsByCountry[country] ??= new Set()).add(r.channel ?? 'ecommerce');
    }
    const toArrays = (m: Record<string, Set<string>>) =>
      Object.fromEntries(Object.entries(m).map(([k, v]) => [k, [...v]]));
    const coverage: PlatformCoverageData = {
      platform,
      hasRuns: results.length > 0,
      countries: Object.keys(vendorsByCountry).sort(),
      vendorsByCountry: toArrays(vendorsByCountry),
      channelsByCountry: toArrays(channelsByCountry),
      featureKeys:
        platform === 'web'
          ? undefined
          : [...new Set(results.flatMap((r) => r.features.map((f) => f.featureKey)))],
    };
    return {
      platform,
      coverage,
      breakdown: {
        evolutionData: runs.slice(0, 10).reverse(),
        reports: loadReports(runs.slice(0, 4)).reverse(),
      },
    };
  });

  const platformStats: PlatformStat[] = PLATFORMS.map((meta) => {
    const runs = meta.upcoming ? [] : runsByPlatform[meta.platform];
    const latest = runs[0] ? getReportById(runs[0].runId) : null;
    return {
      meta,
      passRate: passRateOf(latest),
      runsCount: runs.length,
      lastRunAt: runs[0]?.startTime ?? null,
      trend: runs
        .slice(0, 10)
        .reverse()
        .map((r) =>
          r.summary.total > 0 ? Math.round((r.summary.passed / r.summary.total) * 100) : 0,
        ),
    };
  });

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
