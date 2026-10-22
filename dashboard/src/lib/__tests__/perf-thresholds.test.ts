import { describe, it, expect } from 'vitest';
import {
  classifyMetric,
  formatMetric,
  ratingTone,
  RATING_LABEL,
  PERF_METRICS,
  ratingLabel,
} from '../perf-thresholds';

describe('perf-thresholds', () => {
  describe('classifyMetric', () => {
    it('retorna null para valores null ou undefined', () => {
      expect(classifyMetric('lcp', null)).toBeNull();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(classifyMetric('lcp', undefined as any)).toBeNull();
    });

    it('classifica LCP pela Meta 2 da empresa (Supera < 3 s, Atende 3 a 4 s, Abaixo > 4 s)', () => {
      expect(classifyMetric('lcp', 2999)).toBe('good');
      expect(classifyMetric('lcp', 3000)).toBe('needs-improvement');
      expect(classifyMetric('lcp', 4000)).toBe('needs-improvement');
      expect(classifyMetric('lcp', 4001)).toBe('poor');
      expect(ratingLabel('lcp', classifyMetric('lcp', 2999))).toBe('Supera');
      expect(ratingLabel('lcp', classifyMetric('lcp', 3500))).toBe('Atende');
      expect(ratingLabel('lcp', classifyMetric('lcp', 4500))).toBe('Abaixo');
    });

    it('classifica Start Render (coluna da planilha do WebPageTest) com os limites do FCP', () => {
      expect(classifyMetric('startRender', 1800)).toBe('good');
      expect(classifyMetric('startRender', 2500)).toBe('needs-improvement');
      expect(classifyMetric('startRender', 3001)).toBe('poor');
      expect(formatMetric('startRender', 2104)).toBe('2,10 s');
    });

    it('mantém limite inclusivo e rótulos padrão nas demais métricas', () => {
      expect(classifyMetric('fcp', 1800)).toBe('good');
      expect(ratingLabel('fcp', 'good')).toBe('Bom');
      expect(ratingLabel('fcp', null)).toBe('Sem dados');
    });

    it('classifica performanceScore nos limites exatos (higherIsBetter: true)', () => {
      expect(classifyMetric('performanceScore', 90)).toBe('good');
      expect(classifyMetric('performanceScore', 89)).toBe('needs-improvement');
      expect(classifyMetric('performanceScore', 50)).toBe('needs-improvement');
      expect(classifyMetric('performanceScore', 49)).toBe('poor');
    });

    it('classifica CLS, TBT, FCP, Speed Index e TTFB corretamente', () => {
      expect(classifyMetric('cls', 0.1)).toBe('good');
      expect(classifyMetric('cls', 0.101)).toBe('needs-improvement');
      expect(classifyMetric('cls', 0.251)).toBe('poor');

      expect(classifyMetric('tbt', 200)).toBe('good');
      expect(classifyMetric('tbt', 201)).toBe('needs-improvement');
      expect(classifyMetric('tbt', 601)).toBe('poor');

      expect(classifyMetric('fcp', 1800)).toBe('good');
      expect(classifyMetric('fcp', 1801)).toBe('needs-improvement');
      expect(classifyMetric('fcp', 3001)).toBe('poor');

      expect(classifyMetric('speedIndex', 3400)).toBe('good');
      expect(classifyMetric('speedIndex', 3401)).toBe('needs-improvement');
      expect(classifyMetric('speedIndex', 5801)).toBe('poor');

      expect(classifyMetric('ttfb', 800)).toBe('good');
      expect(classifyMetric('ttfb', 801)).toBe('needs-improvement');
      expect(classifyMetric('ttfb', 1801)).toBe('poor');
    });
  });

  describe('formatMetric', () => {
    it('formata valores em milissegundos (< 1000 ms)', () => {
      expect(formatMetric('tbt', 180)).toBe('180 ms');
      expect(formatMetric('lcp', 850)).toBe('850 ms');
    });

    it('formata valores em segundos (>= 1000 ms) com 2 casas e vírgula', () => {
      expect(formatMetric('lcp', 2310)).toBe('2,31 s');
      expect(formatMetric('fcp', 1250)).toBe('1,25 s');
    });

    it('formata CLS com 3 casas e vírgula', () => {
      expect(formatMetric('cls', 0.045)).toBe('0,045');
      expect(formatMetric('cls', 0.1)).toBe('0,100');
    });

    it('formata score como inteiro', () => {
      expect(formatMetric('performanceScore', 85)).toBe('85');
      expect(formatMetric('performanceScore', 90.4)).toBe('90');
    });

    it('retorna travessão para null', () => {
      expect(formatMetric('lcp', null)).toBe('—');
      expect(formatMetric('performanceScore', null)).toBe('—');
    });
  });

  describe('ratingTone', () => {
    it('mapeia cada rating para suas classes', () => {
      expect(ratingTone('good').dot).toBe('bg-success');
      expect(ratingTone('needs-improvement').text).toBe('text-warning-darkest');
      expect(ratingTone('poor').stroke).toBe('var(--color-alert)');
      expect(ratingTone(null).text).toBe('text-low-emphasis');
    });
  });

  describe('RATING_LABEL e PERF_METRICS', () => {
    it('possui rótulos legíveis em pt-BR', () => {
      expect(RATING_LABEL.good).toBe('Bom');
      expect(RATING_LABEL['needs-improvement']).toBe('Precisa melhorar');
      expect(RATING_LABEL.poor).toBe('Ruim');
      expect(PERF_METRICS.lcp.shortLabel).toBe('LCP');
    });
  });
});
