import type { MonitoringReport, PdpCheckResult, ReportIndexEntry } from './types';

/**
 * Resumo de um run gravado pelo monitor no Firestore (coleção `runs`, ver
 * src/firestoreHistory.ts) e baixado no build por scripts/fetch-firestore-history.ts: a entrada
 * do índice mais o status de cada feature por SKU, com mensagem curta e sem details/screenshots.
 */
export interface FirestoreRunSummary extends ReportIndexEntry {
  results?: (Omit<PdpCheckResult, 'features'> & {
    features: (Omit<PdpCheckResult['features'][number], 'message'> & { message?: string })[];
  })[];
}

export interface FirestoreRunsFile {
  generatedAt?: string;
  reports?: FirestoreRunSummary[];
}

/** Só a entrada do índice (sem os resultados). */
export function indexEntryOf(summary: FirestoreRunSummary): ReportIndexEntry {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { results, ...entry } = summary;
  return entry;
}

/** Relatório montado do resumo, para runs cujo report.json não está em docs/reports. */
export function reportFromSummary(summary: FirestoreRunSummary): MonitoringReport {
  return {
    runId: summary.runId,
    startTime: summary.startTime,
    endTime: summary.endTime,
    durationMs: summary.durationMs,
    skuSource: summary.skuSource,
    summary: summary.summary,
    results: (summary.results ?? []).map((r) => ({
      ...r,
      features: r.features.map((f) => ({ ...f, message: f.message ?? '' })),
    })),
  };
}
