import { describe, it, expect } from 'vitest';
import {
  DEFAULT_QUALITY_FILTERS,
  filterIssues,
  issuesToCsv,
  summarizeQuality,
} from '../catalog-quality';
import { makeCatalogQualityReport } from '@/test/fixtures';

const report = makeCatalogQualityReport();
const keys = (issues: { sku: string; rule: string }[]) => issues.map((i) => `${i.sku}:${i.rule}`);

describe('qualidade do catálogo', () => {
  it('por padrão esconde problemas de produtos indisponíveis', () => {
    expect(keys(filterIssues(report.issues, DEFAULT_QUALITY_FILTERS))).toEqual([
      'NATBRA-226559:typeConcentration',
      'NATBRA-226559:noteTypo',
    ]);
    expect(
      filterIssues(report.issues, { ...DEFAULT_QUALITY_FILTERS, onlyAvailable: false }),
    ).toHaveLength(3);
  });

  it('filtra por severidade, regra e busca sem acento', () => {
    const all = { ...DEFAULT_QUALITY_FILTERS, onlyAvailable: false };
    expect(keys(filterIssues(report.issues, { ...all, severity: 'warning' }))).toEqual([
      'NATBRA-226559:noteTypo',
    ]);
    expect(filterIssues(report.issues, { ...all, rule: 'typeConcentration' })).toHaveLength(2);
    expect(keys(filterIssues(report.issues, { ...all, query: 'colonia luna' }))).toEqual([
      'NATBRA-204451:typeConcentration',
    ]);
    expect(filterIssues(report.issues, { ...all, query: 'LICHA' })).toHaveLength(1);
  });

  it('resume por regra, mantendo as regras sem problema', () => {
    const summary = summarizeQuality(report, true);
    expect(summary).toMatchObject({ checked: 8, errors: 1, warnings: 1, affectedSkus: 1 });
    expect(summary.rules.map((r) => [r.key, r.count, r.errors, r.warnings])).toEqual([
      ['typeConcentration', 1, 1, 0],
      ['noteTypo', 1, 0, 1],
      ['pdpLink', 0, 0, 0],
    ]);
    expect(summarizeQuality(report, false)).toMatchObject({ errors: 2, affectedSkus: 2 });
  });

  it('CSV com ";", rótulo da regra e aspas escapadas', () => {
    const csv = issuesToCsv(report.issues.slice(0, 1), report.rules).split('\r\n');
    expect(csv[0]).toBe(
      '"SKU";"Produto";"Severidade";"Regra";"Problema";"Colunas";"Disponível";"Link"',
    );
    expect(csv[1]).toContain('"erro";"Tipo × concentração"');
    expect(csv[1]).toContain('"Tipo ""eau de parfum"", mas a concentração é ""deo parfum""."');
    expect(csv[1]).toContain('"Type of Product, Concentration";"sim"');
  });
});
