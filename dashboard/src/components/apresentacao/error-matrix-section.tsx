import { Card } from '@/components/ui/card';
import { cn, getCountryFlag } from '@/lib/utils';
import type { MonitoringReport } from '@/lib/types';

const EXCLUDED_CHECKS = new Set(['pricing', 'shipping']);

const CHECK_CARDS = [
  { key: 'contentBanners', name: 'Banners de Conteúdo' },
  { key: 'i18nKeys', name: 'Chaves de i18n' },
  { key: 'ratingConsistency', name: 'API de Reviews' },
  { key: 'reviewPhotos', name: 'Fotos nas Avaliações' },
  { key: 'reviewRecommendation', name: 'Recomendação de Reviews' },
  { key: 'addToCart', name: 'Adicionar ao Carrinho' },
  { key: 'favoriteButton', name: 'Botão de Favorito' },
  { key: 'productVariations', name: 'Variações do Produto' },
  { key: 'remoteConfig', name: 'Feature Flags' },
  { key: 'aiReviewSummary', name: 'AI Review Summary' },
] as const;

const COUNTRY_INFO: Record<string, { label: string }> = {
  AR: { label: 'Argentina' },
  BR: { label: 'Brasil' },
  CL: { label: 'Chile' },
  CO: { label: 'Colômbia' },
  MX: { label: 'México' },
  PE: { label: 'Peru' },
};

interface MatrixRow {
  checkKey: string;
  checkLabel: string;
  vendor: string;
  country: string;
  failures: boolean[];
  persistenceCount: number;
}

function computeErrorMatrix(reports: MonitoringReport[]): MatrixRow[] {
  const matrix = new Map<
    string,
    { checkKey: string; vendor: string; country: string; failures: boolean[] }
  >();

  reports.forEach((report, runIndex) => {
    report.results.forEach((pdp) => {
      pdp.features.forEach((feature) => {
        if (EXCLUDED_CHECKS.has(feature.featureKey)) return;
        if (feature.status !== 'fail' && feature.status !== 'error') return;

        const key = `${feature.featureKey}|${pdp.vendor.toLowerCase()}|${pdp.country.toUpperCase()}`;
        if (!matrix.has(key)) {
          matrix.set(key, {
            checkKey: feature.featureKey,
            vendor: pdp.vendor.toLowerCase(),
            country: pdp.country.toUpperCase(),
            failures: Array(reports.length).fill(false) as boolean[],
          });
        }
        const row = matrix.get(key)!;
        row.failures[runIndex] = true;
      });
    });
  });

  const labelMap = Object.fromEntries(CHECK_CARDS.map((c) => [c.key, c.name]));

  return Array.from(matrix.values())
    .map((row) => ({
      ...row,
      checkLabel: labelMap[row.checkKey] ?? row.checkKey,
      persistenceCount: row.failures.filter(Boolean).length,
    }))
    .filter((row) => row.persistenceCount > 0)
    .sort(
      (a, b) => b.persistenceCount - a.persistenceCount || a.checkLabel.localeCompare(b.checkLabel),
    );
}

interface MatrixRowItemProps {
  row: MatrixRow;
  totalRuns: number;
}

function MatrixRowItem({ row, totalRuns }: MatrixRowItemProps) {
  const countryInfo = COUNTRY_INFO[row.country];

  return (
    <tr className="transition-colors hover:bg-gray-50/50">
      <td className="px-4 py-3">
        <span className="font-medium text-gray-800">{row.checkLabel}</span>
      </td>
      <td className="px-4 py-3">
        <span
          className={cn(
            'inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold',
            row.vendor === 'natura' ? 'bg-orange-50 text-orange-700' : 'bg-pink-50 text-pink-700',
          )}
        >
          {row.vendor === 'natura' ? 'Natura' : 'Avon'}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="flex items-center gap-1.5 text-gray-700">
          <img
            src={getCountryFlag(row.country)}
            alt={`Bandeira do ${countryInfo?.label ?? row.country}`}
            width={20}
            height={15}
            className="h-4 w-5 rounded-sm object-cover"
          />
          <span>{countryInfo?.label ?? row.country}</span>
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-center gap-2">
          {row.failures.map((failed, i) => (
            <div key={`c${i + 1}`} className="flex flex-col items-center gap-0.5">
              <span className="font-mono text-[9px] text-gray-400">C{i + 1}</span>
              <div
                className={cn(
                  'h-4 w-4 rounded-full border-2',
                  failed ? 'border-red-600bg-red-500' : 'border-gray-200bg-gray-100',
                )}
              />
            </div>
          ))}
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <span
          className={cn(
            'inline-flex h-6 w-10 items-center justify-center rounded-full text-xs font-bold',
            row.persistenceCount === totalRuns
              ? 'bg-red-100 text-red-700'
              : row.persistenceCount >= 2
                ? 'bg-amber-100 text-amber-700'
                : 'bg-yellow-50 text-yellow-600',
          )}
        >
          {row.persistenceCount}/{totalRuns}
        </span>
      </td>
    </tr>
  );
}

interface ErrorMatrixSectionProps {
  reports: MonitoringReport[];
}

export function ErrorMatrixSection({ reports }: ErrorMatrixSectionProps) {
  const errorMatrix = computeErrorMatrix(reports);

  return (
    <section aria-labelledby="matrix-heading">
      <div className="mb-6">
        <h2 id="matrix-heading" className="text-2xl font-bold text-gray-900">
          Matriz de Erros
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Checks com falhas nas últimas {reports.length} execuções — ordenados por persistência
        </p>
      </div>
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="table">
            <thead>
              <tr className="border-b border-gray-100bg-gray-50">
                <th scope="col" className="w-48 px-4 py-3 text-left font-semibold text-gray-700">
                  Verificação
                </th>
                <th scope="col" className="w-24 px-4 py-3 text-left font-semibold text-gray-700">
                  Marca
                </th>
                <th scope="col" className="w-32 px-4 py-3 text-left font-semibold text-gray-700">
                  País
                </th>
                <th scope="col" className="px-4 py-3 text-center font-semibold text-gray-700">
                  Persistência
                  <span className="ml-1 text-xs font-normal text-gray-400">
                    (C1→C{reports.length})
                  </span>
                </th>
                <th scope="col" className="w-20 px-4 py-3 text-center font-semibold text-gray-700">
                  Runs
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {errorMatrix.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400">
                    Nenhum erro encontrado nas últimas execuções
                  </td>
                </tr>
              ) : (
                errorMatrix.map((row) => (
                  <MatrixRowItem
                    key={`${row.checkKey}-${row.vendor}-${row.country}`}
                    row={row}
                    totalRuns={reports.length}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
