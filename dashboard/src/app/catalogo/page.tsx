import { Info, PackageSearch } from 'lucide-react';
import { CatalogNav } from '@/components/catalog/catalog-nav';
import { CatalogTable } from '@/components/catalog/catalog-table';
import { EmptyState } from '@/components/empty-state';
import { Card } from '@/components/ui/card';
import { summarizeCatalog } from '@/lib/catalog';
import { getCatalog } from '@/lib/data';
import { formatDateTime } from '@/lib/format';

export const metadata = {
  title: 'Catálogo',
};

/** Por enquanto só Natura BR; os outros países entram com o feed de cada site no monitor. */
const OPERATION = 'natura-BR';

function Kpi({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-medium-emphasis">{label}</p>
      <p className="mt-1 text-2xl font-bold text-highlight">{value.toLocaleString('pt-BR')}</p>
      {hint && <p className="mt-0.5 text-xs text-low-emphasis">{hint}</p>}
    </Card>
  );
}

export default function CatalogPage() {
  const snapshot = getCatalog(OPERATION);

  if (!snapshot) {
    return (
      <EmptyState
        icon={<PackageSearch />}
        title="Catálogo"
        badge="beta"
        description={
          <>
            Ainda não há catálogo baixado. Rode <code>npm run catalog</code> na raiz do monitor
            (precisa de <code>SFCC_CLIENT_ID</code> e <code>SFCC_CLIENT_SECRET</code> no{' '}
            <code>.env.local</code>).
          </>
        }
      />
    );
  }

  const summary = summarizeCatalog(snapshot);
  const isBaseline = snapshot.fetchedAt === snapshot.baselineAt;

  return (
    <div className="space-y-8 animate-fade-in-up pb-12">
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-wash text-primary-dark">
            <PackageSearch className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-highlight sm:text-3xl">
              Catálogo Natura BR
            </h1>
            <p className="text-xs text-medium-emphasis sm:text-sm">
              Feed do SFCC ({snapshot.source.file.split('/').pop()}) · baixado em{' '}
              {formatDateTime(snapshot.fetchedAt)}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <CatalogNav active="products" />
        </div>

        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-neutral-75 bg-surface p-3 text-xs text-medium-emphasis shadow-tiny">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary-dark" aria-hidden="true" />
          <p>
            O feed não traz data de lançamento. Um produto é <strong>novo</strong> quando aparece
            num download depois do primeiro, feito em {formatDateTime(snapshot.baselineAt)}.
            {isBaseline &&
              ' Este é o primeiro download, então ainda não há novos: a lista está ordenada pelo código mais alto, que costuma ser o cadastro mais recente.'}
          </p>
        </div>
      </div>

      <section aria-label="Resumo do catálogo" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="PDPs" value={summary.total} />
        <Kpi label="Disponíveis" value={summary.available} />
        <Kpi label="Kits" value={summary.bundles} />
        <Kpi label="Variações" value={summary.variants} />
        <Kpi
          label="Novos"
          value={summary.newProducts}
          hint={`desde ${formatDateTime(snapshot.baselineAt)}`}
        />
      </section>

      <section aria-labelledby="catalog-products-title" className="space-y-4">
        <h2 id="catalog-products-title" className="text-lg font-bold text-highlight">
          Produtos
        </h2>
        <Card>
          <CatalogTable snapshot={snapshot} />
        </Card>
      </section>
    </div>
  );
}
