'use client';

import { useState } from 'react';
import { LayoutGroup } from 'framer-motion';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HistoryLineChart } from './history-line-chart';
import {
  HISTORY_METRICS,
  buildHistory,
  getPageTypeGroups,
  latestWithChange,
  metricValue,
  type HistoryMetricKey,
  type PageTypeGroup,
} from '@/lib/perf-history';
import { formatBytes, formatDecimal, formatSeconds, formatShortDate } from '@/lib/format';
import {
  PERF_METRICS,
  classifyMetric,
  formatMetric,
  ratingLabel,
  ratingTone,
} from '@/lib/perf-thresholds';
import type { PerfIndexEntry } from '@/lib/types';
import { cn } from '@/lib/utils';

interface PerformanceHistoryProps {
  runs: PerfIndexEntry[];
}

type Period = '7' | '30' | '90';

const PERIODS: Period[] = ['7', '30', '90'];

function ChangeBadge({ changePct }: { changePct: number | null }) {
  if (changePct === null || Math.abs(changePct) < 0.05) {
    return <span className="text-xs text-low-emphasis">sem variação</span>;
  }
  // Todas as métricas do histórico são "menor é melhor": subir é piorar.
  const worse = changePct > 0;
  const Icon = worse ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums',
        worse ? 'text-alert-dark' : 'text-success-dark',
      )}
      title={`Em relação à medição anterior (${worse ? 'piorou' : 'melhorou'})`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {formatDecimal(Math.abs(changePct), 1)}%
      <span className="sr-only">{worse ? ' (piorou)' : ' (melhorou)'}</span>
    </span>
  );
}

function KpiTile({
  label,
  value,
  changePct,
  badge,
}: {
  label: string;
  value: string;
  changePct: number | null;
  badge?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-neutral-75 bg-surface p-4">
      <p className="text-[11px] font-bold tracking-wide text-medium-emphasis uppercase">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-highlight tabular-nums">{value}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <ChangeBadge changePct={changePct} />
        {badge}
      </div>
    </div>
  );
}

function LcpGoalBadge({ value }: { value: number | null }) {
  const rating = classifyMetric('lcp', value);
  if (!rating) return null;
  return (
    <span
      className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', ratingTone(rating).badge)}
      title="Meta 2 de LCP: Supera < 3 s, Atende 3 a 4 s, Abaixo > 4 s"
    >
      {ratingLabel('lcp', rating)}
    </span>
  );
}

/** Histórico com PDP Full em cima e PDP Low embaixo; o período vale para as duas seções. */
export function PerformanceHistory({ runs }: PerformanceHistoryProps) {
  const groups = getPageTypeGroups(runs);
  const [period, setPeriod] = useState<Period>('30');

  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-highlight">Histórico de Performance</h2>
          <p className="text-xs text-medium-emphasis">
            Mediana diária de cada métrica, por tipo de PDP
          </p>
        </div>
        <LayoutGroup id="perf-period">
          <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <TabsList>
              {PERIODS.map((p) => (
                <TabsTrigger key={p} value={p} isActive={period === p}>
                  {p} dias
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </LayoutGroup>
      </div>

      {groups.map((group) => (
        <PageTypeHistory key={group.key} runs={runs} group={group} period={period} />
      ))}
    </div>
  );
}

function PageTypeHistory({
  runs,
  group,
  period,
}: {
  runs: PerfIndexEntry[];
  group: PageTypeGroup;
  period: Period;
}) {
  const [visible, setVisible] = useState<Set<HistoryMetricKey>>(
    () => new Set(HISTORY_METRICS.map((m) => m.key)),
  );

  const points = buildHistory(runs, group.key, Number(period));
  const dates = points.map((p) => p.date);

  const series = HISTORY_METRICS.filter((m) => visible.has(m.key)).map((m) => ({
    key: m.key,
    label: m.label,
    color: m.color,
    values: points.map((p) => metricValue(p.metrics, m.key)),
  }));

  function toggle(key: HistoryMetricKey) {
    setVisible((cur) => {
      const next = new Set(cur);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key); // sempre ao menos uma série visível
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <section
      aria-labelledby={`perf-history-${group.key}`}
      className="space-y-6 border-t border-neutral-75 pt-8 first-of-type:border-0 first-of-type:pt-0"
    >
      <div>
        <h3 id={`perf-history-${group.key}`} className="text-base font-bold text-highlight">
          {group.label}
        </h3>
        <p className="text-xs text-medium-emphasis">SKU {group.sku}</p>
      </div>

      {/* Indicadores (mesmas colunas da planilha do WebPageTest) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {HISTORY_METRICS.map(({ key }) => {
          const { value, changePct } = latestWithChange(points, key);
          return (
            <KpiTile
              key={key}
              label={PERF_METRICS[key].label}
              value={formatMetric(key, value)}
              changePct={changePct}
              badge={key === 'lcp' ? <LcpGoalBadge value={value} /> : undefined}
            />
          );
        })}
      </div>

      {/* Gráfico principal */}
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4 className="text-sm font-bold text-highlight">Evolução histórica</h4>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Métricas exibidas">
            {HISTORY_METRICS.map((m) => {
              const on = visible.has(m.key);
              return (
                <button
                  key={m.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(m.key)}
                  className={cn(
                    'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                    on
                      ? 'border-neutral-200 bg-surface text-high-emphasis'
                      : 'border-neutral-75 bg-neutral-50 text-low-emphasis',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: on ? m.color : 'var(--color-neutral-200)' }}
                  />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {points.length === 0 ? (
          <p className="py-12 text-center text-sm text-low-emphasis">
            Sem medições de {group.label} neste período.
          </p>
        ) : (
          <HistoryLineChart
            dates={dates}
            series={series}
            formatValue={(v) => formatMetric('lcp', v)}
            formatTick={formatSeconds}
            referenceLines={
              visible.has('lcp')
                ? [
                    { value: PERF_METRICS.lcp.good, label: 'Meta LCP · Supera < 3 s' },
                    { value: PERF_METRICS.lcp.poor, label: 'Meta LCP · Atende ≤ 4 s' },
                  ]
                : []
            }
            ariaLabel={`Evolução de ${series.map((s) => s.label).join(', ')} da ${group.label} nos últimos ${period} dias`}
          />
        )}
      </Card>

      {/* Tabela com os mesmos dados; o tamanho da página aparece só aqui */}
      {points.length > 0 && (
        <details className="rounded-lg border border-neutral-75 bg-surface p-4 text-sm">
          <summary className="cursor-pointer font-semibold text-high-emphasis">
            Ver dados em tabela
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs tabular-nums">
              <thead className="text-medium-emphasis">
                <tr>
                  <th className="py-1 pr-4 font-semibold">Data</th>
                  {HISTORY_METRICS.map((m) => (
                    <th key={m.key} className="py-1 pr-4 font-semibold">
                      {m.label}
                    </th>
                  ))}
                  <th className="py-1 font-semibold">Tamanho</th>
                </tr>
              </thead>
              <tbody className="text-high-emphasis">
                {[...points].reverse().map((p) => (
                  <tr key={p.date} className="border-t border-neutral-75">
                    <td className="py-1 pr-4">{formatShortDate(p.date)}</td>
                    {HISTORY_METRICS.map((m) => (
                      <td key={m.key} className="py-1 pr-4">
                        {formatMetric(m.key, metricValue(p.metrics, m.key))}
                      </td>
                    ))}
                    <td className="py-1">
                      {formatBytes(metricValue(p.metrics, 'totalByteWeight'))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}
