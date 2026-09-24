'use client';

import { AlertCircle } from 'lucide-react';
import { useAuth } from './auth-context';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="text-sm text-low-emphasis">Verificando autenticação...</div>;
  }

  if (!user) {
    return (
      fallback || (
        <div className="rounded-lg border border-warning-light/60 bg-warning-lightest/50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-warning-darkest" aria-hidden="true" />
            <div className="text-sm text-warning-darkest">
              <p className="font-medium">Acesso Restrito</p>
              <p className="mt-1">
                Você precisa estar logado para gerenciar SKUs. Entre em contato com o administrador
                para obter as credenciais de acesso.
              </p>
            </div>
          </div>
        </div>
      )
    );
  }

  return <>{children}</>;
}

interface AuthDisabledProps {
  disabled?: boolean;
  children: React.ReactNode;
  title?: string;
}

export function AuthDisabledButton({ disabled, children, title }: AuthDisabledProps) {
  const { user } = useAuth();
  const isDisabled = disabled || !user;

  return (
    <div
      className={isDisabled ? 'group relative' : ''}
      title={isDisabled ? title || 'Faça login para usar este recurso' : ''}
    >
      <div className={isDisabled ? 'opacity-50 cursor-not-allowed' : ''}>{children}</div>
      {isDisabled && (
        <div className="absolute left-0 top-full z-10 hidden whitespace-nowrap rounded-lg bg-neutral-900 px-2 py-1 text-xs text-white group-hover:block">
          Faça login para usar este recurso
        </div>
      )}
    </div>
  );
}
