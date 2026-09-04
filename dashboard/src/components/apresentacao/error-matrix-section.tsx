import { Card } from '@/components/ui/card';
import { cn, getCountryFlag } from '@/lib/utils';
import { COUNTRY_INFO, type Country, type MonitoringReport } from '@/lib/types';
import { ALL_CHECKLIST_ITEMS } from '@/lib/checks-catalog';
import { VENDOR_LABELS } from './content';

const EXCLUDED_CHECKS = new Set(['pricing', 'shipping']);

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

  const labelMap = Object.fromEntries(ALL_CHECKLIST_ITEMS.map((c) => [c.key, c.name]));

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
  const countryInfo = COUNTRY_INFO[row.country as Country];

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
          {VENDOR_LABELS[row.vendor]?.label ?? row.vendor}
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
                  failed ? 'border-red-600 bg-red-500' : 'border-gray-200 bg-gray-100',
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
  const topFailures = errorMatrix.filter((row) => row.persistenceCount >= 2).slice(0, 3);

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

      {topFailures.length > 0 && (
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {topFailures.map((row) => {
            const countryInfo = COUNTRY_INFO[row.country as Country];
            return (
              <div
                key={`${row.checkKey}-${row.vendor}-${row.country}`}
                className="rounded-xl border border-red-100 bg-red-50 p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-red-600">
                    Falha persistente
                  </span>
                  <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
                    {row.persistenceCount}/{reports.length} runs
                  </span>
                </div>
                <p className="mt-2 font-semibold text-gray-900">{row.checkLabel}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {VENDOR_LABELS[row.vendor]?.label ?? row.vendor} ·{' '}
                  {countryInfo?.label ?? row.country}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="table">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
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
