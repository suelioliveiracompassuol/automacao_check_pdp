import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const auth = vi.hoisted(() => ({
  user: null as { email: string | null } | null,
  logout: vi.fn(),
}));
vi.mock('../auth-context', () => ({ useAuth: () => auth }));

import { HeaderUser } from '../header-user';
import { NavHeader } from '../nav-header';

describe('HeaderUser', () => {
  beforeEach(() => {
    auth.user = null;
    auth.logout = vi.fn().mockResolvedValue(undefined);
  });

  it('sem login não mostra nada', () => {
    const { container } = render(<HeaderUser />);
    expect(container).toBeEmptyDOMElement();
  });

  it('logado, mostra o e-mail e a inicial na barra do topo', () => {
    auth.user = { email: 'sueli@natura.net' };
    render(<NavHeader actions={<HeaderUser />} />);
    expect(screen.getByRole('banner')).toHaveTextContent('Logado como sueli@natura.net');
    expect(screen.getByText('s')).toBeInTheDocument();
  });

  it('o botão de sair faz logout', async () => {
    auth.user = { email: 'sueli@natura.net' };
    render(<HeaderUser />);
    const button = screen.getByRole('button', { name: 'Sair (sueli@natura.net)' });
    fireEvent.click(button);
    expect(button).toBeDisabled();
    await waitFor(() => expect(button).toBeEnabled());
    expect(auth.logout).toHaveBeenCalledTimes(1);
  });

  it('usuário sem e-mail aparece como "Usuário"', () => {
    auth.user = { email: null };
    render(<HeaderUser />);
    expect(screen.getByRole('button', { name: 'Sair (Usuário)' })).toBeInTheDocument();
  });
});
