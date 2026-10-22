import { RingGauge } from '@/components/ui/ring-gauge';
import { classifyMetric, RATING_LABEL, ratingTone } from '@/lib/perf-thresholds';
import { cn } from '@/lib/utils';

interface ScoreRingProps {
  score: number | null;
  size?: 'md' | 'lg';
  className?: string;
}

const SIZES = {
  md: { dimension: 72, strokeWidth: 6, text: 'text-xl' },
  lg: { dimension: 96, strokeWidth: 8, text: 'text-3xl' },
};

export function ScoreRing({ score, size = 'md', className }: ScoreRingProps) {
  const rating = classifyMetric('performanceScore', score);
  const tone = ratingTone(rating);
  const { dimension, strokeWidth, text } = SIZES[size];

  const label =
    score !== null
      ? `Score de performance: ${score} de 100 (${rating ? RATING_LABEL[rating] : 'Sem dados'})`
      : 'Score de performance: sem dados';

  return (
    <RingGauge
      percent={score}
      size={dimension}
      strokeWidth={strokeWidth}
      color={tone.stroke}
      label={label}
      className={className}
    >
      <span className={cn('font-bold leading-none tabular-nums', text, tone.text)}>
        {score !== null ? Math.round(score) : '—'}
      </span>
    </RingGauge>
  );
}
