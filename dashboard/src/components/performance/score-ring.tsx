import { classifyMetric, RATING_LABEL } from '@/lib/perf-thresholds';
import { cn } from '@/lib/utils';

interface ScoreRingProps {
  score: number | null;
  size?: 'md' | 'lg';
  className?: string;
}

export function ScoreRing({ score, size = 'md', className }: ScoreRingProps) {
  const rating = classifyMetric('performanceScore', score);

  const dimension = size === 'lg' ? 96 : 72;
  const strokeWidth = size === 'lg' ? 8 : 6;
  const center = dimension / 2;
  const radius = center - strokeWidth;
  const circumference = 2 * Math.PI * radius;

  const validScore = score !== null ? Math.max(0, Math.min(100, score)) : 0;
  const strokeDashoffset = circumference * (1 - validScore / 100);

  const ratingLabel = rating ? RATING_LABEL[rating] : 'Sem dados';
  const ariaLabel =
    score !== null
      ? `Score de performance: ${score} de 100 (${ratingLabel})`
      : 'Score de performance: sem dados';

  const strokeColor =
    rating === 'good'
      ? 'var(--color-success)'
      : rating === 'needs-improvement'
        ? 'var(--color-warning)'
        : rating === 'poor'
          ? 'var(--color-alert)'
          : 'var(--color-neutral-200)';

  const textColor =
    rating === 'good'
      ? 'text-success-dark'
      : rating === 'needs-improvement'
        ? 'text-warning-dark'
        : rating === 'poor'
          ? 'text-alert-dark'
          : 'text-low-emphasis';

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: dimension, height: dimension }}
    >
      <svg width={dimension} height={dimension} className="rotate-[-90deg]">
        {/* Círculo de fundo */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--color-neutral-75)"
          strokeWidth={strokeWidth}
        />
        {/* Arco de progresso */}
        {score !== null && (
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-500 ease-out"
          />
        )}
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span
          className={cn(
            'font-bold leading-none tabular-nums',
            size === 'lg' ? 'text-3xl' : 'text-xl',
            textColor,
          )}
        >
          {score !== null ? Math.round(score) : '—'}
        </span>
      </div>
    </div>
  );
}
