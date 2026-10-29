import { describe, expect, it } from 'vitest';
import { groupFeaturesByCategory, TECHNICAL_CATEGORY } from '../feature-groups';
import type { CheckResult } from '../types';

const check = (featureKey: string): CheckResult => ({
  feature: featureKey,
  featureKey,
  passed: true,
  status: 'pass',
  message: '',
});

const shape = (features: CheckResult[]) =>
  groupFeaturesByCategory(features).map((g) => [g.title, g.features.map((f) => f.featureKey)]);

describe('groupFeaturesByCategory', () => {
  it('agrupa pelas categorias do catálogo, na ordem do catálogo', () => {
    expect(
      shape([
        check('images'),
        check('addToCart'),
        check('rating'),
        check('brandShowcase'),
        check('reviews'),
      ]),
    ).toEqual([
      ['Avaliações & Nota', ['reviews', 'rating']],
      ['Vitrines de Produtos', ['brandShowcase']],
      ['Compra', ['addToCart']],
      ['Conteúdo & Mídia', ['images']],
    ]);
  });

  it('põe a API de avaliações/notas no fim de Avaliações & Nota', () => {
    expect(
      shape([check('endpoint_reviews'), check('ratingConsistency'), check('reviews')]),
    ).toEqual([['Avaliações & Nota', ['reviews', 'ratingConsistency', 'endpoint_reviews']]]);
    expect(shape([check('endpoint_ratings'), check('rating')])[0][1]).toEqual([
      'rating',
      'endpoint_ratings',
    ]);
  });

  it('manda i18n e demais APIs para "Técnico", no fim e na ordem do relatório', () => {
    expect(shape([check('endpoint_product_page'), check('i18nKeys'), check('coupons')])).toEqual([
      ['Compra', ['coupons']],
      [TECHNICAL_CATEGORY, ['endpoint_product_page', 'i18nKeys']],
    ]);
  });

  it('omite categorias sem resultado', () => {
    expect(groupFeaturesByCategory([])).toEqual([]);
  });
});
