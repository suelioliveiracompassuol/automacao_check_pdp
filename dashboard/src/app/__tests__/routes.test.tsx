import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeIndexEntry, makeReport, makeResult } from '@/test/fixtures';
import type { MonitoringReport, ReportIndexEntry } from '@/lib/types';

const nav = vi.hoisted(() => ({
  redirect: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));
vi.mock('next/navigation', () => ({
  redirect: nav.redirect,
  notFound: nav.notFound,
  usePathname: () => '/web',
}));

const data = vi.hoisted(() => ({
  entries: [] as ReportIndexEntry[],
  reports: {} as Record<string, MonitoringReport>,
  last: null as MonitoringReport | null,
}));
vi.mock('@/lib/data', () => ({
  getLastReport: () => data.last,
  getReportIndex: () => ({ reports: data.entries }),
  getReportsByPlatform: (platform: string) =>
    data.entries.filter((e) => (e.platform ?? 'web') === platform),
  getReportById: (id: string) => data.reports[id] ?? null,
  getLastReportByPlatform: (platform: string) => {
    const latest = data.entries.find((e) => (e.platform ?? 'web') === platform);
    return latest ? (data.reports[latest.runId] ?? null) : null;
  },
  getScreenshotsForRun: () => [],
  getFeatureRefIndex: () => ({}),
}));

import AndroidPage from '../android/page';
import AndroidReportPage, { generateStaticParams as androidParams } from '../android/[runId]/page';
import IosPage from '../ios/page';
import LegacyReportRedirect, { generateStaticParams as reportParams } from '../report/[runId]/page';
import LegacyVisaoGeralRedirect from '../visao-geral/page';
import WebPage from '../web/page';
import WebReportPage, { generateStaticParams as webParams } from '../web/[runId]/page';

beforeEach(() => {
  vi.clearAllMocks();
  data.entries = Array.from({ length: 7 }, (_, i) => makeIndexEntry({ runId: `run_${i}` }));
  data.entries.push(makeIndexEntry({ runId: 'run_android', platform: 'android' }));
  data.last = makeReport({ runId: 'run_0', results: [makeResult({ name: 'Produto Web' })] });
  data.reports = {
    run_3: makeReport({ runId: 'run_3', results: [makeResult({ name: 'Antigo' })] }),
  };
});

describe('/ios', () => {
  it('mostra o estado "Em breve"', () => {
    render(<IosPage />);
    expect(screen.getByRole('heading', { name: /ios ainda não disponível/i })).toBeInTheDocument();
    expect(screen.getByText('Em breve')).toBeInTheDocument();
  });
});

describe('/android', () => {
  it('orienta a rodar o check:android quando ainda não há execução', () => {
    render(<AndroidPage />);
    expect(
      screen.getByRole('heading', { name: 'Nenhuma execução Android ainda' }),
    ).toBeInTheDocument();
    expect(screen.getByText('npm run check:android')).toBeInTheDocument();
  });

  it('mostra a última execução Android', () => {
    data.reports.run_android = makeReport({
      runId: 'run_android',
      results: [makeResult({ name: 'Produto App', platform: 'android' })],
    });
    render(<AndroidPage />);
    expect(
      screen.getByRole('heading', { name: 'PDP Feature Monitor — Android' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Produto App')).toBeInTheDocument();
  });

  it('pré-renderiza só execuções Android e mostra a pedida', async () => {
    expect(await androidParams()).toEqual([{ runId: 'run_android' }]);
    data.reports.run_android = makeReport({
      runId: 'run_android',
      results: [makeResult({ name: 'Produto App' })],
    });
    render(await AndroidReportPage({ params: Promise.resolve({ runId: 'run_android' }) }));
    expect(screen.getByText('Produto App')).toBeInTheDocument();
  });

  it('responde 404 para execução Android inexistente', async () => {
    await expect(AndroidReportPage({ params: Promise.resolve({ runId: 'nope' }) })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
  });
});

describe('redirects legados', () => {
  it('/visao-geral redireciona para a home', () => {
    LegacyVisaoGeralRedirect();
    expect(nav.redirect).toHaveBeenCalledWith('/');
  });

  it('/report/[runId] redireciona para /web/[runId] e pré-renderiza 5 execuções', async () => {
    await LegacyReportRedirect({ params: Promise.resolve({ runId: 'run_9' }) });
    expect(nav.redirect).toHaveBeenCalledWith('/web/run_9/');
    expect(await reportParams()).toHaveLength(5);
  });
});

describe('/web', () => {
  it('mostra a última execução', () => {
    render(<WebPage />);
    expect(screen.getByRole('heading', { name: 'PDP Feature Monitor — Web' })).toBeInTheDocument();
    expect(screen.getByText(/verificação automatizada/i)).toBeInTheDocument();
    expect(screen.getByText('Produto Web')).toBeInTheDocument();
    expect(screen.getByText('run_0')).toBeInTheDocument();
  });
});

describe('/web/[runId]', () => {
  it('pré-renderiza só as 5 execuções web mais recentes', async () => {
    const params = await webParams();
    expect(params).toEqual(
      ['run_0', 'run_1', 'run_2', 'run_3', 'run_4'].map((runId) => ({ runId })),
    );
  });

  it('mostra a execução pedida', async () => {
    render(await WebReportPage({ params: Promise.resolve({ runId: 'run_3' }) }));
    expect(screen.getByText('Antigo')).toBeInTheDocument();
  });

  it('responde 404 para execução inexistente', async () => {
    await expect(WebReportPage({ params: Promise.resolve({ runId: 'nope' }) })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
  });
});
