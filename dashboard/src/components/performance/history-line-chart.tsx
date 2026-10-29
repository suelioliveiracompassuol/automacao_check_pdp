'use client';

import { useEffect, useRef, useState } from 'react';
import { formatShortDate } from '@/lib/format';
import { monotonePath, niceScale, spreadLabels } from '@/lib/perf-history';

export interface HistorySeries {
  key: string;
  label: string;
  color: string;
  values: (number | null)[];
}

export interface ReferenceLine {
  value: number;
  label: string;
}

interface HistoryLineChartProps {
  dates: string[];
  series: HistorySeries[];
  formatValue: (value: number) => string;
  formatTick?: (value: number) => string;
  referenceLines?: ReferenceLine[];
  height?: number;
  ariaLabel: string;
  /** Rótulo no fim de cada linha (desligado quando há uma série só: o título já a nomeia). */
  directLabels?: boolean;
}

const PAD = { top: 16, bottom: 28, left: 52, right: 104 };
// Largura mínima por rótulo de data e largura a partir da qual cabem rótulos no fim das linhas.
const X_LABEL_SPACING = 64;
const DIRECT_LABEL_MIN_WIDTH = 480;

/** Gráfico de linhas desenhado à mão (sem biblioteca de gráficos), em coordenadas de pixel
 * medidas com ResizeObserver para círculos e textos não distorcerem. */
export function HistoryLineChart({
  dates,
  series,
  formatValue,
  formatTick = formatValue,
  referenceLines = [],
  height = 300,
  ariaLabel,
  directLabels = true,
}: HistoryLineChartProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(280, Math.round(entry.contentRect.width)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Em telas estreitas os rótulos no fim das linhas espremem o gráfico; a legenda e o
  // tooltip continuam identificando as séries.
  const showDirectLabels = directLabels && width >= DIRECT_LABEL_MIN_WIDTH;
  const padRight = showDirectLabels ? PAD.right : 16;
  const plotW = Math.max(1, width - PAD.left - padRight);
  const plotH = height - PAD.top - PAD.bottom;
  const n = dates.length;

  const allValues = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const refMax = referenceLines.reduce((m, r) => Math.max(m, r.value), 0);
  const { max, ticks } = niceScale(Math.max(refMax, ...allValues, 0));

  const xAt = (i: number) => PAD.left + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2);
  const yAt = (v: number) => PAD.top + plotH - (v / max) * plotH;

  const maxXLabels = Math.max(2, Math.floor(plotW / X_LABEL_SPACING));
  const xLabelStep = Math.max(1, Math.ceil((n - 1) / (maxXLabels - 1)));
  // A última data sempre aparece; a anterior da grade some se ficar perto demais dela.
  const showXLabel = (i: number) =>
    i === n - 1 || (i % xLabelStep === 0 && n - 1 - i >= xLabelStep / 2);

  // Rótulos diretos no último ponto válido de cada série, afastados para não colidirem.
  const lastPoints = series.map((s) => {
    for (let i = s.values.length - 1; i >= 0; i--) {
      const v = s.values[i];
      if (v !== null) {
        return { i, v };
      }
    }
    return null;
  });
  const labelYs = spreadLabels(
    lastPoints.map((p) => (p ? yAt(p.v) : PAD.top)),
    16,
    PAD.top,
    PAD.top + plotH,
  );

  function indexFromClientX(clientX: number) {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect || n === 0) {
      return null;
    }
    const x = clientX - rect.left - PAD.left;
    return Math.min(n - 1, Math.max(0, Math.round((x / plotW) * (n - 1))));
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (n === 0) {
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const delta = e.key === 'ArrowRight' ? 1 : -1;
      setActive((cur) => Math.min(n - 1, Math.max(0, (cur ?? n - 1) + delta)));
    } else if (e.key === 'Escape') {
      setActive(null);
    }
  }

  const tooltipLeft = active !== null ? xAt(active) : 0;
  const tooltipOnLeft = tooltipLeft > width - 200;

  return (
    <div
      ref={wrapperRef}
      className="relative w-full select-none outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
      tabIndex={0}
      role="group"
      aria-label={`${ariaLabel}. Use as setas para percorrer as datas.`}
      onKeyDown={onKeyDown}
      onBlur={() => setActive(null)}
    >
      <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block">
        {/* Grade e eixo Y (recessivos) */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={PAD.left + plotW}
              y1={yAt(t)}
              y2={yAt(t)}
              stroke="var(--color-neutral-75)"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={yAt(t)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-low-emphasis text-[11px] tabular-nums"
            >
              {formatTick(t)}
            </text>
          </g>
        ))}

        {/* Linhas de referência (ex.: Meta 2 do LCP) */}
        {referenceLines.map((r) => (
          <g key={r.label}>
            <line
              x1={PAD.left}
              x2={PAD.left + plotW}
              y1={yAt(r.value)}
              y2={yAt(r.value)}
              stroke="var(--color-medium-emphasis, #666)"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            {/* Contorno na cor da superfície para o texto ficar legível sobre as linhas */}
            <text
              x={PAD.left + 4}
              y={yAt(r.value) - 4}
              stroke="var(--color-surface)"
              strokeWidth={3}
              strokeLinejoin="round"
              paintOrder="stroke"
              className="fill-medium-emphasis text-[10px] font-semibold"
            >
              {r.label}
            </text>
          </g>
        ))}

        {/* Rótulos do eixo X */}
        {dates.map((d, i) =>
          showXLabel(i) ? (
            <text
              key={`${d}-${i}`}
              x={xAt(i)}
              y={height - 8}
              textAnchor="middle"
              className="fill-low-emphasis text-[11px] tabular-nums"
            >
              {formatShortDate(d)}
            </text>
          ) : null,
        )}

        {/* Séries: segmentos separados onde falta medição */}
        {series.map((s) => {
          const segments: { x: number; y: number }[][] = [];
          let current: { x: number; y: number }[] = [];
          s.values.forEach((v, i) => {
            if (v === null) {
              if (current.length) {
                segments.push(current);
              }
              current = [];
            } else {
              current.push({ x: xAt(i), y: yAt(v) });
            }
          });
          if (current.length) {
            segments.push(current);
          }
          return (
            <g key={s.key}>
              {segments.map((seg, k) =>
                seg.length === 1 ? (
                  <circle key={k} cx={seg[0].x} cy={seg[0].y} r={4} fill={s.color} />
                ) : (
                  <path
                    key={k}
                    d={monotonePath(seg)}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                ),
              )}
            </g>
          );
        })}

        {/* Linha-guia e marcadores da data em foco */}
        {active !== null && (
          <g>
            <line
              x1={xAt(active)}
              x2={xAt(active)}
              y1={PAD.top}
              y2={PAD.top + plotH}
              stroke="var(--color-neutral-300, #999)"
              strokeWidth={1}
            />
            {series.map((s) => {
              const v = s.values[active];
              return v === null ? null : (
                <circle
                  key={s.key}
                  cx={xAt(active)}
                  cy={yAt(v)}
                  r={5}
                  fill={s.color}
                  stroke="var(--color-surface)"
                  strokeWidth={2}
                />
              );
            })}
          </g>
        )}

        {/* Área de captura do ponteiro (maior que as linhas) */}
        <rect
          x={PAD.left}
          y={PAD.top}
          width={plotW}
          height={plotH}
          fill="transparent"
          onPointerMove={(e) => setActive(indexFromClientX(e.clientX))}
          onPointerLeave={() => setActive(null)}
        />
      </svg>

      {/* Rótulos diretos em HTML (texto na cor de tinta, marcador com a cor da série) */}
      {showDirectLabels &&
        series.map((s, k) =>
          lastPoints[k] ? (
            <span
              key={s.key}
              aria-hidden="true"
              className="pointer-events-none absolute flex -translate-y-1/2 items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-high-emphasis"
              style={{ left: PAD.left + plotW + 8, top: labelYs[k] }}
            >
              <span className="h-0.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ) : null,
        )}

      {/* Tooltip */}
      {active !== null && (
        <div
          role="status"
          className="pointer-events-none absolute top-2 z-10 min-w-40 rounded-lg border border-neutral-75 bg-surface px-3 py-2 text-xs shadow-tiny"
          style={tooltipOnLeft ? { right: width - tooltipLeft + 12 } : { left: tooltipLeft + 12 }}
        >
          <p className="mb-1 font-bold text-highlight">{formatShortDate(dates[active])}</p>
          <ul className="space-y-0.5">
            {series.map((s) => {
              const v = s.values[active];
              return (
                <li key={s.key} className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5 text-medium-emphasis">
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    {s.label}
                  </span>
                  <span className="font-semibold tabular-nums text-high-emphasis">
                    {v === null ? '—' : formatValue(v)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
