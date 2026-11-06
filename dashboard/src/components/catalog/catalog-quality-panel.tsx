'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  Search,
  X,
  XCircle,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { ToggleButton, ToggleGroup } from '@/components/ui/toggle-group';
import {
  DEFAULT_QUALITY_FILTERS,
  filterIssues,
  issuesToCsv,
  summarizeQuality,
  type QualityFilters,
  type RuleSummary,
  type SeverityFilter,
} from '@/lib/catalog-quality';
import type { CatalogIssue, CatalogIssueSeverity, CatalogQualityReport } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Linhas renderizadas por vez. */
export const QUALITY_PAGE_SIZE = 50;

const SEVERITIES: { key: SeverityFilter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'error', label: 'Erros' },
  { key: 'warning', label: 'Alertas' },
];

function SeverityBadge({ severity }: { severity: CatalogIssueSeverity }) {
  const isError = severity === 'error';
  const Icon = isError ? XCircle : AlertTriangle;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
        isError ? 'bg-alert/10 text-alert-dark' : 'bg-warning-lightest text-warning-darkest',
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {isError ? 'Erro' : 'Alerta'}
    </span>
  );
}

function RuleCard({
  rule,
  active,
  onClick,
}: {
  rule: RuleSummary;
  active: boolean;
  onClick: () => void;
}) {
  const clean = rule.count === 0;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      disabled={clean}
      title={rule.description}
      className={cn(
        'flex h-full flex-col rounded-lg border bg-surface p-3 text-left shadow-tiny transition-colors',
        active ? 'border-primary ring-2 ring-primary/30' : 'border-neutral-75',
        clean ? 'cursor-default opacity-70' : 'cursor-pointer hover:border-primary',
      )}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-medium-emphasis">{rule.label}</span>
        {clean ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-label="sem problemas" />
        ) : rule.errors > 0 ? (
          <XCircle className="h-4 w-4 shrink-0 text-alert" aria-hidden="true" />
        ) : (
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning-dark" aria-hidden="true" />
        )}
      </span>
      <span
        className={cn(
          'mt-1 text-2xl font-bold',
          clean
            ? 'text-low-emphasis'
            : rule.errors > 0
              ? 'text-alert-dark'
              : 'text-warning-darkest',
        )}
      >
        {rule.count.toLocaleString('pt-BR')}
      </span>
      <span className="mt-auto pt-1 text-[11px] leading-snug text-low-emphasis">
        {rule.description}
      </span>
    </button>
  );
}

function IssueRow({ issue, ruleLabel }: { issue: CatalogIssue; ruleLabel: string }) {
  return (
    <tr className="border-t border-neutral-75 align-top">
      <td className="py-2.5 pr-3">
        <SeverityBadge severity={issue.severity} />
      </td>
      <td className="py-2.5 pr-3">
        <div className="font-medium text-high-emphasis">{issue.name || issue.sku}</div>
        <a
          href={issue.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-mono text-xs text-medium-emphasis hover:text-primary-dark hover:underline"
        >
          {issue.sku}
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
        {!issue.available && <span className="ml-2 text-xs text-low-emphasis">indisponível</span>}
      </td>
      <td className="py-2.5">
        <div className="text-xs font-semibold text-medium-emphasis">{ruleLabel}</div>
        <div className="text-sm text-high-emphasis">{issue.message}</div>
        <div className="mt-0.5 font-mono text-[11px] text-low-emphasis">
          {issue.fields.join(' · ')}
        </div>
      </td>
    </tr>
  );
}

function downloadCsv(content: string, fileName: string) {
  // BOM para o Excel reconhecer UTF-8 (acentos).
  const blob = new Blob(['﻿', content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function CatalogQualityPanel({ report }: { report: CatalogQualityReport }) {
  const [filters, setFilters] = useState<QualityFilters>(DEFAULT_QUALITY_FILTERS);
  const [visible, setVisible] = useState(QUALITY_PAGE_SIZE);

  const summary = useMemo(
    () => summarizeQuality(report, filters.onlyAvailable),
    [report, filters.onlyAvailable],
  );
  const issues = useMemo(() => filterIssues(report.issues, filters), [report, filters]);
  const ruleLabels = useMemo(
    () => new Map(report.rules.map((r) => [r.key, r.label])),
    [report.rules],
  );

  const update = (patch: Partial<QualityFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setVisible(QUALITY_PAGE_SIZE);
  };

  return (
    <div className="space-y-8">
      <section aria-label="Resumo da validação" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-medium text-medium-emphasis">PDPs verificadas</p>
          <p className="mt-1 text-2xl font-bold text-highlight">
            {summary.checked.toLocaleString('pt-BR')}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-medium-emphasis">Erros</p>
          <p className="mt-1 text-2xl font-bold text-alert-dark">
            {summary.errors.toLocaleString('pt-BR')}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-medium-emphasis">Alertas</p>
          <p className="mt-1 text-2xl font-bold text-warning-darkest">
            {summary.warnings.toLocaleString('pt-BR')}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-medium-emphasis">SKUs com problema</p>
          <p className="mt-1 text-2xl font-bold text-highlight">
            {summary.affectedSkus.toLocaleString('pt-BR')}
          </p>
          <p className="mt-0.5 text-xs text-low-emphasis">
            {summary.checked > 0
              ? `${((summary.affectedSkus / summary.checked) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% do catálogo`
              : ''}
          </p>
        </Card>
      </section>

      <section aria-labelledby="quality-rules-title" className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="quality-rules-title" className="text-lg font-bold text-highlight">
            Regras
          </h2>
          {filters.rule && (
            <button
              type="button"
              onClick={() => update({ rule: null })}
              className="text-xs font-medium text-primary-dark hover:underline"
            >
              Mostrar todas as regras
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {summary.rules.map((rule) => (
            <RuleCard
              key={rule.key}
              rule={rule}
              active={filters.rule === rule.key}
              onClick={() => update({ rule: filters.rule === rule.key ? null : rule.key })}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="quality-issues-title" className="space-y-4">
        <h2 id="quality-issues-title" className="text-lg font-bold text-highlight">
          Problemas
        </h2>
        <Card>
          <div className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <label className="relative block w-full lg:max-w-sm">
                <span className="sr-only">Buscar problemas</span>
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-low-emphasis"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={filters.query}
                  onChange={(e) => update({ query: e.target.value })}
                  placeholder="SKU, nome ou texto do problema"
                  className="w-full rounded-lg border border-neutral-75 bg-surface py-2 pr-9 pl-9 text-sm focus:border-primary focus:outline-none"
                />
                {filters.query && (
                  <button
                    type="button"
                    aria-label="Limpar busca"
                    onClick={() => update({ query: '' })}
                    className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-low-emphasis hover:text-high-emphasis"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <ToggleGroup label="Filtrar por severidade">
                  {SEVERITIES.map(({ key, label }) => (
                    <ToggleButton
                      key={key}
                      size="sm"
                      pressed={filters.severity === key}
                      onClick={() => update({ severity: key })}
                    >
                      {label}
                    </ToggleButton>
                  ))}
                </ToggleGroup>
                <ToggleGroup label="Filtrar por disponibilidade">
                  <ToggleButton
                    size="sm"
                    pressed={filters.onlyAvailable}
                    onClick={() => update({ onlyAvailable: true })}
                  >
                    Só disponíveis
                  </ToggleButton>
                  <ToggleButton
                    size="sm"
                    pressed={!filters.onlyAvailable}
                    onClick={() => update({ onlyAvailable: false })}
                  >
                    Catálogo todo
                  </ToggleButton>
                </ToggleGroup>
                <button
                  type="button"
                  disabled={issues.length === 0}
                  onClick={() =>
                    downloadCsv(
                      issuesToCsv(issues, report.rules),
                      `catalogo-${report.operation}-problemas.csv`,
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-75 bg-surface px-3 py-1.5 text-xs font-medium text-high-emphasis shadow-tiny hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  Exportar CSV
                </button>
              </div>
            </div>

            <p className="text-xs text-medium-emphasis" aria-live="polite">
              {issues.length.toLocaleString('pt-BR')} problema(s)
              {filters.rule && ` · ${ruleLabels.get(filters.rule) ?? filters.rule}`} · erros
              primeiro
            </p>

            {issues.length === 0 ? (
              <p className="rounded-lg border border-dashed border-neutral-75 p-6 text-center text-sm text-medium-emphasis">
                Nenhum problema com esses filtros.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-low-emphasis uppercase">
                    <tr>
                      <th scope="col" className="w-24 py-2 pr-3">
                        Severidade
                      </th>
                      <th scope="col" className="py-2 pr-3">
                        Produto
                      </th>
                      <th scope="col" className="py-2">
                        Problema
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {issues.slice(0, visible).map((issue) => (
                      <IssueRow
                        key={`${issue.sku}-${issue.rule}`}
                        issue={issue}
                        ruleLabel={ruleLabels.get(issue.rule) ?? issue.rule}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {issues.length > visible && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setVisible((v) => v + QUALITY_PAGE_SIZE)}
                  className="rounded-lg border border-neutral-75 bg-surface px-4 py-2 text-sm font-medium text-high-emphasis shadow-tiny hover:bg-neutral-50"
                >
                  Mostrar mais ({(issues.length - visible).toLocaleString('pt-BR')} restantes)
                </button>
              </div>
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}
