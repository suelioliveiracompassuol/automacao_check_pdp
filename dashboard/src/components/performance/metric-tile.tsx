import {
  type PerfMetricKey,
  PERF_METRICS,
  classifyMetric,
  formatMetric,
  ratingLabel,
  ratingTone,
} from '@/lib/perf-thresholds';
import { formatDecimal, formatMs } from '@/lib/format';
import { cn } from '@/lib/utils';

interface MetricTileProps {
  metricKey: PerfMetricKey;
  value: number | null;
  previousValue?: number | null;
  className?: string;
}

function formatDelta(key: PerfMetricKey, diff: number): string {
  const abs = Math.abs(diff);
  switch (PERF_METRICS[key].unit) {
    case 'ms':
      return formatMs(abs);
    case 'unitless':
      return formatDecimal(abs, 2);
    default:
      return String(Math.round(abs));
  }
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

  const tone = ratingTone(rating);

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
          className={cn('inline-block h-2 w-2 rounded-full shrink-0', tone.dot)}
        />
        <span className={tone.text}>{ratingLabel(metricKey, rating)}</span>
      </div>
    </div>
  );
}
