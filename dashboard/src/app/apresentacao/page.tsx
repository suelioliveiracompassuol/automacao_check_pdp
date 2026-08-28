import { getReportIndex, getReportById } from '@/lib/data';
import { Card } from '@/components/ui/card';
import { HeroSection } from '@/components/apresentacao/hero-section';
import { CoverageSection } from '@/components/apresentacao/coverage-section';
import { EvolutionSection } from '@/components/apresentacao/evolution-section';
import { ErrorMatrixSection } from '@/components/apresentacao/error-matrix-section';
import { ImpactSection } from '@/components/apresentacao/impact-section';
import { NextStepsSection } from '@/components/apresentacao/next-steps-section';
import type { MonitoringReport } from '@/lib/types';
import { BarChart3 } from 'lucide-react';

const COUNTRY_INFO: Record<string, { label: string }> = {
  AR: { label: 'Argentina' },
  BR: { label: 'Brasil' },
  CL: { label: 'Chile' },
  CO: { label: 'Colômbia' },
  MX: { label: 'México' },
  PE: { label: 'Peru' },
};

const CHECK_CARDS_COUNT = 10;

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

  return (
    <div className="space-y-14">
      <HeroSection
        totalRuns={totalRuns}
        latestPassRate={latestPassRate}
        countriesCount={countries.length || Object.keys(COUNTRY_INFO).length}
        checksCount={CHECK_CARDS_COUNT}
      />

      <CoverageSection countries={countries} channelsByCountry={channelsByCountry} />

      <EvolutionSection evolutionData={evolutionData} />

      <ErrorMatrixSection reports={last4Reports} />

      <ImpactSection />

      <NextStepsSection />
    </div>
  );
}
