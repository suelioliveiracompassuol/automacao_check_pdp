import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeMetrics, makePerfIndexEntry, makePerfRun, makePerfSku } from '@/test/fixtures';
import type { PerfIndex, PerfRun } from '@/lib/types';

const data = vi.hoisted(() => ({
  index: { runs: [] } as PerfIndex,
  runs: {} as Record<string, PerfRun>,
}));

vi.mock('@/lib/data', () => ({
  getPerfIndex: () => data.index,
  getPerfRun: (id: string) => data.runs[id] ?? null,
  getPerfReportDownloads: () => [
    {
      runId: 'run_2',
      timestamp: '2024-05-02T13:00:00Z',
      files: [{ sku: 'NATBRA-108403', name: 'Perfume', pageType: 'PDPFull', path: 'run_2/x.json' }],
    },
  ],
}));
// O histórico tem testes próprios; aqui só interessa que recebe as rodadas.
vi.mock('@/components/performance/performance-history', () => ({
  PerformanceHistory: ({ runs }: { runs: unknown[] }) => <div>histórico com {runs.length}</div>,
}));

import PerformancePage from '../performance/page';

describe('PerformancePage', () => {
  beforeEach(() => {
    data.index = { runs: [] };
    data.runs = {};
  });

  it('mostra estado vazio sem medições', () => {
    render(<PerformancePage />);
    expect(screen.getByRole('heading', { name: 'Performance da PDP' })).toBeInTheDocument();
    expect(screen.getByText(/ainda não há medições/i)).toBeInTheDocument();
  });

  it('mostra condições do teste, cards por SKU com comparação e o histórico', () => {
    data.index = {
      runs: [
        makePerfIndexEntry({ runId: 'run_2', timestamp: '2024-05-02T13:00:00Z' }),
        makePerfIndexEntry({ runId: 'run_1' }),
      ],
    };
    data.runs = {
      run_2: makePerfRun({
        runId: 'run_2',
        timestamp: '2024-05-02T13:00:00Z',
        conditions: {
          connectivity: '4G',
          downKbps: 9000,
          upKbps: 9000,
          rttMs: 170,
          viewport: '1920x1200',
          consentCookie: false,
        },
      }),
      run_1: makePerfRun({ results: [makePerfSku({ median: makeMetrics({ tbt: 300 }) })] }),
    };

    render(<PerformancePage />);

    expect(screen.getByText(/4G \(9 Mbps\/9 Mbps, 170 ms\) · tela 1920x1200/)).toBeInTheDocument();
    expect(screen.getByText(/última medição em 02\/05\/2024, 10:00/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'SKUs Monitorados' })).toBeInTheDocument();
    // TBT 300 → 150 ms: melhora em relação à rodada anterior
    expect(screen.getByText('▼ 150 ms')).toBeInTheDocument();
    expect(screen.getByText('histórico com 2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Relatórios do Lighthouse' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /pdp full/i })).toHaveAttribute(
      'href',
      '/perf/run_2/x.json',
    );
  });

  it('usa o timestamp do índice quando o JSON da rodada não existe', () => {
    data.index = { runs: [makePerfIndexEntry({ timestamp: '2024-05-03T13:00:00Z' })] };
    render(<PerformancePage />);
    expect(screen.getByText(/03\/05\/2024, 10:00/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'SKUs Monitorados' })).not.toBeInTheDocument();
  });
});
