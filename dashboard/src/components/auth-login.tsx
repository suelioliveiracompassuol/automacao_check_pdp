'use client';

import { useCallback, useState } from 'react';
import { LogIn } from 'lucide-react';
import { useAuth } from './auth-context';

export function AuthLogin() {
  const { user, login, error } = useAuth();
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

  // Logado, quem é e o botão de sair ficam na barra do topo (HeaderUser), em todas as páginas.
  if (user) {
    return null;
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setShowForm(!showForm)}
        aria-expanded={showForm}
        aria-controls="auth-login-form"
        className="flex items-center gap-2 rounded-lg border border-primary-light bg-primary-wash px-3 py-2 text-sm font-medium text-primary-darkest transition-colors hover:bg-primary-lightest"
      >
        <LogIn className="h-4 w-4" aria-hidden="true" />
        Fazer Login
      </button>

      {showForm && (
        <form
          id="auth-login-form"
          onSubmit={handleLogin}
          className="space-y-3 rounded-lg border border-neutral-100 bg-neutral-50 p-3"
        >
          <div>
            <label htmlFor="auth-email" className="block text-xs font-medium text-high-emphasis">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@exemplo.com"
              required
              disabled={loading}
              className="mt-1 w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm placeholder-low-emphasis disabled:bg-neutral-75"
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="block text-xs font-medium text-high-emphasis">
              Senha
            </label>
            <input
              id="auth-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sua senha"
              required
              disabled={loading}
              className="mt-1 w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm placeholder-low-emphasis disabled:bg-neutral-75"
            />
          </div>

          {error && (
            <p className="text-xs text-alert-dark" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-highlight transition-colors hover:bg-primary-dark disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      )}
    </div>
  );
}
