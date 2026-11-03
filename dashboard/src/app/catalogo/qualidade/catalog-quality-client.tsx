'use client';

import { useEffect, useState } from 'react';
import { AuthRequiredNotice } from '@/components/auth-guard';
import { useAuth } from '@/components/auth-context';
import { CatalogQualityPanel } from '@/components/catalog/catalog-quality-panel';
import { readCatalogQuality } from '@/lib/catalog-quality-client';
import { formatDateTime } from '@/lib/format';
import type { CatalogQualityReport } from '@/lib/types';

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; report: CatalogQualityReport | null };

/** Só busca a validação com alguém logado; sem login não há nada na página além do aviso. */
export function CatalogQualityClient({ operation }: { operation: string }) {
  const { user, loading: authLoading } = useAuth();
  const uid = user?.uid ?? null;
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    if (!uid) {
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    readCatalogQuality(operation)
      .then((report) => !cancelled && setState({ status: 'loaded', report }))
      .catch((error: unknown) => {
        console.error(error);
        if (!cancelled) {
          setState({ status: 'error' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [uid, operation]);

  if (authLoading) {
    return (
      <p role="status" className="text-sm text-low-emphasis">
        Verificando autenticação…
      </p>
    );
  }

  if (!user) {
    return <AuthRequiredNotice action="ver a qualidade do catálogo" />;
  }

  if (state.status === 'loading') {
    return (
      <p role="status" className="text-sm text-low-emphasis">
        Carregando validação…
      </p>
    );
  }

  if (state.status === 'error') {
    return (
      <p role="alert" className="rounded-lg bg-alert/10 p-4 text-sm text-alert-dark">
        Não foi possível carregar a validação do catálogo. Tente recarregar a página.
      </p>
    );
  }

  const { report } = state;
  if (!report) {
    return (
      <p className="rounded-lg border border-dashed border-neutral-75 p-6 text-center text-sm text-medium-emphasis">
        Ainda não há validação do catálogo publicada. Rode <code>npm run catalog</code> na raiz do
        monitor com as credenciais do Firebase (<code>FIREBASE_PROJECT_ID</code>,{' '}
        <code>FIREBASE_CLIENT_EMAIL</code>, <code>FIREBASE_PRIVATE_KEY</code>).
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-medium-emphasis sm:text-sm">
        Feed do SFCC ({report.source.file.split('/').pop()}) · validado em{' '}
        {formatDateTime(report.fetchedAt)}
      </p>
      <CatalogQualityPanel report={report} />
    </div>
  );
}
