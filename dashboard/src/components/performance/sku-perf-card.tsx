import { Card } from '@/components/ui/card';
import { ScoreRing } from './score-ring';
import { MetricTile } from './metric-tile';
import { OpportunitiesList } from './opportunities-list';
import { formatBytes, PAGE_TYPE_LABEL } from '@/lib/perf-thresholds';
import type { PerfMetrics, PerfSkuResult } from '@/lib/types';
import { ExternalLink, AlertTriangle, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SkuPerfCardProps {
  result: PerfSkuResult;
  previous?: PerfMetrics | null;
  basePath?: string;
  className?: string;
}

export function SkuPerfCard({
  result,
  previous,
  basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '',
  className,
}: SkuPerfCardProps) {
  const normalizedBasePath = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;

  const reportUrl = result.reportHtmlPath
    ? `${normalizedBasePath}/perf/${result.reportHtmlPath}`
    : null;

  return (
    <Card className={cn('flex flex-col justify-between gap-5', className)}>
      {/* Cabeçalho */}
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {result.pageType && (
                <span className="rounded-full bg-primary-wash px-2 py-0.5 text-[11px] font-bold text-primary-darkest">
                  {PAGE_TYPE_LABEL[result.pageType]}
                </span>
              )}
              <span className="font-mono text-xs font-semibold text-primary-darkest">
                {result.sku}
              </span>
            </div>
            <h3 className="mt-0.5 text-base font-bold text-highlight truncate" title={result.name}>
              {result.name}
            </h3>
          </div>
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-neutral-75 bg-neutral-50 px-2.5 py-1 text-xs font-medium text-medium-emphasis hover:bg-neutral-100 hover:text-highlight transition-colors shrink-0"
          >
            <span>Abrir PDP</span>
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        </div>
      </div>

      {!result.success ? (
        <div className="rounded-lg border border-alert-light bg-alert-lightest p-4 text-alert-dark">
          <div className="flex items-center gap-2 font-bold text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Falha na medição deste SKU</span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-alert-darkest">
            {result.error || 'Nenhuma execução válida pôde ser completada pelo Lighthouse.'}
          </p>
        </div>
      ) : (
        <>
          {/* Score + Grid de Métricas */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
            <div className="flex flex-col items-center justify-center p-2 shrink-0">
              <ScoreRing score={result.median?.performanceScore ?? null} size="lg" />
              <span className="mt-2 text-xs font-semibold text-medium-emphasis">Score Geral</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 flex-1 w-full">
              <MetricTile
                metricKey="lcp"
                value={result.median?.lcp ?? null}
                previousValue={previous?.lcp}
              />
              <MetricTile
                metricKey="cls"
                value={result.median?.cls ?? null}
                previousValue={previous?.cls}
              />
              <MetricTile
                metricKey="tbt"
                value={result.median?.tbt ?? null}
                previousValue={previous?.tbt}
              />
              <MetricTile
                metricKey="fcp"
                value={result.median?.fcp ?? null}
                previousValue={previous?.fcp}
              />
              <MetricTile
                metricKey="speedIndex"
                value={result.median?.speedIndex ?? null}
                previousValue={previous?.speedIndex}
              />
              <MetricTile
                metricKey="ttfb"
                value={result.median?.ttfb ?? null}
                previousValue={previous?.ttfb}
              />
            </div>
          </div>

          {/* Diagnóstico */}
          <div className="rounded-lg bg-neutral-50 p-3 border border-neutral-75 text-xs text-medium-emphasis space-y-1">
            <div className="flex items-baseline gap-1.5 truncate">
              <span className="font-semibold text-high-emphasis shrink-0">Elemento LCP:</span>
              <span
                className="truncate font-mono text-[11px] text-low-emphasis"
                title={result.lcpElement?.snippet ?? result.lcpElement?.selector ?? ''}
              >
                {result.lcpElement?.nodeLabel || '—'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-[11px]">
              <div>
                <span className="font-semibold text-high-emphasis">Peso total: </span>
                <span className="tabular-nums font-mono">
                  {formatBytes(result.median?.totalByteWeight ?? null)}
                </span>
              </div>
              <div>
                <span className="font-semibold text-high-emphasis">Requisições: </span>
                <span className="tabular-nums font-mono">{result.median?.requestCount ?? '—'}</span>
              </div>
            </div>
          </div>

          {/* Oportunidades */}
          <OpportunitiesList items={result.opportunities} />

          {/* Link para relatório completo do Lighthouse */}
          {reportUrl && (
            <div className="border-t border-neutral-75 pt-3">
              <a
                href={reportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-dark hover:text-primary-darkest transition-colors"
              >
                <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Relatório completo do Lighthouse</span>
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
