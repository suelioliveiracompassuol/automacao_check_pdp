import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { OpportunitiesList } from '../performance/opportunities-list';
import { PerfReportDownloads } from '../performance/perf-report-downloads';
import { ScoreRing } from '../performance/score-ring';
import { SkuPerfCard } from '../performance/sku-perf-card';
import { makeMetrics, makePerfSku } from '@/test/fixtures';

describe('ScoreRing', () => {
  it('descreve score e rating no rótulo acessível', () => {
    render(<ScoreRing score={95} />);
    expect(
      screen.getByRole('img', { name: 'Score de performance: 95 de 100 (Bom)' }),
    ).toBeInTheDocument();
    expect(screen.getByText('95')).toHaveClass('text-success-dark', 'text-xl');
  });

  it('usa o tamanho grande e a cor do rating ruim', () => {
    render(<ScoreRing score={30} size="lg" />);
    expect(screen.getByText('30')).toHaveClass('text-alert-dark', 'text-3xl');
  });

  it('indica ausência de dados', () => {
    render(<ScoreRing score={null} />);
    expect(
      screen.getByRole('img', { name: 'Score de performance: sem dados' }),
    ).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

describe('OpportunitiesList', () => {
  it('lista oportunidades com a economia formatada', () => {
    render(
      <OpportunitiesList
        items={[
          { id: 'a', title: 'Reduzir JS', savingsMs: 450 },
          { id: 'b', title: 'Comprimir imagens', savingsMs: 1500 },
        ]}
      />,
    );
    expect(screen.getByText('Reduzir JS')).toBeInTheDocument();
    expect(screen.getByText('economia estimada: 450 ms')).toBeInTheDocument();
    expect(screen.getByText('economia estimada: 1,50 s')).toBeInTheDocument();
  });

  it('mostra mensagem quando não há oportunidades', () => {
    render(<OpportunitiesList items={[]} />);
    expect(screen.getByText('Nenhuma oportunidade relevante')).toBeInTheDocument();
  });
});

describe('SkuPerfCard', () => {
  it('mostra cabeçalho, métricas, diagnóstico e download do relatório', () => {
    render(<SkuPerfCard result={makePerfSku()} previous={makeMetrics({ lcp: 3000 })} />);
    expect(screen.getByText('PDP Full')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Perfume' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /abrir pdp/i })).toHaveAttribute(
      'href',
      'https://www.natura.com.br/p/perfume/NATBRA-108403',
    );
    for (const label of ['Start Render', 'LCP', 'Speed Index', 'TBT', 'CLS', 'TTFB']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // LCP caiu de 3 s para 2,5 s: melhora de 500 ms
    expect(screen.getByText('▼ 500 ms')).toHaveClass('text-success-dark');
    expect(screen.getByText('Imagem do produto')).toBeInTheDocument();
    expect(screen.getByText('2,0 MB')).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
    const download = screen.getByRole('link', { name: /baixar relatório do lighthouse/i });
    expect(download).toHaveAttribute('href', '/perf/run_1/NATBRA-108403.json');
    expect(download).toHaveAttribute('download', 'lighthouse_run_1_NATBRA-108403.json');
  });

  it('mostra o erro quando a medição falhou', () => {
    render(
      <SkuPerfCard result={makePerfSku({ success: false, error: 'Timeout', median: null })} />,
    );
    expect(screen.getByText('Falha na medição deste SKU')).toBeInTheDocument();
    expect(screen.getByText('Timeout')).toBeInTheDocument();
    expect(screen.queryByText('Score Geral')).not.toBeInTheDocument();
  });

  it('usa mensagem padrão de erro e omite o link sem relatório', () => {
    render(
      <SkuPerfCard
        result={makePerfSku({
          success: false,
          median: null,
          reportJsonPath: null,
          pageType: undefined,
        })}
      />,
    );
    expect(screen.getByText(/nenhuma execução válida/i)).toBeInTheDocument();
    expect(screen.queryByText('PDP Full')).not.toBeInTheDocument();
  });

  it('mostra traços quando faltam diagnósticos', () => {
    render(
      <SkuPerfCard
        result={makePerfSku({
          lcpElement: null,
          reportJsonPath: null,
          median: makeMetrics({ requestCount: null, totalByteWeight: null }),
        })}
      />,
    );
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByRole('link', { name: /baixar relatório/i })).not.toBeInTheDocument();
  });
});

describe('PerfReportDownloads', () => {
  it('lista um link de download por SKU em cada medição', () => {
    render(
      <PerfReportDownloads
        days={10}
        runs={[
          {
            runId: 'run_2',
            timestamp: '2024-05-02T13:00:00Z',
            files: [
              { sku: 'NATBRA-1', name: 'Full', pageType: 'PDPFull', path: 'run_2/NATBRA-1.json' },
              { sku: 'NATBRA-2', name: 'Sem tipo', path: 'run_2/NATBRA-2.json' },
            ],
          },
        ]}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Relatórios do Lighthouse' })).toBeInTheDocument();
    expect(screen.getByText('02/05/2024, 10:00')).toBeInTheDocument();
    const full = screen.getByRole('link', { name: /pdp full/i });
    expect(full).toHaveAttribute('href', '/perf/run_2/NATBRA-1.json');
    expect(full).toHaveAttribute('download', 'lighthouse_run_2_NATBRA-1.json');
    // Sem pageType, o botão usa o código do SKU
    expect(screen.getByRole('link', { name: /^NATBRA-2/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Lighthouse Viewer' })).toHaveAttribute(
      'href',
      'https://googlechrome.github.io/lighthouse/viewer/',
    );
  });

  it('avisa quando não há relatórios no período', () => {
    render(<PerfReportDownloads days={10} runs={[]} />);
    expect(
      screen.getByText('Nenhum relatório disponível nos últimos 10 dias.'),
    ).toBeInTheDocument();
  });
});
