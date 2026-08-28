import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ReportIndexEntry } from '@/lib/types';

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

interface EvolutionBarProps {
  run: ReportIndexEntry;
  maxPassRate: number;
  isLatest: boolean;
}

function EvolutionBar({ run, maxPassRate, isLatest }: EvolutionBarProps) {
  const passRate =
    run.summary.total > 0 ? Math.round((run.summary.passed / run.summary.total) * 100) : 0;
  const barWidth = maxPassRate > 0 ? (passRate / maxPassRate) * 100 : 0;

  return (
    <div className="flex items-center gap-3">
      <span className="w-12 shrink-0 font-mono text-xs text-gray-400">
        {formatShortDate(run.startTime)}
      </span>
      <div className="h-6 flex-1 overflow-hidden rounded-full bg-gray-100">
        <div
          className={cn(
            'flex h-full items-center justify-end rounded-full pr-2 transition-all',
            passRate >= 70 ? 'bg-emerald-500' : passRate >= 40 ? 'bg-amber-500' : 'bg-red-500',
            isLatest && 'ring-2 ring-indigo-400ring-offset-1',
          )}
          style={{ width: `${Math.max(barWidth, 8)}%` }}
        >
          <span className="text-[10px] font-bold text-white">{passRate}%</span>
        </div>
      </div>
      <div className="flex w-28 shrink-0 items-center justify-end gap-1">
        <span className="text-xs font-medium text-emerald-600">{run.summary.passed}✓</span>
        <span className="text-xs text-gray-300">/</span>
        <span className="text-xs font-medium text-red-500">{run.summary.failed}✗</span>
        {isLatest && (
          <span className="ml-1 rounded bg-indigo-50 px-1 py-0.5 text-[9px] font-bold text-indigo-600">
            atual
          </span>
        )}
      </div>
    </div>
  );
}

interface EvolutionSectionProps {
  evolutionData: ReportIndexEntry[];
}

export function EvolutionSection({ evolutionData }: EvolutionSectionProps) {
  const maxPassRate = Math.max(
    ...evolutionData.map((r) =>
      r.summary.total > 0 ? Math.round((r.summary.passed / r.summary.total) * 100) : 0,
    ),
  );

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
        <div className="space-y-3">
          {evolutionData.map((run, i) => (
            <EvolutionBar
              key={run.runId}
              run={run}
              maxPassRate={maxPassRate}
              isLatest={i === evolutionData.length - 1}
            />
          ))}
        </div>
      </Card>
    </section>
  );
}
