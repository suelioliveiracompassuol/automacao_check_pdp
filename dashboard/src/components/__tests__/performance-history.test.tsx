import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { PerformanceHistory } from '../performance/performance-history';
import type { PerfIndexEntry, PerfMetrics } from '@/lib/types';

function metrics(lcp: number, startRender: number): PerfMetrics {
  return {
    performanceScore: 50,
    startRender,
    lcp,
    cls: 0.05,
    tbt: 3500,
    fcp: 900,
    speedIndex: 4800,
    ttfb: 60,
    totalByteWeight: 5_000_000,
    requestCount: 400,
  };
}

const runs: PerfIndexEntry[] = [
  {
    runId: 'run_2',
    timestamp: '2026-10-20T08:00:00Z',
    skus: [
      {
        sku: 'NATBRA-108403',
        name: 'Full',
        pageType: 'PDPFull',
        success: true,
        metrics: metrics(4730, 4600),
      },
      {
        sku: 'NATBRA-56948',
        name: 'Low',
        pageType: 'PDPLow',
        success: true,
        metrics: metrics(2650, 1560),
      },
    ],
  },
  {
    runId: 'run_1',
    timestamp: '2026-10-19T08:00:00Z',
    skus: [
      {
        sku: 'NATBRA-108403',
        name: 'Full',
        pageType: 'PDPFull',
        success: true,
        metrics: metrics(2950, 3100),
      },
      {
        sku: 'NATBRA-56948',
        name: 'Low',
        pageType: 'PDPLow',
        success: true,
        metrics: metrics(2700, 1600),
      },
    ],
  },
];

describe('PerformanceHistory', () => {
  it('mostra PDP Full acima e PDP Low abaixo na mesma página', () => {
    render(<PerformanceHistory runs={runs} />);

    const full = screen.getByRole('region', { name: 'PDP Full' });
    const low = screen.getByRole('region', { name: 'PDP Low' });
    expect(full.compareDocumentPosition(low) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'PDP Low' })).not.toBeInTheDocument();
  });

  it('cada seção tem seus indicadores, meta de LCP e variação', () => {
    render(<PerformanceHistory runs={runs} />);

    const full = within(screen.getByRole('region', { name: 'PDP Full' }));
    expect(full.getAllByText('4,73 s').length).toBeGreaterThan(0);
    expect(full.getByText('Abaixo')).toBeInTheDocument();
    expect(full.getAllByText(/(piorou)/).length).toBeGreaterThan(0);

    const low = within(screen.getByRole('region', { name: 'PDP Low' }));
    expect(low.getAllByText('2,65 s').length).toBeGreaterThan(0);
    expect(low.getByText('Supera')).toBeInTheDocument();
  });

  it('liga e desliga séries por seção, mantendo ao menos uma', async () => {
    const user = userEvent.setup();
    render(<PerformanceHistory runs={runs} />);
    const [fullLegend, lowLegend] = screen.getAllByRole('group', { name: 'Métricas exibidas' });
    const buttons = within(fullLegend).getAllByRole('button');

    await user.click(buttons[1]);
    expect(buttons[1]).toHaveAttribute('aria-pressed', 'false');
    // A seção Low não é afetada
    expect(within(lowLegend).getAllByRole('button')[1]).toHaveAttribute('aria-pressed', 'true');

    for (const b of [buttons[0], buttons[2], buttons[3]]) await user.click(b);
    expect(buttons.filter((b) => b.getAttribute('aria-pressed') === 'true')).toHaveLength(1);
  });

  it('oferece os dados em tabela em cada seção', () => {
    render(<PerformanceHistory runs={runs} />);
    const tables = screen.getAllByRole('table');
    expect(tables).toHaveLength(2);
    expect(within(tables[0]).getAllByRole('row')).toHaveLength(3);
  });
});
