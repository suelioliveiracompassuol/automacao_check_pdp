import { Info, ShieldCheck } from 'lucide-react';
import { AuthLogin } from '@/components/auth-login';
import { CatalogNav } from '@/components/catalog/catalog-nav';
import { CatalogQualityClient } from './catalog-quality-client';

export const metadata = {
  title: 'Qualidade do catálogo',
};

/** Por enquanto só Natura BR, como a página do catálogo. */
const OPERATION = 'natura-BR';

/**
 * Restrita a quem tem login (o mesmo do gerenciador de SKUs). Os dados não entram no export
 * estático: o cliente os lê do Firestore depois do login (ver `catalog-quality-client.ts`).
 */
export default function CatalogQualityPage() {
  return (
    <div className="space-y-8 animate-fade-in-up pb-12">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-wash text-primary-dark">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-highlight sm:text-3xl">
              Qualidade do catálogo Natura BR
            </h1>
          </div>
          <AuthLogin />
        </div>

        <div className="mt-4">
          <CatalogNav active="quality" />
        </div>

        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-neutral-75 bg-surface p-3 text-xs text-medium-emphasis shadow-tiny">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary-dark" aria-hidden="true" />
          <p>
            Validação feita <strong>só com o arquivo do catálogo</strong>, sem abrir a loja: colunas
            da mesma linha que se contradizem (tipo × concentração, nome × volume, preços) e
            conteúdo que a PDP mostra e está faltando ou com erro de digitação. A PDP exibe o que o
            arquivo manda, então cada problema aqui aparece igual na página. <strong>Erro</strong> é
            informação contraditória ou faltando que o cliente vê; <strong>alerta</strong> pede
            conferência.
          </p>
        </div>
      </div>

      <CatalogQualityClient operation={OPERATION} />
    </div>
  );
}
