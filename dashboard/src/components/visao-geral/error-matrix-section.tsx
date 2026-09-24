import { Card, SectionHeader } from '@/components/ui/card';
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
    <tr className="transition-colors hover:bg-neutral-50/50">
      <td className="px-4 py-3">
        <span className="font-medium text-high-emphasis">{row.checkLabel}</span>
      </td>
      <td className="px-4 py-3">
        <span
          className={cn(
            'inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold',
            row.vendor === 'natura'
              ? 'bg-primary-wash text-primary-dark'
              : 'bg-pink-50 text-pink-700',
          )}
        >
          {VENDOR_LABELS[row.vendor]?.label ?? row.vendor}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="flex items-center gap-1.5 text-high-emphasis">
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
              <span className="font-mono text-[9px] text-low-emphasis">C{i + 1}</span>
              <div
                className={cn(
                  'h-4 w-4 rounded-full border-2',
                  failed ? 'border-alert bg-alert' : 'border-neutral-100 bg-neutral-75',
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
              ? 'bg-alert-lightest text-alert-dark'
              : row.persistenceCount >= 2
                ? 'bg-warning-lightest text-warning-darkest'
                : 'bg-warning-lightest/50 text-warning-darkest',
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
  /** Overrides the section title — e.g. "Matriz de Erros — Android" on a per-platform breakdown. */
  title?: string;
}

export function ErrorMatrixSection({
  reports,
  title = 'Matriz de Erros',
}: ErrorMatrixSectionProps) {
  const errorMatrix = computeErrorMatrix(reports);
  const topFailures = errorMatrix.filter((row) => row.persistenceCount >= 2).slice(0, 3);

  return (
    <section aria-labelledby="matrix-heading">
      <SectionHeader
        id="matrix-heading"
        eyebrow="Pontos de atenção"
        title={title}
        description={`Checks com falhas nas últimas ${reports.length} execuções — ordenados por persistência`}
      />

      {topFailures.length > 0 && (
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {topFailures.map((row) => {
            const countryInfo = COUNTRY_INFO[row.country as Country];
            return (
              <div
                key={`${row.checkKey}-${row.vendor}-${row.country}`}
                className="rounded-xl border border-alert-lightest bg-alert-lightest/50 p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-alert-dark">
                    Falha persistente
                  </span>
                  <span className="rounded-full bg-alert px-2 py-0.5 text-[10px] font-bold text-white">
                    {row.persistenceCount}/{reports.length} runs
                  </span>
                </div>
                <p className="mt-2 font-semibold text-highlight">{row.checkLabel}</p>
                <p className="mt-0.5 text-xs text-medium-emphasis">
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
              <tr className="border-b border-neutral-75 bg-neutral-50">
                <th
                  scope="col"
                  className="w-48 px-4 py-3 text-left font-semibold text-high-emphasis"
                >
                  Verificação
                </th>
                <th
                  scope="col"
                  className="w-24 px-4 py-3 text-left font-semibold text-high-emphasis"
                >
                  Marca
                </th>
                <th
                  scope="col"
                  className="w-32 px-4 py-3 text-left font-semibold text-high-emphasis"
                >
                  País
                </th>
                <th scope="col" className="px-4 py-3 text-center font-semibold text-high-emphasis">
                  Persistência
                  <span className="ml-1 text-xs font-normal text-low-emphasis">
                    (C1→C{reports.length})
                  </span>
                </th>
                <th
                  scope="col"
                  className="w-20 px-4 py-3 text-center font-semibold text-high-emphasis"
                >
                  Runs
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {errorMatrix.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-low-emphasis">
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
