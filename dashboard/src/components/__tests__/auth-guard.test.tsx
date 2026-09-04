import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthGuard, AuthDisabledButton } from '../auth-guard';

// Mock do hook useAuth
const mockUseAuth = vi.fn();

vi.mock('../auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('AuthGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('quando usuário está autenticado', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { email: 'usuario@example.com' },
        loading: false,
      });
    });

    it('deve renderizar children quando usuário está logado', () => {
      render(
        <AuthGuard>
          <div>Conteúdo protegido</div>
        </AuthGuard>,
      );

      expect(screen.getByText('Conteúdo protegido')).toBeDefined();
    });

    it('deve renderizar múltiplos children', () => {
      render(
        <AuthGuard>
          <div>Conteúdo 1</div>
          <div>Conteúdo 2</div>
        </AuthGuard>,
      );

      expect(screen.getByText('Conteúdo 1')).toBeDefined();
      expect(screen.getByText('Conteúdo 2')).toBeDefined();
    });
  });

  describe('quando usuário não está autenticado', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
      });
    });

    it('deve exibir mensagem padrão quando não autenticado', () => {
      render(
        <AuthGuard>
          <div>Conteúdo protegido</div>
        </AuthGuard>,
      );

      expect(screen.getByText('Acesso Restrito')).toBeDefined();
      expect(
        screen.getByText(/Você precisa estar logado para gerenciar SKUs/),
      ).toBeDefined();
    });

    it('deve exibir fallback customizado se fornecido', () => {
      render(
        <AuthGuard fallback={<div>Acesso negado customizado</div>}>
          <div>Conteúdo protegido</div>
        </AuthGuard>,
      );

      expect(screen.getByText('Acesso negado customizado')).toBeDefined();
      expect(screen.queryByText('Conteúdo protegido')).toBeNull();
    });

    it('deve ter link para contactar administrador na mensagem', () => {
      render(
        <AuthGuard>
          <div>Conteúdo protegido</div>
        </AuthGuard>,
      );

      expect(screen.getByText(/Entre em contato com o administrador/)).toBeDefined();
    });
  });
});

describe('AuthDisabledButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('quando usuário está autenticado', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { email: 'usuario@example.com' },
      });
    });

    it('deve renderizar children normalmente quando autenticado', () => {
      render(
        <AuthDisabledButton>
          <button>Clique aqui</button>
        </AuthDisabledButton>,
      );

      expect(screen.getByText('Clique aqui')).toBeDefined();
    });

    it('deve não ter atributo title quando autenticado', () => {
      const { container } = render(
        <AuthDisabledButton>
          <button>Clique aqui</button>
        </AuthDisabledButton>,
      );

      const div = container.firstChild as HTMLElement;
      expect(div.getAttribute('title')).toBeFalsy();
    });
  });

  describe('quando usuário não está autenticado', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: null,
      });
    });

    it('deve exibir title com mensagem padrão quando não autenticado', () => {
      const { container } = render(
        <AuthDisabledButton>
          <button>Clique aqui</button>
        </AuthDisabledButton>,
      );

      const div = container.firstChild as HTMLElement;
      expect(div.getAttribute('title')).toBe('Faça login para usar este recurso');
    });

    it('deve usar title customizado se fornecido', () => {
      const { container } = render(
        <AuthDisabledButton title="Acesso exclusivo">
          <button>Clique aqui</button>
        </AuthDisabledButton>,
      );

      const div = container.firstChild as HTMLElement;
      expect(div.getAttribute('title')).toBe('Acesso exclusivo');
    });

    it('deve renderizar tooltip com mensagem', () => {
      const { container } = render(
        <AuthDisabledButton>
          <button>Clique aqui</button>
        </AuthDisabledButton>,
      );

      const tooltipText = screen.getByText('Faça login para usar este recurso');
      expect(tooltipText).toBeDefined();
    });
  });

  describe('quando disabled prop é true', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { email: 'usuario@example.com' },
      });
    });

    it('deve aplicar title mesmo quando usuário está autenticado se disabled=true', () => {
      const { container } = render(
        <AuthDisabledButton disabled={true}>
          <button>Clique aqui</button>
        </AuthDisabledButton>,
      );

      const div = container.firstChild as HTMLElement;
      expect(div.getAttribute('title')).toBe('Faça login para usar este recurso');
    });
  });

  describe('renderização de múltiplos children', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { email: 'usuario@example.com' },
      });
    });

    it('deve renderizar múltiplos botões', () => {
      render(
        <AuthDisabledButton>
          <button>Botão 1</button>
          <button>Botão 2</button>
        </AuthDisabledButton>,
      );

      expect(screen.getByText('Botão 1')).toBeDefined();
      expect(screen.getByText('Botão 2')).toBeDefined();
    });
  });
});
