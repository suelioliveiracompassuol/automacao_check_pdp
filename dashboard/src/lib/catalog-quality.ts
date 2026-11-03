import type {
  CatalogIssue,
  CatalogIssueSeverity,
  CatalogQualityReport,
  CatalogRule,
} from './types';

export type SeverityFilter = 'all' | CatalogIssueSeverity;

export interface QualityFilters {
  query: string;
  severity: SeverityFilter;
  /** Chave da regra, ou null para todas. */
  rule: string | null;
  /** Problema em produto indisponível não aparece na loja; por padrão fica de fora. */
  onlyAvailable: boolean;
}

export const DEFAULT_QUALITY_FILTERS: QualityFilters = {
  query: '',
  severity: 'all',
  rule: null,
  onlyAvailable: true,
};

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

export function filterIssues(issues: CatalogIssue[], filters: QualityFilters): CatalogIssue[] {
  const query = normalize(filters.query.trim());
  return issues.filter((issue) => {
    if (filters.onlyAvailable && !issue.available) {
      return false;
    }
    if (filters.severity !== 'all' && issue.severity !== filters.severity) {
      return false;
    }
    if (filters.rule && issue.rule !== filters.rule) {
      return false;
    }
    if (query) {
      return normalize(`${issue.sku} ${issue.name} ${issue.message}`).includes(query);
    }
    return true;
  });
}

export interface RuleSummary extends CatalogRule {
  count: number;
  errors: number;
  warnings: number;
}

export interface QualitySummary {
  checked: number;
  errors: number;
  warnings: number;
  /** SKUs com pelo menos um problema. */
  affectedSkus: number;
  /** Uma entrada por regra, na ordem do monitor, mesmo as sem problema. */
  rules: RuleSummary[];
}

/** Resumo dos problemas que passam pelo filtro de disponibilidade (os demais filtros são da lista). */
export function summarizeQuality(
  report: CatalogQualityReport,
  onlyAvailable: boolean,
): QualitySummary {
  const issues = report.issues.filter((i) => !onlyAvailable || i.available);
  const count = (predicate: (i: CatalogIssue) => boolean) => issues.filter(predicate).length;
  return {
    checked: report.checked,
    errors: count((i) => i.severity === 'error'),
    warnings: count((i) => i.severity === 'warning'),
    affectedSkus: new Set(issues.map((i) => i.sku)).size,
    rules: report.rules.map((rule) => ({
      ...rule,
      count: count((i) => i.rule === rule.key),
      errors: count((i) => i.rule === rule.key && i.severity === 'error'),
      warnings: count((i) => i.rule === rule.key && i.severity === 'warning'),
    })),
  };
}

/** CSV dos problemas filtrados, para mandar ao time de cadastro (separador ";" abre no Excel pt-BR). */
export function issuesToCsv(issues: CatalogIssue[], rules: CatalogRule[]): string {
  const labels = new Map(rules.map((r) => [r.key, r.label]));
  const cell = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const header = [
    'SKU',
    'Produto',
    'Severidade',
    'Regra',
    'Problema',
    'Colunas',
    'Disponível',
    'Link',
  ];
  const lines = issues.map((i) =>
    [
      i.sku,
      i.name,
      i.severity === 'error' ? 'erro' : 'alerta',
      labels.get(i.rule) ?? i.rule,
      i.message,
      i.fields.join(', '),
      i.available ? 'sim' : 'não',
      i.url,
    ]
      .map(cell)
      .join(';'),
  );
  return [header.map(cell).join(';'), ...lines].join('\r\n');
}
