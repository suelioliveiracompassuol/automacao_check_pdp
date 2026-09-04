import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ReportIndexEntry } from '@/lib/types';
import { EvolutionChart } from './evolution-chart';

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

interface EvolutionRowProps {
  run: ReportIndexEntry;
  isLatest: boolean;
}

function EvolutionRow({ run, isLatest }: EvolutionRowProps) {
  const passRate =
    run.summary.total > 0 ? Math.round((run.summary.passed / run.summary.total) * 100) : 0;

  return (
    <div
      className={cn(
        'grid grid-cols-[3.5rem_1fr_5.5rem_3rem] items-center gap-2 rounded-lg px-3 py-2 text-sm',
        isLatest && 'bg-indigo-50',
      )}
    >
      <span className="font-mono text-xs text-gray-400">{formatShortDate(run?.startTime)}</span>
      <span
        className={cn(
          'font-semibold',
          passRate >= 70 ? 'text-emerald-600' : passRate >= 40 ? 'text-amber-600' : 'text-red-500',
        )}
      >
        {passRate}%
      </span>
      <span className="text-right text-xs text-gray-500">
        <span className="font-medium text-emerald-600">{run.summary.passed}✓</span>
        {' / '}
        <span className="font-medium text-red-500">{run.summary.failed}✗</span>
      </span>
      <span>
        {isLatest && (
          <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[9px] font-bold text-indigo-600">
            atual
          </span>
        )}
      </span>
    </div>
  );
}

interface EvolutionSectionProps {
  evolutionData: ReportIndexEntry[];
}

export function EvolutionSection({ evolutionData }: EvolutionSectionProps) {
  const chartData = evolutionData.map((run) => ({
    label: formatShortDate(run?.startTime),
    passRate:
      run.summary.total > 0 ? Math.round((run.summary.passed / run.summary.total) * 100) : 0,
  }));

  return (
    <section aria-labelledby="evolution-heading">
      <div className="mb-6">
        <h2 id="evolution-heading" className="text-2xl font-bold text-gray-900">
          Evolução Histórica
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Taxa de aprovação nas últimas {evolutionData.length} execuções
        </p>
      </div>
      <Card>
        <EvolutionChart data={chartData} />
        <div className="mt-4 space-y-1 border-t border-gray-100 pt-4">
          {evolutionData.map((run, i) => (
            <EvolutionRow
              key={`run-${run.runId}-${i}`}
              run={run}
              isLatest={i === evolutionData.length - 1}
            />
          ))}
        </div>
      </Card>
    </section>
  );
}
