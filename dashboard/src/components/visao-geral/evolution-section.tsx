import { Card, SectionHeader } from '@/components/ui/card';
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
        'grid grid-cols-[3.5rem_1fr_5.5rem_3rem] items-center gap-2 rounded-full px-3 py-1.5 text-sm',
        isLatest && 'bg-primary-wash',
      )}
    >
      <span className="font-mono text-xs text-low-emphasis">{formatShortDate(run?.startTime)}</span>
      <span
        className={cn(
          'font-semibold',
          passRate >= 70
            ? 'text-success-dark'
            : passRate >= 40
              ? 'text-warning-darkest'
              : 'text-alert',
        )}
      >
        {passRate}%
      </span>
      <span className="text-right text-xs text-medium-emphasis">
        <span className="font-medium text-success-dark">{run.summary.passed}✓</span>
        {' / '}
        <span className="font-medium text-alert">{run.summary.failed}✗</span>
      </span>
      <span>
        {isLatest && (
          <span className="rounded bg-primary-lightest px-1.5 py-0.5 text-[9px] font-bold text-primary-dark">
            atual
          </span>
        )}
      </span>
    </div>
  );
}

interface EvolutionSectionProps {
  evolutionData: ReportIndexEntry[];
  /** Overrides the section title — e.g. "Evolução — Android" on a per-platform breakdown. */
  title?: string;
}

export function EvolutionSection({
  evolutionData,
  title = 'Evolução Histórica',
}: EvolutionSectionProps) {
  const chartData = evolutionData.map((run) => ({
    label: formatShortDate(run?.startTime),
    passRate:
      run.summary.total > 0 ? Math.round((run.summary.passed / run.summary.total) * 100) : 0,
  }));

  return (
    <section aria-labelledby="evolution-heading">
      <SectionHeader
        id="evolution-heading"
        eyebrow="Tendência"
        title={title}
        description={`Taxa de aprovação nas últimas ${evolutionData.length} execuções`}
      />
      <div className="grid gap-4 @4xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="flex flex-col justify-center">
          <EvolutionChart data={chartData} />
        </Card>
        <Card className="p-3">
          <div className="grid grid-cols-[3.5rem_1fr_5.5rem_3rem] gap-2 px-3 pt-1 pb-2 text-[10px] font-bold tracking-widest text-low-emphasis uppercase">
            <span>Data</span>
            <span>Taxa</span>
            <span className="text-right">✓ / ✗</span>
            <span />
          </div>
          <div className="space-y-0.5">
            {[...evolutionData].reverse().map((run, i) => (
              <EvolutionRow key={`run-${run.runId}-${i}`} run={run} isLatest={i === 0} />
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}
