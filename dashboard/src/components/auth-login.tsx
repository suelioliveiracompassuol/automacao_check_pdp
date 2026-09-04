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
      <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
        <div className="text-sm">
          <p className="font-medium text-gray-700">{user.email}</p>
          <p className="text-xs text-gray-500">Autenticado</p>
        </div>
        <button
          onClick={handleLogout}
          disabled={loading}
          className="rounded-lg p-1.5 text-gray-600 transition-colors hover:bg-gray-200 disabled:opacity-50"
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
        className="flex items-center gap-2 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
      >
        <LogIn className="h-4 w-4" aria-hidden="true" />
        Fazer Login
      </button>

      {showForm && (
        <form
          onSubmit={handleLogin}
          className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3"
        >
          <div>
            <label className="block text-xs font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@exemplo.com"
              required
              disabled={loading}
              className="mt-1 w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm placeholder-gray-400 disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sua senha"
              required
              disabled={loading}
              className="mt-1 w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm placeholder-gray-400 disabled:bg-gray-100"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      )}
    </div>
  );
}
