import { CHECKS_CATALOG } from '@/lib/checks-catalog';
import type { CheckResult } from '@/lib/types';

export const TECHNICAL_CATEGORY = 'Técnico';

/**
 * Checagens de API (`endpoint_<regra>`, ver endpoints-rules.ts no monitor) que pertencem a uma
 * feature do catálogo; as demais vão para {@link TECHNICAL_CATEGORY}.
 */
const ENDPOINT_FEATURE: Record<string, string> = {
  reviews: 'reviews',
  ratings: 'rating',
};

const ENDPOINT_PREFIX = 'endpoint_';

/** featureKey → [índice da categoria, índice dentro dela], na ordem do catálogo. */
const CATALOG_POSITION = new Map<string, [number, number]>(
  CHECKS_CATALOG.flatMap((category, c) =>
    category.items.map((item, i) => [item.key, [c, i]] as [string, [number, number]]),
  ),
);

export interface FeatureGroup {
  title: string;
  features: CheckResult[];
}

function positionOf(featureKey: string): [number, number] | undefined {
  if (featureKey.startsWith(ENDPOINT_PREFIX)) {
    const owner = ENDPOINT_FEATURE[featureKey.slice(ENDPOINT_PREFIX.length)];
    const pos = owner ? CATALOG_POSITION.get(owner) : undefined;
    // Depois de todas as checagens de tela da categoria
    return pos && [pos[0], Number.MAX_SAFE_INTEGER];
  }
  return CATALOG_POSITION.get(featureKey);
}

/**
 * Agrupa os resultados de uma PDP pelas categorias de {@link CHECKS_CATALOG} (mesma ordem da
 * home e da visão geral). O que não está no catálogo (i18n, demais APIs) vai para "Técnico", no
 * fim, na ordem do relatório. Categorias sem resultado são omitidas.
 */
export function groupFeaturesByCategory(features: CheckResult[]): FeatureGroup[] {
  const buckets = CHECKS_CATALOG.map(() => [] as { f: CheckResult; order: number }[]);
  const technical: CheckResult[] = [];

  for (const f of features) {
    const pos = positionOf(f.featureKey);
    if (pos) buckets[pos[0]].push({ f, order: pos[1] });
    else technical.push(f);
  }

  const groups: FeatureGroup[] = CHECKS_CATALOG.map((category, c) => ({
    title: category.title,
    // sort é estável: endpoints da mesma categoria mantêm a ordem do relatório
    features: buckets[c].sort((a, b) => a.order - b.order).map(({ f }) => f),
  })).filter((g) => g.features.length > 0);

  if (technical.length > 0) {
    groups.push({ title: TECHNICAL_CATEGORY, features: technical });
  }
  return groups;
}
