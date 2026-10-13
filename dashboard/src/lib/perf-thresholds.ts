import type { PerfPageType } from './types';

export type PerfMetricKey =
  'performanceScore' | 'lcp' | 'cls' | 'tbt' | 'fcp' | 'speedIndex' | 'ttfb';

export type MetricRating = 'good' | 'needs-improvement' | 'poor';

export interface PerfMetricDefinition {
  label: string;
  shortLabel: string;
  description: string;
  good: number;
  poor: number;
  higherIsBetter: boolean;
  unit: 'ms' | 'score' | 'unitless';
  /** Quando true, o valor exatamente igual a `good` já não é "good" (limite estrito). */
  goodExclusive?: boolean;
  /** Rótulos próprios da métrica (ex.: meta da empresa); senão usa RATING_LABEL. */
  ratingLabels?: Record<MetricRating, string>;
}

export const PERF_METRICS: Record<PerfMetricKey, PerfMetricDefinition> = {
  performanceScore: {
    label: 'Score de Performance',
    shortLabel: 'Score',
    description: 'Pontuação geral de performance calculada pelo Lighthouse (0 a 100)',
    good: 90,
    poor: 50,
    higherIsBetter: true,
    unit: 'score',
  },
  // Meta 2 da empresa para LCP: Supera < 3 s, Atende 3 a 4 s, Abaixo > 4 s
  // (substitui o limite de 2,5 s do Google).
  lcp: {
    label: 'Largest Contentful Paint',
    shortLabel: 'LCP',
    description:
      'Tempo até o maior elemento visível aparecer na tela. Meta 2: Supera < 3 s, Atende 3 a 4 s, Abaixo > 4 s',
    good: 3000,
    poor: 4000,
    higherIsBetter: false,
    unit: 'ms',
    goodExclusive: true,
    ratingLabels: { good: 'Supera', 'needs-improvement': 'Atende', poor: 'Abaixo' },
  },
  cls: {
    label: 'Cumulative Layout Shift',
    shortLabel: 'CLS',
    description: 'Estabilidade visual e mudanças inesperadas de layout na página',
    good: 0.1,
    poor: 0.25,
    higherIsBetter: false,
    unit: 'unitless',
  },
  tbt: {
    label: 'Total Blocking Time',
    shortLabel: 'TBT',
    description: 'Tempo total em que a thread principal esteve bloqueada',
    good: 200,
    poor: 600,
    higherIsBetter: false,
    unit: 'ms',
  },
  fcp: {
    label: 'First Contentful Paint',
    shortLabel: 'FCP',
    description: 'Tempo até a primeira renderização de texto ou imagem',
    good: 1800,
    poor: 3000,
    higherIsBetter: false,
    unit: 'ms',
  },
  speedIndex: {
    label: 'Speed Index',
    shortLabel: 'Speed Index',
    description: 'Velocidade com que o conteúdo visível é preenchido na tela',
    good: 3400,
    poor: 5800,
    higherIsBetter: false,
    unit: 'ms',
  },
  ttfb: {
    label: 'Time to First Byte',
    shortLabel: 'TTFB',
    description: 'Tempo de resposta do servidor até a chegada do primeiro byte',
    good: 800,
    poor: 1800,
    higherIsBetter: false,
    unit: 'ms',
  },
};

export const PAGE_TYPE_LABEL: Record<PerfPageType, string> = {
  PDPFull: 'PDP Full',
  PDPLow: 'PDP Low',
};

export const RATING_LABEL: Record<MetricRating, string> = {
  good: 'Bom',
  'needs-improvement': 'Precisa melhorar',
  poor: 'Ruim',
};

export function classifyMetric(key: PerfMetricKey, value: number | null): MetricRating | null {
  if (value === null || value === undefined) {
    return null;
  }

  const def = PERF_METRICS[key];
  if (!def) {
    return null;
  }

  if (def.higherIsBetter) {
    if (value >= def.good) {
      return 'good';
    }
    if (value >= def.poor) {
      return 'needs-improvement';
    }
    return 'poor';
  }

  if (def.goodExclusive ? value < def.good : value <= def.good) {
    return 'good';
  }
  if (value <= def.poor) {
    return 'needs-improvement';
  }
  return 'poor';
}

/** Rótulo do rating para a métrica, respeitando rótulos próprios (ex.: meta de LCP). */
export function ratingLabel(key: PerfMetricKey, rating: MetricRating | null): string {
  if (!rating) {
    return 'Sem dados';
  }
  return (PERF_METRICS[key].ratingLabels ?? RATING_LABEL)[rating];
}

export function formatMetric(key: PerfMetricKey, value: number | null): string {
  if (value === null || value === undefined) {
    return '—';
  }

  const def = PERF_METRICS[key];
  if (!def) {
    return String(value);
  }

  if (def.unit === 'ms') {
    if (Math.abs(value) < 1000) {
      return `${Math.round(value)} ms`;
    }
    return `${(value / 1000).toFixed(2).replace('.', ',')} s`;
  }

  if (def.unit === 'unitless') {
    return value.toFixed(3).replace('.', ',');
  }

  if (def.unit === 'score') {
    return String(Math.round(value));
  }

  return String(value);
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === undefined) {
    return '—';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}
