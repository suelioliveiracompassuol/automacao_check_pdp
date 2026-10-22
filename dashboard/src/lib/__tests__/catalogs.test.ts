import { describe, it, expect } from 'vitest';
import { ALL_CHECKLIST_ITEMS, CHECKS_CATALOG, TOTAL_CHECKS } from '../checks-catalog';
import { ALL_FEATURE_KEYS, COUNTRIES, COUNTRY_INFO, countryLabel, vendorInfo } from '../constants';
import { ALL_NAV, isNavActive, PLATFORM_NAV } from '../navigation';
import { PLATFORM_META, PLATFORMS } from '../platforms';

describe('checks-catalog', () => {
  it('conta todas as checagens das categorias', () => {
    expect(TOTAL_CHECKS).toBe(ALL_CHECKLIST_ITEMS.length);
    expect(CHECKS_CATALOG.flatMap((c) => c.items)).toEqual(ALL_CHECKLIST_ITEMS);
  });

  it('só referencia features conhecidas', () => {
    for (const item of ALL_CHECKLIST_ITEMS) {
      expect(ALL_FEATURE_KEYS).toContain(item.key);
    }
  });
});

describe('constants', () => {
  it('deriva a lista de países dos rótulos', () => {
    expect(COUNTRIES).toEqual(Object.keys(COUNTRY_INFO));
  });

  it('countryLabel resolve o nome e devolve o código quando desconhecido', () => {
    expect(countryLabel('br')).toBe('Brasil');
    expect(countryLabel('XX')).toBe('XX');
  });

  it('vendorInfo resolve rótulo e tem fallback neutro', () => {
    expect(vendorInfo('AVON').label).toBe('Avon');
    expect(vendorInfo('outra')).toEqual({
      label: 'outra',
      className: 'bg-neutral-75 text-medium-emphasis',
    });
  });
});

describe('platforms', () => {
  it('indexa a metadata por plataforma', () => {
    for (const p of PLATFORMS) {
      expect(PLATFORM_META[p.platform]).toBe(p);
    }
  });
});

describe('navigation', () => {
  it('marca "em breve" nas plataformas ainda não lançadas', () => {
    const android = PLATFORM_NAV.find((n) => n.href === '/android');
    const web = PLATFORM_NAV.find((n) => n.href === '/web');
    expect(android?.badge).toBe('em breve');
    expect(web?.badge).toBeUndefined();
  });

  it('inclui todas as rotas principais', () => {
    expect(ALL_NAV.map((n) => n.href)).toEqual([
      '/',
      '/performance',
      '/web',
      '/android',
      '/ios',
      '/skus',
    ]);
  });

  it('isNavActive trata a home como rota exata e as demais com sub-rotas', () => {
    expect(isNavActive('/', '/')).toBe(true);
    expect(isNavActive('/web', '/')).toBe(false);
    expect(isNavActive('/web/run_1', '/web')).toBe(true);
    expect(isNavActive('/webinar', '/web')).toBe(false);
  });
});
