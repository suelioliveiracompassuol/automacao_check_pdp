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
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-48 w-full"
        role="img"
        aria-label="Gráfico de evolução da taxa de aprovação ao longo das execuções"
      >
        <defs>
          <linearGradient id="evolutionAreaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>

        {GRID_LINES.map((g, i) => (
          <g key={`${g}-${i}`}>
            <line
              x1={PADDING_X}
              y1={toY(g)}
              x2={WIDTH - PADDING_X}
              y2={toY(g)}
              stroke="#f1f5f9"
              strokeWidth={1}
            />
            <text x={2} y={toY(g) + 3} fontSize={9} fill="#94a3b8">
              {g}%
            </text>
          </g>
        ))}

        <path d={areaPath} fill="url(#evolutionAreaGradient)" />
        <path d={linePath} fill="none" stroke="#6366f1" strokeWidth={2.5} strokeLinejoin="round" />

        {points.map((p, i) => (
          <circle
            key={`${p.label}-${i}`}
            cx={p.x}
            cy={p.y}
            r={4}
            fill="#ffffff"
            stroke="#6366f1"
            strokeWidth={2}
          />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-gray-400">
        {points.map((p, i) => (
          <span key={`${p.label}-${i}`}>{p.label}</span>
        ))}
      </div>
    </div>
  );
}
