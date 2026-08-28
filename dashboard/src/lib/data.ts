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

export function getScreenshotsForRun(runId: string): string[] {
  const dir = path.join(DOCS_DIR, 'reports', runId, 'screenshots');
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.png') && (f.includes('_fullpage_') || f.includes('_error_')));
}
