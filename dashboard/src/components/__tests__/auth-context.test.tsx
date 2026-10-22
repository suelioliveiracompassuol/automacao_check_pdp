import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const firebase = vi.hoisted(() => ({
  listener: null as ((user: unknown) => void) | null,
  unsubscribe: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  onAuthStateChanged: vi.fn((_auth, callback) => {
    firebase.listener = callback;
    return firebase.unsubscribe;
  }),
  signInWithEmailAndPassword: firebase.signIn,
  signOut: firebase.signOut,
}));
vi.mock('@/lib/firebase-init', () => ({ firebaseApp: {} }));

import { AuthProvider, useAuth } from '../auth-context';

function Consumer() {
  const { user, loading, error, login, logout } = useAuth();
  return (
    <div>
      <p>{loading ? 'carregando' : ((user as { email?: string } | null)?.email ?? 'anônimo')}</p>
      {error && <p role="alert">{error}</p>}
      <button onClick={() => login('a@b.com', 'x').catch(() => {})}>entrar</button>
      <button onClick={() => logout().catch(() => {})}>sair</button>
    </div>
  );
}

const renderProvider = () =>
  render(
    <AuthProvider>
      <Consumer />
    </AuthProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  firebase.listener = null;
});

describe('AuthProvider', () => {
  it('fica carregando até o Firebase informar o usuário', () => {
    renderProvider();
    expect(screen.getByText('carregando')).toBeInTheDocument();
    act(() => firebase.listener?.({ email: 'a@b.com' }));
    expect(screen.getByText('a@b.com')).toBeInTheDocument();
  });

  it('cancela a inscrição ao desmontar', () => {
    const { unmount } = renderProvider();
    unmount();
    expect(firebase.unsubscribe).toHaveBeenCalled();
  });

  it('faz login e logout pelo Firebase', async () => {
    firebase.signIn.mockResolvedValue(undefined);
    firebase.signOut.mockResolvedValue(undefined);
    renderProvider();
    await userEvent.click(screen.getByText('entrar'));
    expect(firebase.signIn).toHaveBeenCalledWith({}, 'a@b.com', 'x');
    await userEvent.click(screen.getByText('sair'));
    expect(firebase.signOut).toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('expõe a mensagem de erro do login e do logout', async () => {
    firebase.signIn.mockRejectedValue(new Error('senha inválida'));
    firebase.signOut.mockRejectedValue('falha sem Error');
    renderProvider();
    await userEvent.click(screen.getByText('entrar'));
    expect(await screen.findByRole('alert')).toHaveTextContent('senha inválida');
    await userEvent.click(screen.getByText('sair'));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Erro ao fazer logout'),
    );
  });
});

describe('useAuth', () => {
  it('exige o AuthProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Consumer />)).toThrow('useAuth deve ser usado dentro de AuthProvider');
  });
});
