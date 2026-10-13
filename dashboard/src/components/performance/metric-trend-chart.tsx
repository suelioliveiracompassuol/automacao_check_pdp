import { type PerfMetricKey, PERF_METRICS, formatMetric } from '@/lib/perf-thresholds';
import { cn } from '@/lib/utils';

export interface TrendPoint {
  date: string;
  value: number | null;
}

export interface TrendSeries {
  label: string;
  points: TrendPoint[];
}

export interface MetricTrendChartProps {
  metricKey: PerfMetricKey;
  series: TrendSeries[];
  className?: string;
}

const WIDTH = 600;
const HEIGHT = 200;
const PADDING_X = 28;
const PADDING_Y = 20;

function formatAxisDate(isoOrDate: string): string {
  const d = new Date(isoOrDate);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      timeZone: 'America/Sao_Paulo',
    });
  }
  return isoOrDate.slice(0, 5);
}

function describeTrend(metricKey: PerfMetricKey, series: TrendSeries[]): string {
  const def = PERF_METRICS[metricKey];
  if (!series || series.length === 0) {
    return `Tendência de ${def.label}: sem dados disponíveis.`;
  }

  const descriptions = series.map((s) => {
    const valid = s.points.filter((p): p is { date: string; value: number } => p.value !== null);
    if (valid.length === 0) {
      return `${s.label}: sem dados registrados.`;
    }
    const last = valid[valid.length - 1];
    const current = `${s.label}: valor atual ${formatMetric(metricKey, last.value)}.`;
    if (valid.length < 2) {
      return current;
    }
    const first = valid[0];
    const diff = last.value - first.value;
    if (diff === 0) {
      return `${current} Desempenho estável desde ${formatAxisDate(first.date)}.`;
    }
    const isImprovement = def.higherIsBetter ? diff > 0 : diff < 0;
    const trendText = isImprovement ? 'melhora' : 'piora';
    return `${current} Registrou ${trendText} desde ${formatAxisDate(first.date)} (${formatMetric(metricKey, first.value)}).`;
  });

  return `Tendência de ${def.label}. ${descriptions.join(' ')}`;
}

export function MetricTrendChart({ metricKey, series, className }: MetricTrendChartProps) {
  const def = PERF_METRICS[metricKey];

  const usableWidth = WIDTH - PADDING_X * 2;
  const usableHeight = HEIGHT - PADDING_Y * 2;

  // Cálculo dos limites do eixo Y
  let minY = 0;
  let maxY = 100;

  if (def.unit === 'score') {
    minY = 0;
    maxY = 100;
  } else {
    const allValues = series.flatMap((s) =>
      s.points.map((p) => p.value).filter((v): v is number => v !== null && !isNaN(v)),
    );
    const maxVal = allValues.length > 0 ? Math.max(...allValues) : def.poor;
    maxY = Math.max(maxVal * 1.1, def.poor * 1.1);
    if (maxY <= 0) {
      maxY = 1;
    }
  }

  const toY = (val: number) => {
    const clamped = Math.max(minY, Math.min(maxY, val));
    return PADDING_Y + usableHeight - ((clamped - minY) / (maxY - minY)) * usableHeight;
  };

  // Coleta todas as datas distintas do eixo X a partir das séries
  const allDates: string[] = [];
  const maxLen = Math.max(0, ...series.map((s) => s.points.length));
  for (let i = 0; i < maxLen; i++) {
    const date = series.find((s) => s.points[i]?.date)?.points[i]?.date;
    if (date) {
      allDates.push(date);
    }
  }

  const totalPoints = allDates.length;
  const stepX = totalPoints > 1 ? usableWidth / (totalPoints - 1) : 0;

  // Índices visíveis no eixo X (máximo ~7)
  const maxLabels = 7;
  const labelIndices = new Set<number>();
  if (totalPoints <= maxLabels) {
    for (let i = 0; i < totalPoints; i++) {
      labelIndices.add(i);
    }
  } else {
    for (let i = 0; i < maxLabels; i++) {
      labelIndices.add(Math.round((i * (totalPoints - 1)) / (maxLabels - 1)));
    }
  }

  // Faixas de rating de fundo
  let greenRect: { y: number; height: number };
  let yellowRect: { y: number; height: number };
  let redRect: { y: number; height: number };

  if (def.higherIsBetter) {
    // Score: 0..poor (red), poor..good (yellow), good..100 (green)
    const y0 = toY(0);
    const yPoor = toY(def.poor);
    const yGood = toY(def.good);
    const y100 = toY(100);

    redRect = { y: yPoor, height: Math.max(0, y0 - yPoor) };
    yellowRect = { y: yGood, height: Math.max(0, yPoor - yGood) };
    greenRect = { y: y100, height: Math.max(0, yGood - y100) };
  } else {
    // Menor é melhor: 0..good (green), good..poor (yellow), poor..maxY (red)
    const y0 = toY(0);
    const yGood = toY(def.good);
    const yPoor = toY(def.poor);
    const yMax = toY(maxY);

    greenRect = { y: yGood, height: Math.max(0, y0 - yGood) };
    yellowRect = { y: yPoor, height: Math.max(0, yGood - yPoor) };
    redRect = { y: yMax, height: Math.max(0, yPoor - yMax) };
  }

  // Linhas de grade e valores do eixo Y
  const gridValues = def.higherIsBetter
    ? [0, 50, 90, 100]
    : [0, def.good, def.poor, Math.round(maxY)];

  const seriesColors = [
    {
      stroke: 'var(--color-primary-dark)',
      fill: 'var(--color-primary-lightest)',
    },
    {
      stroke: 'var(--color-secondary-dark)',
      fill: 'var(--color-secondary-lightest)',
    },
  ];

  return (
    <div className={cn('w-full', className)}>
      {/* Legenda em HTML */}
      {series.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center justify-end gap-4 text-xs font-medium">
          {series.map((s, idx) => (
            <div key={s.label} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{
                  backgroundColor: seriesColors[idx % seriesColors.length].stroke,
                }}
              />
              <span className="text-medium-emphasis">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="relative">
        {/* Rótulos do eixo Y em HTML */}
        {gridValues.map((val) => (
          <span
            key={val}
            aria-hidden="true"
            className="absolute left-0 -translate-y-1/2 text-[10px] leading-none text-low-emphasis tabular-nums"
            style={{ top: `${(toY(val) / HEIGHT) * 100}%` }}
          >
            {formatMetric(metricKey, val)}
          </span>
        ))}

        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="h-48 w-full"
          role="img"
          aria-label={describeTrend(metricKey, series)}
        >
          {/* Faixas de fundo */}
          {greenRect.height > 0 && (
            <rect
              x={PADDING_X}
              y={greenRect.y}
              width={usableWidth}
              height={greenRect.height}
              fill="var(--color-success-lightest)"
              fillOpacity={0.3}
            />
          )}
          {yellowRect.height > 0 && (
            <rect
              x={PADDING_X}
              y={yellowRect.y}
              width={usableWidth}
              height={yellowRect.height}
              fill="var(--color-warning-lightest)"
              fillOpacity={0.3}
            />
          )}
          {redRect.height > 0 && (
            <rect
              x={PADDING_X}
              y={redRect.y}
              width={usableWidth}
              height={redRect.height}
              fill="var(--color-alert-lightest)"
              fillOpacity={0.25}
            />
          )}

          {/* Linhas de grade horizontais */}
          {gridValues.map((val) => (
            <line
              key={val}
              x1={PADDING_X}
              y1={toY(val)}
              x2={WIDTH - PADDING_X}
              y2={toY(val)}
              stroke="var(--color-neutral-100)"
              strokeWidth={1}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* Renderização das séries */}
          {series.map((s, seriesIdx) => {
            const color = seriesColors[seriesIdx % seriesColors.length];
            const pts = s.points.map((p, i) => ({
              ...p,
              x: PADDING_X + i * stepX,
              y: p.value !== null ? toY(p.value) : null,
            }));

            // Quebra linhas nos pontos null
            const paths: string[] = [];
            let currentPath = '';

            for (const pt of pts) {
              if (pt.y === null) {
                if (currentPath) {
                  paths.push(currentPath);
                  currentPath = '';
                }
              } else {
                if (!currentPath) {
                  currentPath = `M ${pt.x} ${pt.y}`;
                } else {
                  currentPath += ` L ${pt.x} ${pt.y}`;
                }
              }
            }
            if (currentPath) {
              paths.push(currentPath);
            }

            return (
              <g key={s.label}>
                {paths.map((p, pathIdx) => (
                  <path
                    key={pathIdx}
                    d={p}
                    fill="none"
                    stroke={color.stroke}
                    strokeWidth={2.5}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}

                {pts.map((pt, ptIdx) => {
                  if (pt.y === null) {
                    return null;
                  }
                  return (
                    <circle
                      key={ptIdx}
                      cx={pt.x}
                      cy={pt.y}
                      r={3.5}
                      fill="var(--color-surface)"
                      stroke={color.stroke}
                      strokeWidth={2}
                    >
                      <title>{`${s.label} (${formatAxisDate(pt.date)}): ${formatMetric(metricKey, pt.value)}`}</title>
                    </circle>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Rótulos do eixo X em HTML */}
      {totalPoints > 0 && (
        <div
          aria-hidden="true"
          className="relative mt-1 h-4 pl-7 text-[10px] text-low-emphasis tabular-nums"
        >
          {allDates.map((date, idx) => {
            if (!labelIndices.has(idx)) {
              return null;
            }

            return (
              <span
                key={`${date}-${idx}`}
                className="absolute -translate-x-1/2 whitespace-nowrap"
                style={{
                  left: `calc(${PADDING_X}px + ${idx * stepX}px)`,
                }}
              >
                {formatAxisDate(date)}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
