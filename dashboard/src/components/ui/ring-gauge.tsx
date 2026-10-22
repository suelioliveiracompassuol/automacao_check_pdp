import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface RingGaugeProps {
  /** Preenchimento de 0 a 100; null desenha só o trilho. */
  percent: number | null;
  size: number;
  strokeWidth: number;
  /** Cor do arco (aceita `var(--color-*)`). */
  color: string;
  /** Rótulo acessível; sem ele o anel é decorativo (o texto ao redor já informa o valor). */
  label?: string;
  className?: string;
  /** Conteúdo centralizado sobre o anel (ex.: o número do score). */
  children?: ReactNode;
}

/** Anel de progresso SVG compartilhado (taxa de aprovação, score do Lighthouse). */
export function RingGauge({
  percent,
  size,
  strokeWidth,
  color,
  label,
  className,
  children,
}: RingGaugeProps) {
  const center = size / 2;
  const radius = center - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const clamped = percent === null ? 0 : Math.max(0, Math.min(100, percent));

  return (
    <div
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--color-neutral-75)"
          strokeWidth={strokeWidth}
        />
        {percent !== null && (
          <circle
            data-testid="ring-arc"
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - clamped / 100)}
            className="ring-gauge-arc"
            style={{ '--ring-circumference': circumference } as CSSProperties}
          />
        )}
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center text-center">
          {children}
        </div>
      )}
    </div>
  );
}
