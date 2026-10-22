import type {
  CheckResult,
  MonitoringReport,
  PdpCheckResult,
  PerfIndexEntry,
  PerfMetrics,
  PerfRun,
  PerfSkuResult,
  ReportIndexEntry,
  SkuEntry,
} from '@/lib/types';

/** Fábricas de dados de teste: valores padrão válidos + overrides só do que importa no teste. */

export function makeFeature(overrides: Partial<CheckResult> = {}): CheckResult {
  return {
    feature: 'Avaliações',
    featureKey: 'reviews',
    passed: true,
    status: 'pass',
    message: 'ok',
    ...overrides,
  };
}

export function makeResult(overrides: Partial<PdpCheckResult> = {}): PdpCheckResult {
  return {
    sku: 'NATBRA-1',
    name: 'Produto 1',
    url: 'https://www.natura.com.br/p/produto-1/NATBRA-1',
    vendor: 'natura',
    country: 'br',
    timestamp: '2024-05-01T10:00:00Z',
    success: true,
    features: [makeFeature()],
    ...overrides,
  };
}

const summaryOf = (results: PdpCheckResult[]) => {
  const passed = results.filter((r) => r.success).length;
  return { total: results.length, passed, failed: results.length - passed, errors: 0 };
};

export function makeReport(overrides: Partial<MonitoringReport> = {}): MonitoringReport {
  const results = overrides.results ?? [makeResult()];
  return {
    runId: 'run_1',
    startTime: '2024-05-01T10:00:00Z',
    endTime: '2024-05-01T10:05:00Z',
    durationMs: 300_000,
    summary: summaryOf(results),
    results,
    ...overrides,
  };
}

export function makeIndexEntry(overrides: Partial<ReportIndexEntry> = {}): ReportIndexEntry {
  return {
    runId: 'run_1',
    startTime: '2024-05-01T10:00:00Z',
    endTime: '2024-05-01T10:05:00Z',
    durationMs: 300_000,
    summary: { total: 4, passed: 3, failed: 1, errors: 0 },
    jsonPath: 'reports/run_1/report.json',
    ...overrides,
  };
}

export function makeSku(overrides: Partial<SkuEntry> = {}): SkuEntry {
  return {
    id: 'NATBRA-1',
    sku: 'NATBRA-1',
    name: 'Produto 1',
    vendor: 'natura',
    country: 'BR',
    channel: 'ecommerce',
    expectedFeatures: [],
    ...overrides,
  };
}

export function makeMetrics(overrides: Partial<PerfMetrics> = {}): PerfMetrics {
  return {
    performanceScore: 92,
    startRender: 1200,
    lcp: 2500,
    cls: 0.05,
    tbt: 150,
    fcp: 1100,
    speedIndex: 2000,
    ttfb: 400,
    totalByteWeight: 2 * 1024 * 1024,
    requestCount: 80,
    ...overrides,
  };
}

export function makePerfSku(overrides: Partial<PerfSkuResult> = {}): PerfSkuResult {
  return {
    sku: 'NATBRA-108403',
    name: 'Perfume',
    pageType: 'PDPFull',
    url: 'https://www.natura.com.br/p/perfume/NATBRA-108403',
    success: true,
    median: makeMetrics(),
    runs: [],
    lcpElement: { nodeLabel: 'Imagem do produto', selector: 'img.main', snippet: '<img>' },
    opportunities: [{ id: 'unused-js', title: 'Reduzir JS não usado', savingsMs: 1200 }],
    reportJsonPath: 'run_1/NATBRA-108403.json',
    lighthouseVersion: '12.0.0',
    ...overrides,
  };
}

export function makePerfRun(overrides: Partial<PerfRun> = {}): PerfRun {
  return {
    runId: 'run_1',
    timestamp: '2024-05-01T10:00:00Z',
    formFactor: 'desktop',
    runsPerSku: 3,
    results: [makePerfSku()],
    ...overrides,
  };
}

export function makePerfIndexEntry(overrides: Partial<PerfIndexEntry> = {}): PerfIndexEntry {
  return {
    runId: 'run_1',
    timestamp: '2024-05-01T10:00:00Z',
    skus: [
      {
        sku: 'NATBRA-108403',
        name: 'Perfume',
        pageType: 'PDPFull',
        success: true,
        metrics: makeMetrics(),
      },
    ],
    ...overrides,
  };
}
