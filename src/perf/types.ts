export interface PerfMetrics {
  performanceScore: number | null; // 0-100
  lcp: number | null;              // ms
  cls: number | null;
  tbt: number | null;              // ms
  fcp: number | null;              // ms
  speedIndex: number | null;       // ms
  ttfb: number | null;             // ms
  totalByteWeight: number | null;  // bytes
  requestCount: number | null;
}

export interface PerfLcpElement {
  nodeLabel: string | null;
  selector: string | null;
  snippet: string | null;
}

export interface PerfOpportunity {
  id: string;
  title: string;
  savingsMs: number;
}

export interface PerfSkuResult {
  sku: string;
  name: string;
  pageType?: "PDPFull" | "PDPLow";
  url: string;
  success: boolean;
  error?: string;
  median: PerfMetrics | null;      // métricas da execução mediana
  runs: PerfMetrics[];             // todas as execuções válidas
  lcpElement: PerfLcpElement | null;
  opportunities: PerfOpportunity[];
  reportHtmlPath: string | null;   // relativo a docs/perf, ex.: "run_123/NATBRA-108403.html"
  lighthouseVersion: string | null;
}

export interface PerfRun {
  runId: string;                   // "run_<Date.now()>"
  timestamp: string;               // ISO
  formFactor: "desktop";
  runsPerSku: number;
  results: PerfSkuResult[];
}

export interface PerfIndexEntry {
  runId: string;
  timestamp: string;
  skus: {
    sku: string;
    name: string;
    pageType?: "PDPFull" | "PDPLow";
    success: boolean;
    metrics: PerfMetrics | null;
  }[];
}

export interface PerfIndex {
  runs: PerfIndexEntry[];          // mais recente primeiro, máx. 365
}
