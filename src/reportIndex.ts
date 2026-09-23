/**
 * Shared read-modify-write helper for docs/reports/index.json, used by both the Web
 * (index.ts) and Android (index.android.ts) orchestrators. Upserts by runId (instead of
 * blindly unshifting) and serializes concurrent writers via a best-effort lockfile, so two
 * orchestrators finishing around the same time merge into the index instead of one clobbering
 * the other's entry.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { MonitoringReport, Platform } from "./types.js";

export interface ReportIndexEntry {
  runId: string;
  startTime: string;
  endTime: string;
  durationMs: number;
  summary: MonitoringReport["summary"];
  htmlPath: string;
  jsonPath: string;
  platform?: Platform;
}

const MAX_ENTRIES = 100;
const LOCK_ACQUIRE_TIMEOUT_MS = 10_000;

function getReportIndexPath(): string {
  return path.join(process.cwd(), "docs", "reports", "index.json");
}

/**
 * Best-effort cross-process mutex via an exclusive lockfile (fs "wx" flag fails if the file
 * already exists). Not a true atomic lock (no staleness detection beyond the acquire timeout),
 * but enough to serialize the handful of orchestrators that write this file today without
 * adding a dependency or migrating storage.
 */
async function withIndexLock<T>(indexPath: string, fn: () => T): Promise<T> {
  const lockPath = `${indexPath}.lock`;
  const deadline = Date.now() + LOCK_ACQUIRE_TIMEOUT_MS;
  while (true) {
    try {
      fs.writeFileSync(lockPath, String(process.pid), { flag: "wx" });
      break;
    } catch {
      if (Date.now() > deadline) {
        console.warn(
          `⚠️  Lock de ${lockPath} não liberou a tempo, prosseguindo sem lock (risco de sobrescrita concorrente).`,
        );
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 150));
    }
  }
  try {
    return fn();
  } finally {
    fs.rmSync(lockPath, { force: true });
  }
}

/**
 * Adds or updates `entry` in docs/reports/index.json by runId, capping the index at the
 * MAX_ENTRIES most recent reports. Safe to call from multiple orchestrators around the same
 * time (see withIndexLock).
 */
export async function upsertReportIndexEntry(entry: ReportIndexEntry): Promise<void> {
  const indexPath = getReportIndexPath();
  await withIndexLock(indexPath, () => {
    let reportsIndex: { reports: ReportIndexEntry[] } = { reports: [] };
    if (fs.existsSync(indexPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
        if (data && Array.isArray(data.reports)) {
          reportsIndex = data;
        }
      } catch {
        console.log("Índice de relatórios existente inválido, recriando.");
      }
    }

    reportsIndex.reports = [
      entry,
      ...reportsIndex.reports.filter((r) => r.runId !== entry.runId),
    ].slice(0, MAX_ENTRIES);

    fs.writeFileSync(indexPath, JSON.stringify(reportsIndex, null, 2));
  });
}
