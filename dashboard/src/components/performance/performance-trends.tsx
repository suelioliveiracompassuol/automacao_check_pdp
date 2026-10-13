'use client';

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { MetricTrendChart, type TrendSeries } from './metric-trend-chart';
import { PAGE_TYPE_LABEL, PERF_METRICS, type PerfMetricKey } from '@/lib/perf-thresholds';
import type { PerfIndexEntry } from '@/lib/types';

interface PerformanceTrendsProps {
  runs: PerfIndexEntry[];
}

const TREND_METRICS: PerfMetricKey[] = ['performanceScore', 'lcp', 'cls', 'tbt', 'fcp', 'ttfb'];

export function PerformanceTrends({ runs }: PerformanceTrendsProps) {
  const [period, setPeriod] = useState<'7' | '30' | '90'>('7');

  const daysCount = parseInt(period, 10);
  const selectedRuns = runs.slice(0, daysCount);
  // Inverte para ordem cronológica (mais antigo primeiro)
  const chronologicalRuns = [...selectedRuns].reverse();

  // Descobre os SKUs presentes nas medições
  const skuList: { sku: string; label: string }[] = [];
  const seenSkus = new Set<string>();

  for (const r of chronologicalRuns) {
    for (const s of r.skus) {
      if (!seenSkus.has(s.sku)) {
        seenSkus.add(s.sku);
        skuList.push({
          sku: s.sku,
          label: s.pageType ? `${PAGE_TYPE_LABEL[s.pageType]} (${s.sku})` : s.sku,
        });
      }
    }
  }

  function buildSeriesForMetric(metricKey: PerfMetricKey): TrendSeries[] {
    return skuList.map(({ sku, label }) => {
      const points = chronologicalRuns.map((r) => {
        const item = r.skus.find((s) => s.sku === sku);
        const value = item && item.success && item.metrics ? item.metrics[metricKey] : null;

        return {
          date: r.timestamp,
          value: typeof value === 'number' ? value : null,
        };
      });

      return {
        label,
        points,
      };
    });
  }

  return (
    <div className="space-y-6">
      {/* Seletor de período */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-highlight">Tendência Histórica</h3>
          <p className="text-xs text-medium-emphasis">
            Acompanhe a estabilidade e evolução das medições medianas
          </p>
        </div>

        <Tabs value={period} onValueChange={(val) => setPeriod(val as '7' | '30' | '90')}>
          <TabsList>
            <TabsTrigger value="7" isActive={period === '7'}>
              7 dias
            </TabsTrigger>
            <TabsTrigger value="30" isActive={period === '30'}>
              30 dias
            </TabsTrigger>
            <TabsTrigger value="90" isActive={period === '90'}>
              90 dias
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Grid de gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {TREND_METRICS.map((key) => {
          const def = PERF_METRICS[key];
          const series = buildSeriesForMetric(key);

          return (
            <Card key={key} className="flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-highlight">
                    {def.label} ({def.shortLabel})
                  </h4>
                </div>
                <p className="mt-0.5 text-xs text-medium-emphasis">{def.description}</p>
              </div>

              <MetricTrendChart metricKey={key} series={series} />
            </Card>
          );
        })}
      </div>
    </div>
  );
}
