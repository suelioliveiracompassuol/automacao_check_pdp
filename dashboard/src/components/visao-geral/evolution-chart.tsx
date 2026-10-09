interface EvolutionChartPoint {
  label: string;
  passRate: number;
}

interface EvolutionChartProps {
  data: EvolutionChartPoint[];
}

const WIDTH = 600;
const HEIGHT = 200;
const PADDING_X = 28;
const PADDING_Y = 20;
const GRID_LINES = [0, 25, 50, 75, 100];

function describeTrend(data: EvolutionChartPoint[]): string {
  const first = data[0];
  const last = data[data.length - 1];
  const current = `Taxa de aprovação atual: ${last.passRate}% (${last.label}).`;
  if (data.length < 2) return current;
  const diff = last.passRate - first.passRate;
  const trend =
    diff === 0
      ? 'estável'
      : diff > 0
        ? `alta de ${diff} pontos percentuais`
        : `queda de ${Math.abs(diff)} pontos percentuais`;
  return `${current} Nas últimas ${data.length} execuções, ${trend} desde ${first.label} (${first.passRate}%).`;
}

/** Lightweight hand-rolled SVG line chart — avoids pulling in a charting library for one sparkline-like view. */
export function EvolutionChart({ data }: EvolutionChartProps) {
  if (data.length === 0) {
    return null;
  }

  const usableWidth = WIDTH - PADDING_X * 2;
  const usableHeight = HEIGHT - PADDING_Y * 2;
  const stepX = data.length > 1 ? usableWidth / (data.length - 1) : 0;

  const toY = (passRate: number) => PADDING_Y + usableHeight - (passRate / 100) * usableHeight;

  const points = data.map((d, i) => ({ ...d, x: PADDING_X + i * stepX, y: toY(d.passRate) }));
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const baseline = PADDING_Y + usableHeight;
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`;

  return (
    <div className="w-full">
      <div className="relative">
        {/* Axis labels live in HTML: the SVG stretches non-uniformly (preserveAspectRatio="none"),
            which would distort SVG text. */}
        {GRID_LINES.map((g) => (
          <span
            key={g}
            aria-hidden="true"
            className="absolute left-0 -translate-y-1/2 text-[11px] leading-none text-low-emphasis tabular-nums"
            style={{ top: `${(toY(g) / HEIGHT) * 100}%` }}
          >
            {g}%
          </span>
        ))}
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="h-48 w-full"
          role="img"
          aria-label={describeTrend(data)}
        >
          <defs>
            <linearGradient id="evolutionAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: 'var(--color-primary)', stopOpacity: 0.25 }} />
              <stop offset="100%" style={{ stopColor: 'var(--color-primary)', stopOpacity: 0 }} />
            </linearGradient>
          </defs>

          {GRID_LINES.map((g) => (
            <line
              key={g}
              x1={PADDING_X + 8}
              y1={toY(g)}
              x2={WIDTH - PADDING_X}
              y2={toY(g)}
              style={{ stroke: 'var(--color-neutral-75)' }}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          <path d={areaPath} fill="url(#evolutionAreaGradient)" />
          <path
            d={linePath}
            fill="none"
            style={{ stroke: 'var(--color-primary-dark)' }}
            strokeWidth={2.5}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          {points.map((p, i) => (
            <circle
              key={`${p.label}-${i}`}
              cx={p.x}
              cy={p.y}
              r={4}
              style={{ fill: 'var(--color-surface)', stroke: 'var(--color-primary-dark)' }}
              strokeWidth={2}
            >
              <title>{`${p.label}: ${p.passRate}%`}</title>
            </circle>
          ))}
        </svg>
      </div>
      <div
        aria-hidden="true"
        className="mt-1 flex justify-between pl-7 text-[11px] text-low-emphasis tabular-nums"
      >
        {points.map((p, i) => (
          <span key={`${p.label}-${i}`}>{p.label}</span>
        ))}
      </div>
    </div>
  );
}
