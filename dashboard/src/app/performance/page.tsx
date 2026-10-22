import { Gauge, Info } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { SkuPerfCard } from '@/components/performance/sku-perf-card';
import { PerformanceHistory } from '@/components/performance/performance-history';
import { PerfReportDownloads } from '@/components/performance/perf-report-downloads';
import { getPerfIndex, getPerfReportDownloads, getPerfRun } from '@/lib/data';
import { formatDateTime, formatKbps } from '@/lib/format';
import type { PerfRun } from '@/lib/types';

export const metadata = {
  title: 'Performance da PDP',
};

/** Mesma janela em que o workflow mantém os relatórios completos do Lighthouse. */
const REPORT_RETENTION_DAYS = 10;

/** Descrição das condições de teste (equivalentes ao WebPageTest), quando a rodada as registra. */
function describeConditions(conditions: PerfRun['conditions']): string | null {
  if (!conditions) return null;
  const { connectivity, downKbps, upKbps, rttMs, viewport } = conditions;
  return `${connectivity} (${formatKbps(downKbps)}/${formatKbps(upKbps)}, ${rttMs} ms) · tela ${viewport}`;
}

export default function PerformancePage() {
  const index = getPerfIndex();

  if (index.runs.length === 0) {
    return (
      <EmptyState
        icon={<Gauge />}
        title="Performance da PDP"
        description="Ainda não há medições de performance. Elas são geradas diariamente pelo job perf do workflow PDP Feature Monitor."
      />
    );
  }

  const [latestEntry, previousEntry] = index.runs;
  const latest = getPerfRun(latestEntry.runId);
  const previous = previousEntry ? getPerfRun(previousEntry.runId) : null;

  const runsPerSku = latest?.runsPerSku ?? 3;
  const formattedDate = formatDateTime(latest?.timestamp || latestEntry.timestamp);
  const conditionsText = describeConditions(latest?.conditions);

  return (
    <div className="space-y-8 animate-fade-in-up pb-12">
      {/* Cabeçalho */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-wash text-primary-dark">
            <Gauge className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-highlight sm:text-3xl">
              Performance da PDP
            </h1>
            <p className="text-xs sm:text-sm text-medium-emphasis">
              Lighthouse desktop · {conditionsText ? `${conditionsText} · ` : ''}mediana de{' '}
              {runsPerSku} execuções · última medição em {formattedDate}
            </p>
          </div>
        </div>

        {/* Nota explicativa sobre laboratório */}
        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-neutral-75 bg-surface p-3 text-xs text-medium-emphasis shadow-tiny">
          <Info className="h-4 w-4 shrink-0 text-primary-dark mt-0.5" aria-hidden="true" />
          <p>
            Métricas de laboratório medidas no Chromium desktop com a mesma conexão e tela da
            automação do WebPageTest. O <strong>Total Blocking Time (TBT)</strong> é utilizado como
            substituto laboratorial do Interaction to Next Paint (INP).
          </p>
        </div>
      </div>

      {/* Cards por SKU */}
      {latest && latest.results.length > 0 && (
        <section aria-labelledby="skus-perf-title" className="space-y-4">
          <h2 id="skus-perf-title" className="text-lg font-bold text-highlight">
            SKUs Monitorados
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {latest.results.map((skuResult) => {
              const prevSkuResult = previous?.results.find((r) => r.sku === skuResult.sku);
              return (
                <SkuPerfCard
                  key={skuResult.sku}
                  result={skuResult}
                  previous={prevSkuResult?.median ?? null}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Seção Evolução */}
      <section aria-label="Histórico de performance por tipo de PDP">
        <PerformanceHistory runs={index.runs} />
      </section>

      <PerfReportDownloads
        runs={getPerfReportDownloads(REPORT_RETENTION_DAYS)}
        days={REPORT_RETENTION_DAYS}
      />
    </div>
  );
}
