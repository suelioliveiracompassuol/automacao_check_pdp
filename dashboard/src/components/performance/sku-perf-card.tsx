import { Card } from '@/components/ui/card';
import { ScoreRing } from './score-ring';
import { MetricTile } from './metric-tile';
import { OpportunitiesList } from './opportunities-list';
import { formatBytes } from '@/lib/format';
import { PAGE_TYPE_LABEL, type PerfMetricKey } from '@/lib/perf-thresholds';
import type { PerfMetrics, PerfSkuResult } from '@/lib/types';
import { ExternalLink, AlertTriangle, Download } from 'lucide-react';
import { cn, getPerfFileUrl, perfReportDownloadName } from '@/lib/utils';

interface SkuPerfCardProps {
  result: PerfSkuResult;
  previous?: PerfMetrics | null;
  className?: string;
}

/** Mesma ordem das colunas da planilha do WebPageTest. */
const CARD_METRICS = [
  'startRender',
  'lcp',
  'speedIndex',
  'tbt',
  'cls',
  'ttfb',
] as const satisfies readonly PerfMetricKey[];

export function SkuPerfCard({ result, previous, className }: SkuPerfCardProps) {
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
              {CARD_METRICS.map((key) => (
                <MetricTile
                  key={key}
                  metricKey={key}
                  value={result.median?.[key] ?? null}
                  previousValue={previous?.[key]}
                />
              ))}
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

          {/* Download do relatório completo do Lighthouse */}
          {result.reportJsonPath && (
            <div className="border-t border-neutral-75 pt-3">
              <a
                href={getPerfFileUrl(result.reportJsonPath)}
                download={perfReportDownloadName(result.reportJsonPath)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-dark hover:text-primary-darkest transition-colors"
              >
                <Download className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Baixar relatório do Lighthouse (JSON)</span>
              </a>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
