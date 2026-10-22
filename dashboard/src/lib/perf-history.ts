import { PAGE_TYPE_LABEL } from './perf-thresholds';
import type { PerfIndexEntry, PerfMetrics, PerfPageType } from './types';

/** Métricas de tempo do gráfico principal (mesmas colunas da planilha do WebPageTest). */
export type HistoryMetricKey = 'lcp' | 'startRender' | 'speedIndex' | 'tbt';

export const HISTORY_METRICS: { key: HistoryMetricKey; label: string; color: string }[] = [
  // Ordem fixa da paleta categórica validada (azul, laranja, água, amarelo); a cor segue a
  // métrica, nunca a posição, então esconder uma série não repinta as outras.
  { key: 'lcp', label: 'LCP', color: '#2a78d6' },
  { key: 'startRender', label: 'Start Render', color: '#eb6834' },
  { key: 'speedIndex', label: 'Speed Index', color: '#1baf7a' },
  { key: 'tbt', label: 'TBT', color: '#eda100' },
];

export interface PageTypeGroup {
  /** pageType quando existe; senão o código do SKU (rodadas antigas). */
  key: string;
  label: string;
  sku: string;
}

export interface HistoryPoint {
  date: string;
  metrics: PerfMetrics | null;
}

/** Um grupo por tipo de PDP (Full antes de Low), na ordem em que aparecem nas rodadas. */
export function getPageTypeGroups(runs: PerfIndexEntry[]): PageTypeGroup[] {
  const groups = new Map<string, PageTypeGroup>();
  for (const run of runs) {
    for (const s of run.skus) {
      const key = s.pageType ?? s.sku;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label: s.pageType ? PAGE_TYPE_LABEL[s.pageType as PerfPageType] : s.sku,
          sku: s.sku,
        });
      }
    }
  }
  const order = (k: string) => (k === 'PDPFull' ? 0 : k === 'PDPLow' ? 1 : 2);
  return [...groups.values()].sort((a, b) => order(a.key) - order(b.key));
}

/** Rodadas dos últimos `days` dias de calendário, contados a partir da medição mais recente
 * (não do número de rodadas), para disparos manuais não encurtarem a janela. */
export function runsWithinDays<T extends { timestamp: string }>(runs: T[], days: number): T[] {
  const latest = runs.reduce((max, r) => Math.max(max, Date.parse(r.timestamp) || 0), 0);
  const cutoff = latest - days * 86_400_000;
  return runs.filter((r) => (Date.parse(r.timestamp) || 0) > cutoff);
}

/** Pontos em ordem cronológica de um grupo, só das rodadas dentro do período (ver runsWithinDays). */
export function buildHistory(
  runs: PerfIndexEntry[],
  groupKey: string,
  periodDays: number,
): HistoryPoint[] {
  return runsWithinDays(runs, periodDays)
    .map((r) => {
      const item = r.skus.find((s) => (s.pageType ?? s.sku) === groupKey);
      return {
        date: r.timestamp,
        metrics: item && item.success ? item.metrics : null,
      };
    })
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

export function metricValue(
  metrics: PerfMetrics | null,
  key: HistoryMetricKey | 'totalByteWeight',
): number | null {
  const value = metrics?.[key];
  return typeof value === 'number' ? value : null;
}

/** Último valor e variação percentual em relação ao ponto válido anterior. */
export function latestWithChange(
  points: HistoryPoint[],
  key: HistoryMetricKey | 'totalByteWeight',
): { value: number | null; changePct: number | null } {
  const values = points.map((p) => metricValue(p.metrics, key)).filter((v) => v !== null);
  const value = values.at(-1) ?? null;
  const previous = values.at(-2) ?? null;
  if (value === null || previous === null || previous === 0) {
    return { value, changePct: null };
  }
  return { value, changePct: ((value - previous) / previous) * 100 };
}

/** Escala "redonda" para o eixo Y: devolve o topo e os ticks (0 incluso). */
export function niceScale(maxValue: number, tickCount = 5): { max: number; ticks: number[] } {
  if (!(maxValue > 0)) {
    return { max: 1, ticks: [0, 1] };
  }
  const rawStep = maxValue / tickCount;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rawStep) ?? rawStep;
  const max = Math.ceil(maxValue / step) * step;
  const ticks: number[] = [];
  for (let t = 0; t <= max + step / 2; t += step) {
    ticks.push(Number(t.toFixed(6)));
  }
  return { max, ticks };
}

/**
 * Caminho SVG suave (monotone cubic, Fritsch–Carlson): a curva nunca passa acima ou abaixo
 * dos pontos medidos, ao contrário de splines comuns que inventam picos e vales.
 */
export function monotonePath(points: { x: number; y: number }[]): string {
  const n = points.length;
  if (n === 0) return '';
  if (n === 1) return `M ${points[0].x} ${points[0].y}`;
  if (n === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1].x - points[i].x);
    slope.push(dx[i] === 0 ? 0 : (points[i + 1].y - points[i].y) / dx[i]);
  }
  const tangent: number[] = [slope[0]];
  for (let i = 1; i < n - 1; i++) {
    tangent.push(slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2);
  }
  tangent.push(slope[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      tangent[i] = 0;
      tangent[i + 1] = 0;
      continue;
    }
    const a = tangent[i] / slope[i];
    const b = tangent[i + 1] / slope[i];
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      tangent[i] = t * a * slope[i];
      tangent[i + 1] = t * b * slope[i];
    }
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const c = dx[i] / 3;
    d += ` C ${p0.x + c} ${p0.y + c * tangent[i]} ${p1.x - c} ${p1.y - c * tangent[i + 1]} ${p1.x} ${p1.y}`;
  }
  return d;
}

/** Afasta rótulos verticais que colidiriam (mantém a ordem, distância mínima em px). */
export function spreadLabels(ys: number[], minGap: number, top: number, bottom: number): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  const placed = order.map((o) => o.y);
  for (let k = 1; k < placed.length; k++) {
    placed[k] = Math.max(placed[k], placed[k - 1] + minGap);
  }
  const overflow = placed.length ? placed[placed.length - 1] - bottom : 0;
  if (overflow > 0) {
    for (let k = placed.length - 1; k >= 0; k--) {
      placed[k] = Math.max(top, placed[k] - overflow);
      if (k > 0) placed[k - 1] = Math.min(placed[k - 1], placed[k] - minGap);
    }
  }
  const result = new Array<number>(ys.length);
  order.forEach((o, k) => {
    result[o.i] = placed[k];
  });
  return result;
}
