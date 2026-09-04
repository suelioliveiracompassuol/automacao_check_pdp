import { BarChart3 } from 'lucide-react';

import { CoverageSection } from '@/components/apresentacao/coverage-section';
import { ErrorMatrixSection } from '@/components/apresentacao/error-matrix-section';
import { EvolutionSection } from '@/components/apresentacao/evolution-section';
import { HeroSection } from '@/components/apresentacao/hero-section';
import { HighlightsSection } from '@/components/apresentacao/highlights-section';
import { PresentationControls } from '@/components/apresentacao/presentation-controls';
import { Card } from '@/components/ui/card';
import { getReportById, getReportIndex } from '@/lib/data';
import { COUNTRY_INFO, type MonitoringReport } from '@/lib/types';
import { TOTAL_CHECKS } from '@/lib/checks-catalog';

/** Section ids used both for anchor scrolling (PresentationControls) and print page-breaks. */
const PRESENTATION_SECTIONS = [
  { id: 'hero', label: 'Início' },
  { id: 'coverage', label: 'Cobertura' },
  { id: 'evolution', label: 'Evolução' },
  { id: 'errors', label: 'Erros' },
  { id: 'highlights', label: 'Destaques' },
];

export default function ApresentacaoPage() {
  const index = getReportIndex();
  const allRuns = index.reports;

  const latestEntry = allRuns[0];
  if (!latestEntry) {
    return (
      <Card className="py-16 text-center">
        <BarChart3 className="mx-auto mb-3 h-8 w-8 text-gray-300" />
        <h1 className="text-lg font-semibold text-gray-900">Nenhuma execução disponível</h1>
        <p className="mt-1 text-sm text-gray-500">
          As métricas de apresentação aparecerão após a primeira execução.
        </p>
      </Card>
    );
  }

  const latestReport = getReportById(latestEntry.runId);

  const last4Reports = allRuns
    .slice(0, 4)
    .map((r) => getReportById(r.runId))
    .filter((r): r is MonitoringReport => r !== null)
    .reverse();

  const evolutionData = allRuns.slice(0, 10).reverse();

  const totalRuns = allRuns.length;
  const latestPassRate =
    latestReport && latestReport.summary.total > 0
      ? Math.round((latestReport.summary.passed / latestReport.summary.total) * 100)
      : 0;

  const countries = latestReport
    ? [...new Set(latestReport.results.map((r) => r.country.toUpperCase()))].sort()
    : [];

  const channelsByCountry = latestReport
    ? latestReport.results.reduce<Map<string, Set<string>>>((channels, result) => {
        const country = result.country.toUpperCase();
        const countryChannels = channels.get(country) ?? new Set<string>();
        countryChannels.add(result.channel ?? 'ecommerce');
        channels.set(country, countryChannels);
        return channels;
      }, new Map())
    : new Map<string, Set<string>>();

  const vendorsByCountry = latestReport
    ? latestReport.results.reduce<Map<string, Set<string>>>((vendors, result) => {
        const country = result.country.toUpperCase();
        const countryVendors = vendors.get(country) ?? new Set<string>();
        countryVendors.add(result.vendor.toLowerCase());
        vendors.set(country, countryVendors);
        return vendors;
      }, new Map())
    : new Map<string, Set<string>>();

  return (
    <div className="space-y-14">
      <PresentationControls sections={PRESENTATION_SECTIONS} />
      <div id="hero" className="scroll-mt-24">
        <HeroSection
          totalRuns={totalRuns}
          latestPassRate={latestPassRate}
          countriesCount={countries.length || Object.keys(COUNTRY_INFO).length}
          checksCount={TOTAL_CHECKS}
        />
      </div>
      <div id="coverage" className="scroll-mt-24">
        <CoverageSection
          countries={countries}
          channelsByCountry={channelsByCountry}
          vendorsByCountry={vendorsByCountry}
        />
      </div>
      <div id="evolution" className="scroll-mt-24">
        <EvolutionSection evolutionData={evolutionData} />
      </div>
      <div id="errors" className="scroll-mt-24">
        <ErrorMatrixSection reports={last4Reports} />
      </div>
      <div id="highlights" className="scroll-mt-24">
        <HighlightsSection />
      </div>
    </div>
  );
}
