'use client';

import { useCallback, useState } from 'react';
import { LogIn, LogOut } from 'lucide-react';
import { useAuth } from './auth-context';

export function AuthLogin() {
  const { user, login, logout, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const handleLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      try {
        await login(email, password);
        setEmail('');
        setPassword('');
        setShowForm(false);
      } catch {
        // Erro já tratado no contexto
      } finally {
        setLoading(false);
      }
    },
    [email, password, login],
  );

  const handleLogout = useCallback(async () => {
    setLoading(true);
    try {
      await logout();
    } finally {
      setLoading(false);
    }
  }, [logout]);

  if (user) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2">
        <div className="text-sm">
          <p className="font-medium text-high-emphasis">{user.email}</p>
          <p className="text-xs text-medium-emphasis">Autenticado</p>
        </div>
        <button
          onClick={handleLogout}
          disabled={loading}
          className="rounded-lg p-1.5 text-medium-emphasis transition-colors hover:bg-neutral-100 disabled:opacity-50"
          title="Fazer logout"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setShowForm(!showForm)}
        className="flex items-center gap-2 rounded-lg border border-primary-light bg-primary-wash px-3 py-2 text-sm font-medium text-primary-dark transition-colors hover:bg-primary-lightest"
      >
        <LogIn className="h-4 w-4" aria-hidden="true" />
        Fazer Login
      </button>

      {showForm && (
        <form
          onSubmit={handleLogin}
          className="space-y-3 rounded-lg border border-neutral-100 bg-neutral-50 p-3"
        >
          <div>
            <label className="block text-xs font-medium text-high-emphasis">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@exemplo.com"
              required
              disabled={loading}
              className="mt-1 w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm placeholder-low-emphasis disabled:bg-neutral-75"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-high-emphasis">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sua senha"
              required
              disabled={loading}
              className="mt-1 w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm placeholder-low-emphasis disabled:bg-neutral-75"
            />
          </div>

          {error && <p className="text-xs text-alert-dark">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      )}
    </div>
  );
}
