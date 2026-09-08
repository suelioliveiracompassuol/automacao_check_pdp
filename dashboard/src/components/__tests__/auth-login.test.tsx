import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthLogin } from '../auth-login';

// Mock do hook useAuth
const mockUseAuth = vi.fn();

vi.mock('../auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('AuthLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('quando usuário não está autenticado', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        login: vi.fn(),
        logout: vi.fn(),
        error: null,
      });
    });

    it('deve exibir botão "Fazer Login"', () => {
      render(<AuthLogin />);
      expect(screen.getByText('Fazer Login')).toBeDefined();
    });

    it('deve exibir formulário quando botão é clicado', async () => {
      const user = userEvent.setup();
      render(<AuthLogin />);

      const button = screen.getByText('Fazer Login');
      await user.click(button);

      expect(screen.getByPlaceholderText('usuario@exemplo.com')).toBeDefined();
      expect(screen.getByPlaceholderText('Sua senha')).toBeDefined();
    });

    it('deve ocultar formulário ao clicar novamente', async () => {
      const user = userEvent.setup();
      render(<AuthLogin />);

      const button = screen.getByText('Fazer Login');
      await user.click(button);
      expect(screen.getByPlaceholderText('usuario@exemplo.com')).toBeDefined();

      await user.click(button);
      expect(screen.queryByPlaceholderText('usuario@exemplo.com')).toBeNull();
    });

    it('deve chamar login com email e senha ao submeter formulário', async () => {
      const user = userEvent.setup();
      const mockLogin = vi.fn().mockResolvedValue(undefined);
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        login: mockLogin,
        logout: vi.fn(),
        error: null,
      });

      render(<AuthLogin />);

      const button = screen.getByText('Fazer Login');
      await user.click(button);

      const emailInput = screen.getByPlaceholderText('usuario@exemplo.com');
      const passwordInput = screen.getByPlaceholderText('Sua senha');
      const submitButton = screen.getByRole('button', { name: /Entrar/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
      });
    });

    it('deve exibir mensagem de erro quando login falha', async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        login: vi.fn(),
        logout: vi.fn(),
        error: 'Credenciais inválidas',
      });

      render(<AuthLogin />);

      const button = screen.getByText('Fazer Login');
      await user.click(button);

      expect(screen.getByText('Credenciais inválidas')).toBeDefined();
    });
  })

  describe('quando usuário está autenticado', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { email: 'usuario@example.com' },
        loading: false,
        login: vi.fn(),
        logout: vi.fn(),
        error: null,
      });
    });

    it('deve exibir email e status "Autenticado"', () => {
      render(<AuthLogin />);

      expect(screen.getByText('usuario@example.com')).toBeDefined();
      expect(screen.getByText('Autenticado')).toBeDefined();
    });

    it('deve não exibir botão "Fazer Login"', () => {
      render(<AuthLogin />);

      expect(screen.queryByText('Fazer Login')).toBeNull();
    });

    it('deve exibir botão de logout', () => {
      render(<AuthLogin />);

      const logoutButton = screen.getByTitle('Fazer logout');
      expect(logoutButton).toBeDefined();
    });

    it('deve chamar logout ao clicar no botão de logout', async () => {
      const user = userEvent.setup();
      const mockLogout = vi.fn().mockResolvedValue(undefined);
      mockUseAuth.mockReturnValue({
        user: { email: 'usuario@example.com' },
        loading: false,
        login: vi.fn(),
        logout: mockLogout,
        error: null,
      });

      render(<AuthLogin />);

      const logoutButton = screen.getByTitle('Fazer logout');
      await user.click(logoutButton);

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
      });
    });
  });

  describe('validação de formulário', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        login: vi.fn(),
        logout: vi.fn(),
        error: null,
      });
    });

    it('deve exigir email', async () => {
      const user = userEvent.setup();
      render(<AuthLogin />);

      const button = screen.getByText('Fazer Login');
      await user.click(button);

      const emailInput = screen.getByPlaceholderText('usuario@exemplo.com') as HTMLInputElement;
      expect(emailInput.required).toBe(true);
    });

    it('deve exigir senha', async () => {
      const user = userEvent.setup();
      render(<AuthLogin />);

      const button = screen.getByText('Fazer Login');
      await user.click(button);

      const passwordInput = screen.getByPlaceholderText('Sua senha') as HTMLInputElement;
      expect(passwordInput.required).toBe(true);
    });

    it('deve ter type="email" no input de email', async () => {
      const user = userEvent.setup();
      render(<AuthLogin />);

      const button = screen.getByText('Fazer Login');
      await user.click(button);

      const emailInput = screen.getByPlaceholderText('usuario@exemplo.com') as HTMLInputElement;
      expect(emailInput.type).toBe('email');
    });

    it('deve ter type="password" no input de senha', async () => {
      const user = userEvent.setup();
      render(<AuthLogin />);

      const button = screen.getByText('Fazer Login');
      await user.click(button);

      const passwordInput = screen.getByPlaceholderText('Sua senha') as HTMLInputElement;
      expect(passwordInput.type).toBe('password');
    });
  });
});
