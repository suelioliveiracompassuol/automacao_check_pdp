import { describe, it, expect } from 'vitest';
import {
  buildHistory,
  getPageTypeGroups,
  latestWithChange,
  monotonePath,
  niceScale,
  spreadLabels,
} from '../perf-history';
import type { PerfIndexEntry, PerfMetrics } from '../types';

function metrics(partial: Partial<PerfMetrics>): PerfMetrics {
  return {
    performanceScore: 50,
    startRender: null,
    lcp: null,
    cls: null,
    tbt: null,
    fcp: null,
    speedIndex: null,
    ttfb: null,
    totalByteWeight: null,
    requestCount: null,
    ...partial,
  };
}

function run(timestamp: string, lcpFull: number, lcpLow: number): PerfIndexEntry {
  return {
    runId: `run_${Date.parse(timestamp)}`,
    timestamp,
    skus: [
      {
        sku: 'NATBRA-56948',
        name: 'Low',
        pageType: 'PDPLow',
        success: true,
        metrics: metrics({ lcp: lcpLow }),
      },
      {
        sku: 'NATBRA-108403',
        name: 'Full',
        pageType: 'PDPFull',
        success: true,
        metrics: metrics({ lcp: lcpFull }),
      },
    ],
  };
}

// Índice como o monitor grava: mais recente primeiro.
const runs: PerfIndexEntry[] = [
  run('2026-10-20T08:00:00Z', 3200, 2900),
  run('2026-10-19T08:00:00Z', 2800, 3100),
  run('2026-09-01T08:00:00Z', 5000, 5000),
];

describe('perf-history', () => {
  it('agrupa por tipo de PDP com Full antes de Low', () => {
    expect(getPageTypeGroups(runs)).toEqual([
      { key: 'PDPFull', label: 'PDP Full', sku: 'NATBRA-108403' },
      { key: 'PDPLow', label: 'PDP Low', sku: 'NATBRA-56948' },
    ]);
  });

  it('usa o SKU como grupo em rodadas antigas sem pageType', () => {
    const legacy: PerfIndexEntry[] = [
      {
        runId: 'r',
        timestamp: '2026-10-01T00:00:00Z',
        skus: [{ sku: 'NATBRA-1', name: 'x', success: true, metrics: null }],
      },
    ];
    expect(getPageTypeGroups(legacy)).toEqual([
      { key: 'NATBRA-1', label: 'NATBRA-1', sku: 'NATBRA-1' },
    ]);
  });

  it('filtra por dias de calendário e devolve em ordem cronológica', () => {
    const week = buildHistory(runs, 'PDPFull', 7);
    expect(week.map((p) => p.metrics?.lcp)).toEqual([2800, 3200]);
    expect(buildHistory(runs, 'PDPFull', 90)).toHaveLength(3);
  });

  it('calcula a variação percentual em relação ao ponto anterior', () => {
    const { value, changePct } = latestWithChange(buildHistory(runs, 'PDPLow', 7), 'lcp');
    expect(value).toBe(2900);
    expect(changePct).toBeCloseTo(-6.45, 1);
  });

  it('sem ponto anterior não há variação', () => {
    expect(latestWithChange([], 'lcp')).toEqual({ value: null, changePct: null });
  });

  it('gera escala redonda que cobre o maior valor', () => {
    expect(niceScale(4730)).toEqual({ max: 5000, ticks: [0, 1000, 2000, 3000, 4000, 5000] });
    expect(niceScale(0)).toEqual({ max: 1, ticks: [0, 1] });
  });

  it('curva suave não ultrapassa os pontos medidos (sem picos inventados)', () => {
    const d = monotonePath([
      { x: 0, y: 100 },
      { x: 10, y: 20 },
      { x: 20, y: 20 },
      { x: 30, y: 90 },
    ]);
    const ys = [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map(Number).filter((_, i) => i % 2 === 1);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(20);
    expect(Math.max(...ys)).toBeLessThanOrEqual(100);
  });

  it('afasta rótulos que colidiriam mantendo a ordem', () => {
    const placed = spreadLabels([50, 52, 200], 16, 0, 300);
    expect(placed[1] - placed[0]).toBeGreaterThanOrEqual(16);
    expect(placed[2]).toBe(200);
  });
});
