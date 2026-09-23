import { BarChart3 } from 'lucide-react';

import { CoverageSection } from '@/components/visao-geral/coverage-section';
import { HeroSection, type PlatformStat } from '@/components/visao-geral/hero-section';
import { HighlightsSection } from '@/components/visao-geral/highlights-section';
import {
  PlatformBreakdownSection,
  type PlatformBreakdownData,
} from '@/components/visao-geral/platform-breakdown-section';
import { Card } from '@/components/ui/card';
import { getReportById, getReportIndex } from '@/lib/data';
import { type MonitoringReport, type Platform, type ReportIndexEntry } from '@/lib/types';

const PLATFORMS: Platform[] = ['web', 'android', 'ios'];
const PLATFORM_LABELS: Record<Platform, string> = { web: 'Web', android: 'Android', ios: 'iOS' };

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
        <BarChart3 className="mx-auto mb-3 h-8 w-8 text-gray-300" />
        <h1 className="text-lg font-semibold text-gray-900">Nenhuma execução disponível</h1>
        <p className="mt-1 text-sm text-gray-500">
          As métricas aparecerão aqui após a primeira execução.
        </p>
      </Card>
    );
  }

  const runsByPlatform = Object.fromEntries(
    PLATFORMS.map((p) => [p, allRuns.filter((r) => (r.platform ?? 'web') === p)]),
  ) as Record<Platform, ReportIndexEntry[]>;

  // Coverage (countries/channels/vendors) reflects site operations, so it's grounded in the
  // latest Web report specifically — an Android run becoming the most recent entry shouldn't
  // suddenly shrink "coverage" down to a single country/vendor.
  const latestWebEntry = runsByPlatform.web[0] ?? latestEntry;
  const latestWebReport = getReportById(latestWebEntry.runId);

  const totalRuns = allRuns.length;

  const countries = latestWebReport
    ? [...new Set(latestWebReport.results.map((r) => r.country.toUpperCase()))].sort()
    : [];

  const channelsByCountry = latestWebReport
    ? latestWebReport.results.reduce<Map<string, Set<string>>>((channels, result) => {
        const country = result.country.toUpperCase();
        const countryChannels = channels.get(country) ?? new Set<string>();
        countryChannels.add(result.channel ?? 'ecommerce');
        channels.set(country, countryChannels);
        return channels;
      }, new Map())
    : new Map<string, Set<string>>();

  const vendorsByCountry = latestWebReport
    ? latestWebReport.results.reduce<Map<string, Set<string>>>((vendors, result) => {
        const country = result.country.toUpperCase();
        const countryVendors = vendors.get(country) ?? new Set<string>();
        countryVendors.add(result.vendor.toLowerCase());
        vendors.set(country, countryVendors);
        return vendors;
      }, new Map())
    : new Map<string, Set<string>>();

  const platformStats: PlatformStat[] = PLATFORMS.map((p) => {
    const runs = runsByPlatform[p];
    const latest = runs[0] ? getReportById(runs[0].runId) : null;
    return { label: PLATFORM_LABELS[p], passRate: passRateOf(latest), runsCount: runs.length };
  });

  const platformBreakdown: PlatformBreakdownData[] = PLATFORMS.filter(
    (p) => runsByPlatform[p].length > 0,
  ).map((p) => {
    const runs = runsByPlatform[p];
    return {
      platform: p,
      label: PLATFORM_LABELS[p],
      evolutionData: runs.slice(0, 10).reverse(),
      reports: loadReports(runs.slice(0, 4)).reverse(),
    };
  });

  return (
    <div className="space-y-14">
      <div id="hero" className="scroll-mt-24">
        <HeroSection totalRuns={totalRuns} platformStats={platformStats} />
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

      {/* Evolução histórica e matriz de erros por stack, em tabs (Web primeiro) — plataformas
          sem execuções ainda (ex.: iOS antes do primeiro run) não geram uma tab vazia. */}

      <div id="highlights" className="scroll-mt-24">
        <HighlightsSection />
      </div>
    </div>
  );
}
