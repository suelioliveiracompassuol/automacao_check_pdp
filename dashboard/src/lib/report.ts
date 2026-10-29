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
    if (filters.vendor !== 'all' && r.vendor.toLowerCase() !== filters.vendor) {
      return false;
    }
    if (filters.country !== 'all' && r.country.toUpperCase() !== filters.country) {
      return false;
    }
    if (filters.status === 'pass' && !r.success) {
      return false;
    }
    if (filters.status === 'fail' && r.success) {
      return false;
    }
    if (query) {
      return [r.sku, r.name, r.url].some((field) => field?.toLowerCase().includes(query));
    }
    return true;
  });
}

/** Quantas execuções recentes de cada plataforma são pré-renderizadas no export estático. */
export const PRERENDERED_RUNS = 5;

/** Execução fictícia usada quando não há nenhuma: com `output: 'export'`, o Next recusa um
 * generateStaticParams vazio ("missing generateStaticParams"). A página responde 404 para ela. */
export const NO_RUNS_PLACEHOLDER = '_sem-execucoes';

/** Parâmetros de rotas /[runId] para o export estático, das execuções mais recentes. */
export function runIdStaticParams(entries: { runId: string }[]): { runId: string }[] {
  const runIds = entries.slice(0, PRERENDERED_RUNS).map((e) => e.runId);
  return (runIds.length > 0 ? runIds : [NO_RUNS_PLACEHOLDER]).map((runId) => ({ runId }));
}

/**
 * Screenshots de `screenshots/` que pertencem a um SKU. O monitor nomeia os arquivos como
 * `<SKU>_...png` (web: `NATBRA-1_fullpage_<ts>.png`; Android: `NATBRA-1_<ts>.png`, com o SKU
 * saneado), então o casamento é pelo prefixo `<SKU>_` — assim NATBRA-1 não pega NATBRA-10.
 * O `pageScreenshot` fica de fora porque já tem botão próprio na tabela de features.
 */
export function screenshotsForSku(
  screenshots: string[],
  sku: string,
  pageScreenshot?: string,
): string[] {
  // Mesma regra de toSafeFileName (src/utils.ts do monitor, outro projeto npm): mudar as duas juntas.
  const prefix = `${sku.replace(/[^a-zA-Z0-9._-]+/g, '_')}_`.toLowerCase();
  const pageFile = pageScreenshot?.split(/[\\/]/).pop();
  return screenshots.filter((s) => s.toLowerCase().startsWith(prefix) && s !== pageFile);
}
