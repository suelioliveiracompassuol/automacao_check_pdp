import { Gauge, Info } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { SkuPerfCard } from '@/components/performance/sku-perf-card';
import { PerformanceTrends } from '@/components/performance/performance-trends';
import { getPerfIndex, getPerfRun } from '@/lib/data';

export const metadata = {
  title: 'Performance da PDP',
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

export default function PerformancePage() {
  const index = getPerfIndex();

  if (!index.runs || index.runs.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <Card className="py-16 text-center">
          <Gauge className="mx-auto mb-3 h-10 w-10 text-primary-light" />
          <h1 className="text-xl font-bold text-highlight">Performance da PDP</h1>
          <p className="mt-2 text-sm text-medium-emphasis max-w-lg mx-auto">
            Ainda não há medições de performance. Elas são geradas diariamente pelo job perf do
            workflow PDP Feature Monitor.
          </p>
        </Card>
      </div>
    );
  }

  const latestRunId = index.runs[0].runId;
  const latest = getPerfRun(latestRunId);
  const previousRunId = index.runs[1]?.runId;
  const previous = previousRunId ? getPerfRun(previousRunId) : null;

  const runsPerSku = latest?.runsPerSku ?? 3;
  const formattedDate = formatTimestamp(latest?.timestamp || index.runs[0].timestamp);

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
              Lighthouse desktop · mediana de {runsPerSku} execuções · última medição em{' '}
              {formattedDate}
            </p>
          </div>
        </div>

        {/* Nota explicativa sobre laboratório */}
        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-neutral-75 bg-surface p-3 text-xs text-medium-emphasis shadow-tiny">
          <Info className="h-4 w-4 shrink-0 text-primary-dark mt-0.5" aria-hidden="true" />
          <p>
            Métricas de laboratório simuladas no Chromium desktop (condições controladas). O{' '}
            <strong>Total Blocking Time (TBT)</strong> é utilizado como substituto laboratorial do
            Interaction to Next Paint (INP) para diagnosticar períodos de travamento da thread
            principal.
          </p>
        </div>
      </div>

      {/* Cards por SKU */}
      {latest && latest.results && latest.results.length > 0 && (
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
      <section aria-labelledby="evolution-perf-title" className="space-y-4">
        <h2 id="evolution-perf-title" className="sr-only">
          Evolução Histórica
        </h2>
        <PerformanceTrends runs={index.runs} />
      </section>
    </div>
  );
}
