import fs from 'node:fs';
import path from 'node:path';
import type { MonitoringReport, ReportIndex } from './types';

// Next.js guarantees cwd() = package root (dashboard/).
// In CI the workflow does `cd dashboard && npm run build`, so ../docs resolves correctly.
const DOCS_DIR = path.join(process.cwd(), '..', 'docs');

export function getLastReport(): MonitoringReport {
  const filePath = path.join(DOCS_DIR, 'last-report.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

export function getReportIndex(): ReportIndex {
  const filePath = path.join(DOCS_DIR, 'reports', 'index.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

export function getReportById(runId: string): MonitoringReport | null {
  const filePath = path.join(DOCS_DIR, 'reports', runId, 'report.json');
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

/** Most recent Android run, or null if none have been recorded yet. Android has no
 * last-report.json equivalent (it's a supplementary POC run, not the main daily monitor),
 * so this looks it up from the shared reports index instead. */
export function getLastAndroidReport(): MonitoringReport | null {
  const index = getReportIndex();
  const latest = index.reports.find((r) => r.platform === 'android');
  return latest ? getReportById(latest.runId) : null;
}

export function getScreenshotsForRun(runId: string): string[] {
  const dir = path.join(DOCS_DIR, 'reports', runId, 'screenshots');
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir).filter((fileName) => {
    if (!fileName.endsWith('.png')) {
      return false;
    }

    const normalized = fileName.toLowerCase();

    // Web monitor screenshots follow the convention used by src/index.ts
    const isWebScreenshot = normalized.includes('_fullpage_') || normalized.includes('_error_');

    // Android Appium screenshots are saved as timestamped PNGs without those web-only markers,
    // e.g. `NATBRA-70983_1725971234567.png` and `NATBRA-70983_login_debug_1725971234567.png`.
    const isAndroidScreenshot =
      /_\d{13}\.png$/i.test(fileName) || /_debug_\d{13}\.png$/i.test(fileName);

    return isWebScreenshot || isAndroidScreenshot;
  });
}
