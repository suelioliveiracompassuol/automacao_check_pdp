/**
 * Previous runs' reports (docs/reports, committed by CI) and what the monitor derives from them:
 * which of this run's failures are new. A check that never failed for a SKU and fails now is
 * the one most worth a human look (a product regression or a broken check), while one that has
 * been failing for days was already triaged.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { reportIndexFileName } from "./reportIndex.js";
import type { CheckResult, PdpCheckResult, Platform } from "./types.js";

/** How many previous runs to look through (filtered runs don't have every SKU). */
export const MAX_RUNS_LOOKBACK = 15;

export interface PreviousRun {
  runId: string;
  startTime: string;
  results: PdpCheckResult[];
}

/**
 * The platform's previous runs, newest first, up to `max`. Missing or unreadable reports are
 * skipped: a local checkout may not have every run.
 */
export function readPreviousRuns(
  platform: Platform | undefined,
  reportsDir = path.join(process.cwd(), "docs", "reports"),
  excludeRunId?: string,
  max = MAX_RUNS_LOOKBACK,
): PreviousRun[] {
  type IndexEntry = { runId: string; startTime?: string };
  let index: IndexEntry[];
  try {
    const parsed = JSON.parse(
      fs.readFileSync(path.join(reportsDir, reportIndexFileName(platform)), "utf-8"),
    ) as { reports?: IndexEntry[] } | IndexEntry[];
    // The index is { generatedAt, reports: [...] }; a bare array is accepted too
    index = (Array.isArray(parsed) ? parsed : parsed?.reports ?? []).filter(
      (e): e is IndexEntry => typeof e?.runId === "string",
    );
  } catch {
    return [];
  }
  const runs: PreviousRun[] = [];
  const sorted = index
    .filter((e) => e.runId !== excludeRunId)
    .sort((a, b) => String(b.startTime ?? "").localeCompare(String(a.startTime ?? "")))
    .slice(0, max);
  for (const entry of sorted) {
    try {
      const report = JSON.parse(
        fs.readFileSync(path.join(reportsDir, entry.runId, "report.json"), "utf-8"),
      ) as { results?: PdpCheckResult[] };
      runs.push({ runId: entry.runId, startTime: entry.startTime ?? "", results: report.results ?? [] });
    } catch {
      // run without its report.json locally
    }
  }
  return runs;
}

type ResultKey = Pick<PdpCheckResult, "sku" | "vendor" | "country" | "channel">;

export function resultKey(r: ResultKey): string {
  return `${r.vendor}|${r.country}|${r.channel ?? "ecommerce"}|${r.sku}`;
}

const isFailing = (status: CheckResult["status"] | undefined) =>
  status === "fail" || status === "error";

/** A SKU + feature's history, from the newest previous run that checked it backwards. */
export interface FeatureHistory {
  /** Status in the newest previous run that checked it. */
  lastStatus: CheckResult["status"];
  /** Start of the failing streak that reaches the newest previous run (only when it failed there). */
  failingSince?: string;
}

/** Per `resultKey|featureKey`, the feature's history over the previous runs (newest first). */
export function buildFeatureHistory(runs: PreviousRun[]): Map<string, FeatureHistory> {
  const history = new Map<string, FeatureHistory>();
  /** Keys whose failing streak was broken by an older non-failing run. */
  const streakClosed = new Set<string>();
  for (const run of runs) {
    for (const result of run.results) {
      const when = result.timestamp ?? run.startTime;
      for (const f of result.features ?? []) {
        const key = `${resultKey(result)}|${f.featureKey}`;
        const known = history.get(key);
        if (!known) {
          history.set(key, { lastStatus: f.status, ...(isFailing(f.status) ? { failingSince: when } : {}) });
          if (!isFailing(f.status)) {
            streakClosed.add(key);
          }
          continue;
        }
        if (streakClosed.has(key)) {
          continue;
        }
        if (isFailing(f.status)) {
          known.failingSince = when;
        } else {
          streakClosed.add(key);
        }
      }
    }
  }
  return history;
}

/**
 * Marks this run's failing checks: `newFailure` when the newest previous run that checked the
 * SKU + feature didn't fail it (or none checked it), else `failingSince` with when the failing
 * streak started (as far back as the lookback goes). Returns how many failures are new.
 */
export function markNewFailures(
  results: PdpCheckResult[],
  history: Map<string, FeatureHistory>,
): number {
  let count = 0;
  for (const result of results) {
    result.features = result.features.map((f) => {
      if (!isFailing(f.status)) {
        return f;
      }
      const previous = history.get(`${resultKey(result)}|${f.featureKey}`);
      if (previous && isFailing(previous.lastStatus)) {
        return { ...f, newFailure: false, failingSince: previous.failingSince };
      }
      count++;
      return { ...f, newFailure: true };
    });
  }
  return count;
}

/**
 * Loads the platform's previous runs and marks this run's new failures (see markNewFailures),
 * logging them. Best effort: the history only adds context, never changes a verdict.
 */
export function markNewFailuresFromReports(
  results: PdpCheckResult[],
  platform: Platform,
  excludeRunId?: string,
): number {
  try {
    const runs = readPreviousRuns(platform === "web" ? undefined : platform, undefined, excludeRunId);
    if (runs.length === 0) {
      return 0;
    }
    const count = markNewFailures(results, buildFeatureHistory(runs));
    if (count > 0) {
      console.log(`\n🆕 ${count} falha(s) nova(s) (não falhavam no run anterior do SKU):`);
      for (const r of results) {
        for (const f of r.features.filter((x) => x.newFailure)) {
          console.log(`   - ${r.sku} (${r.vendor}-${r.country}) · ${f.feature}: ${f.message.slice(0, 160)}`);
        }
      }
    }
    return count;
  } catch (err) {
    console.warn(`   ⚠️ Histórico de falhas indisponível: ${(err as Error).message}`);
    return 0;
  }
}
