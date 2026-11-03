import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeCatalogQualityReport } from '@/test/fixtures';

const api = vi.hoisted(() => ({ readCatalogQuality: vi.fn() }));
vi.mock('@/lib/catalog-quality-client', () => api);

const auth = vi.hoisted(() => ({
  user: null as { uid: string; email: string } | null,
  loading: false,
}));
vi.mock('@/components/auth-context', () => ({
  useAuth: () => auth,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/auth-login', () => ({ AuthLogin: () => <div>login</div> }));

import CatalogQualityPage from '../catalogo/qualidade/page';

describe('CatalogQualityPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.user = null;
    auth.loading = false;
    api.readCatalogQuality.mockResolvedValue(makeCatalogQualityReport());
  });

  it('sem login, avisa que precisa entrar e não busca nem mostra dados', () => {
    render(<CatalogQualityPage />);
    expect(
      screen.getByRole('heading', { name: 'Qualidade do catálogo Natura BR' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Acesso Restrito')).toBeInTheDocument();
    expect(
      screen.getByText(/precisa estar logado para ver a qualidade do catálogo/),
    ).toBeInTheDocument();
    expect(api.readCatalogQuality).not.toHaveBeenCalled();
    expect(screen.queryByRole('region', { name: 'Resumo da validação' })).not.toBeInTheDocument();
    expect(screen.queryByText(/catalog_export_retrofit/)).not.toBeInTheDocument();
  });

  it('enquanto verifica o login não mostra nada', () => {
    auth.loading = true;
    render(<CatalogQualityPage />);
    expect(screen.getByRole('status')).toHaveTextContent('Verificando autenticação');
    expect(api.readCatalogQuality).not.toHaveBeenCalled();
  });

  it('com login, busca no Firestore e mostra o painel', async () => {
    auth.user = { uid: 'u1', email: 'a@b.com' };
    render(<CatalogQualityPage />);
    expect(screen.getByRole('status')).toHaveTextContent('Carregando validação');
    expect(await screen.findByRole('region', { name: 'Resumo da validação' })).toBeInTheDocument();
    expect(api.readCatalogQuality).toHaveBeenCalledWith('natura-BR');
    expect(screen.getByText(/catalog_export_retrofit\.psv/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Qualidade' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Produtos' })).toHaveAttribute('href', '/catalogo');
  });

  it('com login e sem validação publicada, explica como gerar', async () => {
    auth.user = { uid: 'u1', email: 'a@b.com' };
    api.readCatalogQuality.mockResolvedValue(null);
    render(<CatalogQualityPage />);
    expect(await screen.findByText('npm run catalog')).toBeInTheDocument();
  });

  it('mostra erro quando a leitura falha', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    auth.user = { uid: 'u1', email: 'a@b.com' };
    api.readCatalogQuality.mockRejectedValue(new Error('permission-denied'));
    render(<CatalogQualityPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar a validação do catálogo',
    );
  });
});
