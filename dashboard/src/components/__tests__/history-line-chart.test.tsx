import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { HistoryLineChart } from '../performance/history-line-chart';

const dates = ['2024-05-01T13:00:00Z', '2024-05-02T13:00:00Z', '2024-05-03T13:00:00Z'];
const series = [
  { key: 'lcp', label: 'LCP', color: '#00f', values: [2000, null, 2600] },
  { key: 'tbt', label: 'TBT', color: '#f90', values: [null, 300, null] },
];
const format = (v: number) => `${v} ms`;

function renderChart(props: Partial<React.ComponentProps<typeof HistoryLineChart>> = {}) {
  render(
    <HistoryLineChart
      dates={dates}
      series={series}
      formatValue={format}
      ariaLabel="Evolução"
      referenceLines={[{ value: 3000, label: 'Meta' }]}
      {...props}
    />,
  );
  return screen.getByRole('group', { name: /evolução\. use as setas/i });
}

describe('HistoryLineChart', () => {
  it('desenha eixos, linha de referência, datas e rótulos diretos', () => {
    renderChart();
    expect(screen.getByRole('img', { name: 'Evolução' })).toBeInTheDocument();
    expect(screen.getByText('Meta')).toBeInTheDocument();
    expect(screen.getByText('01/05')).toBeInTheDocument();
    expect(screen.getByText('03/05')).toBeInTheDocument();
    // rótulos no fim das linhas (largura padrão de 640 px comporta)
    expect(screen.getByText('LCP')).toBeInTheDocument();
    expect(screen.getByText('TBT')).toBeInTheDocument();
  });

  it('omite rótulos diretos quando desligados', () => {
    renderChart({ directLabels: false });
    expect(screen.queryByText('LCP')).not.toBeInTheDocument();
  });

  it('percorre as datas pelo teclado e mostra o tooltip', () => {
    const chart = renderChart();
    fireEvent.keyDown(chart, { key: 'ArrowLeft' });
    const tooltip = screen.getByRole('status');
    expect(tooltip).toHaveTextContent('02/05');
    expect(tooltip).toHaveTextContent('300 ms');
    expect(tooltip).toHaveTextContent('—');
    fireEvent.keyDown(chart, { key: 'ArrowRight' });
    fireEvent.keyDown(chart, { key: 'ArrowRight' }); // não passa do fim
    expect(screen.getByRole('status')).toHaveTextContent('2600 ms');
    fireEvent.keyDown(chart, { key: 'Escape' });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('segue o ponteiro e some ao sair', () => {
    const chart = renderChart();
    const hitArea = chart.querySelector('rect')!;
    fireEvent.pointerMove(hitArea, { clientX: 60 });
    expect(screen.getByRole('status')).toHaveTextContent('01/05');
    fireEvent.pointerLeave(hitArea);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    fireEvent.keyDown(chart, { key: 'ArrowLeft' });
    fireEvent.blur(chart);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('ignora o teclado sem datas', () => {
    const chart = renderChart({ dates: [], series: [] });
    fireEvent.keyDown(chart, { key: 'ArrowLeft' });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
