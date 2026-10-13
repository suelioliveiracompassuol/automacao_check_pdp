import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MetricTrendChart, type TrendSeries } from '../performance/metric-trend-chart';

describe('MetricTrendChart', () => {
  const sampleSeries: TrendSeries[] = [
    {
      label: 'NATBRA-108403',
      points: [
        { date: '2026-10-07T12:00:00Z', value: 2400 },
        { date: '2026-10-08T12:00:00Z', value: 2100 },
        { date: '2026-10-09T12:00:00Z', value: 1850 },
      ],
    },
    {
      label: 'NATBRA-70983',
      points: [
        { date: '2026-10-07T12:00:00Z', value: 3100 },
        { date: '2026-10-08T12:00:00Z', value: 2900 },
        { date: '2026-10-09T12:00:00Z', value: 2750 },
      ],
    },
  ];

  it('renderiza svg com role="img" e aria-label com valor atual', () => {
    render(<MetricTrendChart metricKey="lcp" series={sampleSeries} />);

    const svg = screen.getByRole('img');
    expect(svg).toBeInTheDocument();
    const ariaLabel = svg.getAttribute('aria-label');
    expect(ariaLabel).toContain('NATBRA-108403');
    expect(ariaLabel).toContain('1,85 s');
    expect(ariaLabel).toContain('NATBRA-70983');
    expect(ariaLabel).toContain('2,75 s');
  });

  it('não quebra com séries vazias', () => {
    render(<MetricTrendChart metricKey="lcp" series={[]} />);

    const svg = screen.getByRole('img');
    expect(svg).toBeInTheDocument();
    expect(svg.getAttribute('aria-label')).toContain('sem dados');
  });

  it('não quebra quando todos os pontos são null', () => {
    const nullSeries: TrendSeries[] = [
      {
        label: 'NATBRA-108403',
        points: [
          { date: '2026-10-08T12:00:00Z', value: null },
          { date: '2026-10-09T12:00:00Z', value: null },
        ],
      },
    ];

    render(<MetricTrendChart metricKey="lcp" series={nullSeries} />);

    const svg = screen.getByRole('img');
    expect(svg).toBeInTheDocument();
    expect(svg.getAttribute('aria-label')).toContain('sem dados registrados');
  });
});
