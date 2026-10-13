import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MetricTile } from '../performance/metric-tile';

describe('MetricTile', () => {
  it('renderiza LCP "2,31 s" com a meta da empresa "Supera"', () => {
    render(<MetricTile metricKey="lcp" value={2310} />);

    expect(screen.getByText('2,31 s')).toBeInTheDocument();
    expect(screen.getByText('Supera')).toBeInTheDocument();
    expect(screen.getByText('LCP')).toBeInTheDocument();
  });

  it('renderiza LCP "Atende" entre 3 e 4 s e "Abaixo" acima de 4 s', () => {
    const { unmount } = render(<MetricTile metricKey="lcp" value={3500} />);
    expect(screen.getByText('Atende')).toBeInTheDocument();
    unmount();

    render(<MetricTile metricKey="lcp" value={4500} />);
    expect(screen.getByText('4,50 s')).toBeInTheDocument();
    expect(screen.getByText('Abaixo')).toBeInTheDocument();
  });

  it('renderiza classificação "Ruim" nas demais métricas acima do limite poor', () => {
    render(<MetricTile metricKey="tbt" value={13607} />);

    expect(screen.getByText('Ruim')).toBeInTheDocument();
  });

  it('indica piora quando o LCP sobe (seta ▲ em vermelho)', () => {
    // Para LCP, subir é pior (higherIsBetter: false)
    render(<MetricTile metricKey="lcp" value={2800} previousValue={2500} />);

    const variation = screen.getByText(/▲ 300 ms/);
    expect(variation).toBeInTheDocument();
    expect(variation).toHaveClass('text-alert-dark');
  });

  it('indica melhora quando o LCP diminui (seta ▼ em verde)', () => {
    render(<MetricTile metricKey="lcp" value={2000} previousValue={2500} />);

    const variation = screen.getByText(/▼ 500 ms/);
    expect(variation).toBeInTheDocument();
    expect(variation).toHaveClass('text-success-dark');
  });

  it('indica melhora quando score sobe (higherIsBetter: true)', () => {
    render(<MetricTile metricKey="performanceScore" value={85} previousValue={70} />);

    const variation = screen.getByText(/▲ 15/);
    expect(variation).toBeInTheDocument();
    expect(variation).toHaveClass('text-success-dark');
  });

  it('renderiza travessão quando valor for null', () => {
    render(<MetricTile metricKey="tbt" value={null} />);

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('Sem dados')).toBeInTheDocument();
  });
});
