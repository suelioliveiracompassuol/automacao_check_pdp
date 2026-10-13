import {
  type PerfMetricKey,
  PERF_METRICS,
  classifyMetric,
  formatMetric,
  ratingLabel,
} from '@/lib/perf-thresholds';
import { cn } from '@/lib/utils';

interface MetricTileProps {
  metricKey: PerfMetricKey;
  value: number | null;
  previousValue?: number | null;
  className?: string;
}

function formatDelta(key: PerfMetricKey, diff: number): string {
  const abs = Math.abs(diff);
  const def = PERF_METRICS[key];
  if (def.unit === 'ms') {
    if (abs < 1000) {
      return `${Math.round(abs)} ms`;
    }
    return `${(abs / 1000).toFixed(2).replace('.', ',')} s`;
  }
  if (def.unit === 'unitless') {
    return abs.toFixed(2).replace('.', ',');
  }
  return String(Math.round(abs));
}

export function MetricTile({ metricKey, value, previousValue, className }: MetricTileProps) {
  const def = PERF_METRICS[metricKey];
  const rating = classifyMetric(metricKey, value);
  const formattedValue = formatMetric(metricKey, value);

  let deltaNode = null;
  if (value !== null && previousValue !== null && previousValue !== undefined) {
    const diff = value - previousValue;
    if (diff !== 0) {
      const isImprovement = def.higherIsBetter ? diff > 0 : diff < 0;
      const arrow = diff > 0 ? '▲' : '▼';
      const deltaText = `${arrow} ${formatDelta(metricKey, diff)}`;
      deltaNode = (
        <span
          className={cn(
            'text-xs font-semibold tabular-nums',
            isImprovement ? 'text-success-dark' : 'text-alert-dark',
          )}
          title={`Variação em relação à medição anterior (${isImprovement ? 'melhorou' : 'piorou'})`}
        >
          {deltaText}
        </span>
      );
    }
  }

  const dotColor =
    rating === 'good'
      ? 'bg-success'
      : rating === 'needs-improvement'
        ? 'bg-warning'
        : rating === 'poor'
          ? 'bg-alert'
          : 'bg-neutral-300';

  const ratingTextColor =
    rating === 'good'
      ? 'text-success-dark'
      : rating === 'needs-improvement'
        ? 'text-warning-darkest'
        : rating === 'poor'
          ? 'text-alert-dark'
          : 'text-low-emphasis';

  return (
    <div
      title={def.description}
      className={cn(
        'flex flex-col justify-between rounded-lg border border-neutral-75 bg-surface p-3 transition-colors',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-bold text-medium-emphasis">{def.shortLabel}</span>
        {deltaNode}
      </div>

      <div className="my-1">
        <span className="text-lg font-bold tracking-tight text-highlight tabular-nums">
          {formattedValue}
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-xs font-medium">
        <span
          aria-hidden="true"
          className={cn('inline-block h-2 w-2 rounded-full shrink-0', dotColor)}
        />
        <span className={ratingTextColor}>{ratingLabel(metricKey, rating)}</span>
      </div>
    </div>
  );
}
