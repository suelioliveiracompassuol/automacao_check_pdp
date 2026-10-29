import fs from 'node:fs';
import path from 'node:path';
import { cache } from 'react';
import type { FeatureRefIndex } from './feature-refs';
import { runsWithinDays } from './perf-history';
import { platformOf } from './report';
import type {
  MonitoringReport,
  PerfPageType,
  Platform,
  ReportIndex,
  ReportIndexEntry,
  PerfIndex,
  PerfIndexEntry,
  PerfRun,
} from './types';

// Next.js guarantees cwd() = package root (dashboard/).
// In CI the workflow does `cd dashboard && npm run build`, so ../docs resolves correctly.
const DOCS_DIR = path.join(process.cwd(), '..', 'docs');

// Medições de performance: docs/perf vem do workflow (é o que o Pages publica) e reports/perf
// recebe as execuções locais (`npm run perf:local`, ignorada pelo git). No CI a pasta local não
// existe; na máquina de quem desenvolve, o dashboard mostra as duas juntas sem configurar nada.
const PUBLISHED_PERF_DIR = path.join(DOCS_DIR, 'perf');
const PERF_DIRS = [PUBLISHED_PERF_DIR, path.join(process.cwd(), '..', 'reports', 'perf')];

function readJson<T>(...segments: string[]): T {
  return JSON.parse(fs.readFileSync(path.join(DOCS_DIR, ...segments), 'utf-8'));
}

/** Lê o JSON se existir; null quando o arquivo falta ou está corrompido. */
function readOptionalJson<T>(...segments: string[]): T | null {
  return readJsonFile(path.join(DOCS_DIR, ...segments));
}

function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

// As leituras usam `cache` do React: layout, página, dropdown de histórico e
// generateStaticParams pedem os mesmos arquivos no mesmo render e só o primeiro lê o disco.

export const getLastReport = cache((): MonitoringReport => readJson('last-report.json'));

/**
 * Execuções de todas as plataformas, mais recente primeiro. Web grava docs/reports/index.json e
 * o Android, que roda num workflow separado, grava index.android.json (opcional). Entradas
 * Android antigas ainda podem estar no index.json; o runId evita duplicar.
 */
export const getReportIndex = cache((): ReportIndex => {
  const web = readJson<ReportIndex>('reports', 'index.json').reports;
  const android = readOptionalJson<ReportIndex>('reports', 'index.android.json')?.reports ?? [];
  if (android.length === 0) {
    return { reports: web };
  }

  const byRunId = new Map<string, ReportIndexEntry>();
  for (const entry of [...android, ...web]) {
    if (!byRunId.has(entry.runId)) {
      byRunId.set(entry.runId, entry);
    }
  }
  const reports = [...byRunId.values()].sort(
    (a, b) => (Date.parse(b.startTime) || 0) - (Date.parse(a.startTime) || 0),
  );
  return { reports };
});

export const getReportById = cache((runId: string): MonitoringReport | null =>
  readOptionalJson('reports', runId, 'report.json'),
);

/** Index entries for `platform`, most recent first. Entries with no `platform` field
 * (legacy reports, predating multi-platform support) are treated as 'web'. */
export function getReportsByPlatform(platform: Platform): ReportIndexEntry[] {
  return getReportIndex().reports.filter((r) => platformOf(r) === platform);
}

/** Most recent run for `platform`, or null if none have been recorded yet. */
export function getLastReportByPlatform(platform: Platform): MonitoringReport | null {
  const latest = getReportsByPlatform(platform)[0];
  return latest ? getReportById(latest.runId) : null;
}

const FEATURE_REFS_DIR = path.join(process.cwd(), 'public', 'feature-refs');

/** Reference images present in public/feature-refs (see feature-refs.ts), by operation group. */
export const getFeatureRefIndex = cache((): FeatureRefIndex => {
  if (!fs.existsSync(FEATURE_REFS_DIR)) {
    return {};
  }
  return Object.fromEntries(
    fs
      .readdirSync(FEATURE_REFS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => [
        entry.name,
        fs
          .readdirSync(path.join(FEATURE_REFS_DIR, entry.name))
          .filter((fileName) => fileName.endsWith('.png'))
          .map((fileName) => fileName.replace(/\.png$/, '')),
      ]),
  );
});

// Web monitor screenshots follow the naming convention used by src/index.ts.
const WEB_SCREENSHOT = /_(fullpage|error)_/i;
// Android Appium screenshots are timestamped PNGs without those web-only markers,
// e.g. `NATBRA-70983_1725971234567.png` and `NATBRA-70983_login_debug_1725971234567.png`.
const ANDROID_SCREENSHOT = /_\d{13}\.png$/i;

export function getScreenshotsForRun(runId: string): string[] {
  const dir = path.join(DOCS_DIR, 'reports', runId, 'screenshots');
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs
    .readdirSync(dir)
    .filter(
      (fileName) =>
        fileName.endsWith('.png') &&
        (WEB_SCREENSHOT.test(fileName) || ANDROID_SCREENSHOT.test(fileName)),
    );
}

/** Histórico de performance das duas pastas, sem duplicatas, mais recente primeiro. */
export const getPerfIndex = cache((): PerfIndex => {
  const byRunId = new Map<string, PerfIndexEntry>();
  for (const dir of PERF_DIRS) {
    const index = readJsonFile<PerfIndex>(path.join(dir, 'index.json'));
    for (const run of index?.runs ?? []) {
      if (!byRunId.has(run.runId)) {
        byRunId.set(run.runId, run);
      }
    }
  }
  const runs = [...byRunId.values()].sort(
    (a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0),
  );
  return { runs };
});

export const getPerfRun = cache((runId: string): PerfRun | null => {
  for (const dir of PERF_DIRS) {
    const run = readJsonFile<PerfRun>(path.join(dir, `${runId}.json`));
    if (run) {
      return run;
    }
  }
  return null;
});

export interface PerfReportFile {
  sku: string;
  name: string;
  pageType?: PerfPageType;
  /** Relativo a docs/perf, ex.: "run_1/NATBRA-108403.json". */
  path: string;
}

export interface PerfReportDownloads {
  runId: string;
  timestamp: string;
  files: PerfReportFile[];
}

/** Relatórios completos do Lighthouse ainda disponíveis nas rodadas dos últimos `days` dias,
 * mais recentes primeiro. Só os publicados (docs/perf), que são os que têm URL de download;
 * confere o disco porque o workflow apaga os arquivos após 10 dias. */
export function getPerfReportDownloads(days: number): PerfReportDownloads[] {
  return runsWithinDays(getPerfIndex().runs, days)
    .map(({ runId, timestamp }) => ({
      runId,
      timestamp,
      files: (getPerfRun(runId)?.results ?? [])
        .filter(
          (r) => r.reportJsonPath && fs.existsSync(path.join(PUBLISHED_PERF_DIR, r.reportJsonPath)),
        )
        .map((r) => ({ sku: r.sku, name: r.name, pageType: r.pageType, path: r.reportJsonPath! })),
    }))
    .filter((run) => run.files.length > 0);
}
