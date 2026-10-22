import type { CheckResult, PdpCheckResult, Platform } from './types';

/** Entradas sem `platform` são relatórios legados, anteriores ao suporte multi-plataforma: web. */
export function platformOf(entry: { platform?: Platform }): Platform {
  return entry.platform ?? 'web';
}

/** Percentual inteiro de aprovação; 0 quando não há itens. */
export function passRate(passed: number, total: number): number {
  return total > 0 ? Math.round((passed / total) * 100) : 0;
}

export interface FeatureSummary {
  passed: number;
  failed: number;
  total: number;
  percentage: number;
}

/** Contagem das features testáveis de uma PDP. N/A não conta; "disabled" (desligada via Remote
 * Config) conta como aprovada, igual ao monitor. */
export function summarizeFeatures(features: CheckResult[]): FeatureSummary {
  const testable = features.filter((f) => f.status !== 'na');
  const passed = testable.filter((f) => f.passed || f.status === 'disabled').length;
  const total = testable.length;
  return { passed, failed: total - passed, total, percentage: passRate(passed, total) };
}

/** Agrupa um atributo dos resultados por país (código em maiúsculas). */
export function groupByCountry(
  results: PdpCheckResult[],
  pick: (result: PdpCheckResult) => string,
): Map<string, Set<string>> {
  const groups = new Map<string, Set<string>>();
  for (const result of results) {
    const country = result.country.toUpperCase();
    const values = groups.get(country) ?? new Set<string>();
    values.add(pick(result));
    groups.set(country, values);
  }
  return groups;
}

export type StatusFilter = 'all' | 'pass' | 'fail';

export interface ResultFilters {
  search: string;
  /** Vendor em minúsculas ou 'all'. */
  vendor: string;
  /** Código do país em maiúsculas ou 'all'. */
  country: string;
  status: StatusFilter;
}

export const NO_FILTERS: ResultFilters = {
  search: '',
  vendor: 'all',
  country: 'all',
  status: 'all',
};

/** Aplica todos os filtros da tela de resultados (combinados com E). A busca considera SKU,
 * nome e URL, sem diferenciar maiúsculas. */
export function filterResults(results: PdpCheckResult[], filters: ResultFilters): PdpCheckResult[] {
  const query = filters.search.trim().toLowerCase();
  return results.filter((r) => {
    if (filters.vendor !== 'all' && r.vendor.toLowerCase() !== filters.vendor) return false;
    if (filters.country !== 'all' && r.country.toUpperCase() !== filters.country) return false;
    if (filters.status === 'pass' && !r.success) return false;
    if (filters.status === 'fail' && r.success) return false;
    if (query) {
      return [r.sku, r.name, r.url].some((field) => field?.toLowerCase().includes(query));
    }
    return true;
  });
}
