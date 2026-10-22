import { describe, it, expect } from 'vitest';
import {
  filterResults,
  groupByCountry,
  NO_FILTERS,
  passRate,
  platformOf,
  summarizeFeatures,
} from '../report';
import type { CheckResult, PdpCheckResult } from '../types';

describe('platformOf', () => {
  it('assume web quando a plataforma não foi informada', () => {
    expect(platformOf({})).toBe('web');
    expect(platformOf({ platform: 'android' })).toBe('android');
  });
});

describe('passRate', () => {
  it('arredonda o percentual', () => {
    expect(passRate(2, 3)).toBe(67);
  });

  it('retorna 0 sem itens', () => {
    expect(passRate(0, 0)).toBe(0);
  });
});

describe('summarizeFeatures', () => {
  const feature = (status: CheckResult['status'], passed: boolean): CheckResult => ({
    feature: status,
    featureKey: status,
    status,
    passed,
    message: '',
  });

  it('ignora N/A e conta disabled como aprovado', () => {
    expect(
      summarizeFeatures([
        feature('pass', true),
        feature('disabled', false),
        feature('fail', false),
        feature('na', false),
      ]),
    ).toEqual({ passed: 2, failed: 1, total: 3, percentage: 67 });
  });

  it('lida com lista vazia', () => {
    expect(summarizeFeatures([])).toEqual({ passed: 0, failed: 0, total: 0, percentage: 0 });
  });
});

describe('groupByCountry', () => {
  it('agrupa valores únicos por país em maiúsculas', () => {
    const results = [
      { country: 'br', vendor: 'natura' },
      { country: 'BR', vendor: 'avon' },
      { country: 'br', vendor: 'natura' },
      { country: 'ar', vendor: 'natura' },
    ] as PdpCheckResult[];
    const groups = groupByCountry(results, (r) => r.vendor);
    expect([...groups.get('BR')!]).toEqual(['natura', 'avon']);
    expect([...groups.get('AR')!]).toEqual(['natura']);
  });
});

describe('filterResults', () => {
  const results = [
    {
      sku: 'NAT-1',
      name: 'Creme',
      url: 'https://x/creme',
      vendor: 'Natura',
      country: 'br',
      success: true,
    },
    {
      sku: 'NAT-2',
      name: 'Perfume',
      url: 'https://x/perfume',
      vendor: 'natura',
      country: 'ar',
      success: false,
    },
    {
      sku: 'AVN-1',
      name: 'Batom',
      url: 'https://x/batom',
      vendor: 'avon',
      country: 'br',
      success: false,
    },
  ] as PdpCheckResult[];
  const skus = (list: PdpCheckResult[]) => list.map((r) => r.sku);

  it('sem filtros devolve tudo', () => {
    expect(filterResults(results, NO_FILTERS)).toHaveLength(3);
  });

  it('filtra por vendor e país ignorando caixa', () => {
    expect(
      skus(filterResults(results, { ...NO_FILTERS, vendor: 'natura', country: 'BR' })),
    ).toEqual(['NAT-1']);
  });

  it('filtra por status', () => {
    expect(skus(filterResults(results, { ...NO_FILTERS, status: 'pass' }))).toEqual(['NAT-1']);
    expect(skus(filterResults(results, { ...NO_FILTERS, status: 'fail' }))).toEqual([
      'NAT-2',
      'AVN-1',
    ]);
  });

  it('combina busca com filtro de status (antes a busca era ignorada)', () => {
    expect(
      skus(filterResults(results, { ...NO_FILTERS, status: 'fail', search: 'batom' })),
    ).toEqual(['AVN-1']);
  });

  it('busca por SKU, nome ou URL', () => {
    expect(skus(filterResults(results, { ...NO_FILTERS, search: 'avn' }))).toEqual(['AVN-1']);
    expect(skus(filterResults(results, { ...NO_FILTERS, search: ' PERFUME ' }))).toEqual(['NAT-2']);
    expect(skus(filterResults(results, { ...NO_FILTERS, search: 'x/creme' }))).toEqual(['NAT-1']);
  });
});
