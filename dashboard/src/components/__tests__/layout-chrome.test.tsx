import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { makeReport } from '@/test/fixtures';

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn(() => '/') }));
vi.mock('next/navigation', () => ({ usePathname }));

import { NavHeader } from '../nav-header';
import { PlatformHero } from '../platform-hero';
import { Sidebar } from '../sidebar';

describe('Sidebar', () => {
  it('lista todas as rotas e marca a atual', () => {
    usePathname.mockReturnValue('/web/run_1');
    render(<Sidebar />);
    expect(screen.getByRole('link', { name: 'Visão Geral' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Web' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Android (beta)' })).toHaveAttribute(
      'href',
      '/android',
    );
    expect(screen.getByRole('link', { name: 'iOS (em breve)' })).toHaveAttribute('href', '/ios');
    expect(screen.getByRole('link', { name: 'SKUs' })).toHaveAttribute('href', '/skus');
  });

  it('recolhe e expande a seção de plataformas', async () => {
    render(<Sidebar />);
    const toggle = screen.getByRole('button', { name: /plataformas/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('NavHeader', () => {
  const web = { platform: 'web' as const, runId: 'run_1', startTime: '2024-05-01T13:00:00Z' };
  const android = {
    platform: 'android' as const,
    runId: 'run_android_1',
    startTime: '2024-05-01T15:00:00Z',
  };

  it('mostra um status por automação, cada um levando à sua execução', () => {
    render(
      <NavHeader
        lastRuns={[
          { ...web, failed: 0, errors: 0 },
          { ...android, failed: 1, errors: 0 },
        ]}
      />,
    );
    expect(
      screen.getByRole('link', { name: 'Web: sem falhas na última execução' }),
    ).toHaveAttribute('href', '/web/run_1');
    expect(
      screen.getByRole('link', { name: 'Android: 1 falha na última execução' }),
    ).toHaveAttribute('href', '/android/run_android_1');
  });

  it('conta falhas e erros no plural', () => {
    render(<NavHeader lastRuns={[{ ...web, failed: 2, errors: 1 }]} />);
    expect(
      screen.getByRole('link', { name: 'Web: 3 falhas na última execução' }),
    ).toBeInTheDocument();
  });

  it('sem execuções, não mostra status', () => {
    render(<NavHeader lastRuns={[]} />);
    expect(screen.queryByRole('navigation', { name: 'Status das automações' })).toBeNull();
  });
});

describe('PlatformHero', () => {
  it('mostra canal, título, descrição, metadados da execução e ação', () => {
    render(
      <PlatformHero
        platform="web"
        title="Monitor Web"
        description="Descrição"
        report={makeReport({ runId: 'run_42', durationMs: 125_000 })}
        action={<button>Histórico</button>}
      />,
    );
    expect(screen.getByText('Site · Natura & Avon · Minha Loja')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Monitor Web' })).toBeInTheDocument();
    expect(screen.getByText('Descrição')).toBeInTheDocument();
    expect(screen.getByText('2m 5s')).toBeInTheDocument();
    expect(screen.getByText('run_42')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Histórico' })).toBeInTheDocument();
  });
});
