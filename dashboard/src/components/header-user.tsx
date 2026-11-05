'use client';

import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from './auth-context';

/**
 * Quem está logado, na barra do topo (vale para todas as páginas). Sem login não mostra nada:
 * o botão de entrar fica nas páginas que exigem login (SKUs, qualidade do catálogo).
 */
export function HeaderUser() {
  const { user, logout } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!user) {
    return null;
  }

  const email = user.email ?? 'Usuário';
  const handleLogout = async () => {
    setBusy(true);
    try {
      await logout();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="hidden h-6 w-px bg-neutral-100 sm:block" aria-hidden="true" />
      <div
        className="flex items-center gap-2 rounded-full border border-neutral-75 bg-surface py-1 pr-1 pl-1 shadow-tiny"
        title={`Logado como ${email}`}
      >
        <span
          aria-hidden="true"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-wash text-xs font-bold text-primary-darkest uppercase"
        >
          {email.charAt(0)}
        </span>
        <span className="hidden max-w-56 truncate text-xs font-medium text-high-emphasis md:block">
          <span className="sr-only">Logado como </span>
          {email}
        </span>
        <button
          type="button"
          onClick={handleLogout}
          disabled={busy}
          aria-label={`Sair (${email})`}
          title="Sair"
          className="rounded-full p-1.5 text-medium-emphasis transition-colors hover:bg-neutral-50 hover:text-high-emphasis disabled:opacity-50"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
