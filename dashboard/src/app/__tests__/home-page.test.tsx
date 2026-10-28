import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeFeature, makeIndexEntry, makeReport, makeResult } from '@/test/fixtures';
import type { MonitoringReport, ReportIndexEntry } from '@/lib/types';
import { PLATFORM_META } from '@/lib/platforms';

const data = vi.hoisted(() => ({
  entries: [] as ReportIndexEntry[],
  reports: {} as Record<string, MonitoringReport>,
}));

vi.mock('@/lib/data', () => ({
  getReportIndex: () => ({ reports: data.entries }),
  getReportsByPlatform: (platform: string) =>
    data.entries.filter((e) => (e.platform ?? 'web') === platform),
  getReportById: (id: string) => data.reports[id] ?? null,
}));

import HomePage from '../page';

const failing = makeFeature({
  featureKey: 'rating',
  feature: 'Nota',
  passed: false,
  status: 'fail',
});

function seed() {
  const results = [
    makeResult({ sku: 'A', vendor: 'natura', country: 'br', features: [failing] }),
    makeResult({ sku: 'B', vendor: 'avon', country: 'br', channel: 'socialcommerce' }),
    makeResult({ sku: 'C', vendor: 'natura', country: 'ar', success: false }),
  ];
  data.entries = [
    makeIndexEntry({ runId: 'run_3', startTime: '2024-05-03T13:00:00Z' }),
    makeIndexEntry({ runId: 'run_2', startTime: '2024-05-02T13:00:00Z' }),
    makeIndexEntry({
      runId: 'run_1',
      startTime: '2024-05-01T13:00:00Z',
      summary: { total: 0, passed: 0, failed: 0, errors: 0 },
    }),
    // Android (beta) com execução registrada, mas sem o report.json no disco.
    makeIndexEntry({ runId: 'run_android', platform: 'android' }),
    // iOS ainda é "em breve": entradas dele nunca aparecem nos números.
    makeIndexEntry({ runId: 'run_ios', platform: 'ios' }),
  ];
  data.reports = {
    run_3: makeReport({ runId: 'run_3', results }),
    run_2: makeReport({ runId: 'run_2', results }),
    run_1: makeReport({ runId: 'run_1', results: [] }),
  };
}

describe('HomePage', () => {
  beforeEach(() => {
    data.entries = [];
    data.reports = {};
  });

  it('mostra estado vazio sem execuções', () => {
    render(<HomePage />);
    expect(
      screen.getByRole('heading', { name: 'Nenhuma execução disponível' }),
    ).toBeInTheDocument();
  });

  it('resume a plataforma web e a cobertura por país', () => {
    seed();
    render(<HomePage />);

    const hero = screen.getByRole('region', { name: 'Visão geral da automação' });
    // Até 2 países, os nomes aparecem por extenso
    expect(within(hero).getByText('Argentina e Brasil')).toBeInTheDocument();
    expect(within(hero).getByText('3 execuções')).toBeInTheDocument(); // card da Web
    // 2 de 3 PDPs passaram na última execução web
    expect(within(hero).getByText('67%')).toBeInTheDocument();
    // Só o iOS é "em breve"; o Android é beta
    expect(within(hero).getAllByText('Em breve')).toHaveLength(1);
    expect(within(hero).getAllByText('Beta').length).toBeGreaterThan(0);

    const coverage = screen.getByRole('region', { name: 'Cobertura' });
    expect(within(coverage).getByText('Minha Loja')).toBeInTheDocument();
    expect(within(coverage).getAllByText('Natura')).toHaveLength(2);
    expect(within(coverage).getByText('Avon')).toBeInTheDocument();
    expect(
      within(coverage).getByRole('heading', { name: 'O que verificamos em cada PDP' }),
    ).toBeInTheDocument();
  });

  it('mostra evolução e matriz de erros da web e estado vazio nas outras plataformas', async () => {
    seed();
    render(<HomePage />);

    expect(screen.getByRole('heading', { name: 'Evolução Histórica' })).toBeInTheDocument();
    const matrix = screen.getByRole('region', { name: 'Matriz de Erros' });
    // "Nota" falhou nas 2 execuções com resultados → falha persistente
    expect(within(matrix).getByText('Falha persistente')).toBeInTheDocument();
    expect(within(matrix).getAllByText('Nota (rating)').length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('tab', { name: /android/i }));
    expect(screen.getByText('Ainda não há dados para Android')).toBeInTheDocument();
  });

  it('mostra KPIs e cobertura do Android com as checagens declaradas, não as da última execução', async () => {
    seed();
    data.reports.run_android = makeReport({
      runId: 'run_android',
      results: [
        makeResult({ sku: 'AND-1', platform: 'android', features: [makeFeature()] }),
        makeResult({ sku: 'AND-2', platform: 'android', features: [makeFeature()] }),
      ],
    });
    render(<HomePage />);

    const hero = screen.getByRole('region', { name: 'Visão geral da automação' });
    // A execução só tem reviews, mas vale a lista de PLATFORM_META.android.featureKeys
    // (uma checagem nova aparece antes da próxima execução)
    expect(
      within(hero).getByText(`${PLATFORM_META.android.featureKeys!.length} por PDP`),
    ).toBeInTheDocument();
    expect(within(hero).getByText('Brasil')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: /android/i }));
    const coverage = screen.getAllByRole('region', { name: 'Cobertura' }).at(-1)!;
    expect(within(coverage).getByText('Adicionar à sacola')).toBeInTheDocument();
    expect(within(coverage).getByText('Banners de conteúdo')).toBeInTheDocument();
    expect(within(coverage).queryByText('Avaliações')).not.toBeInTheDocument();
  });
});
