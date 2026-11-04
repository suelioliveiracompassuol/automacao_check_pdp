/**
 * Grace period for the product rating (SFCC) diverging from the reviews' rating (Konfidency).
 * SFCC picks up Konfidency's rating in a daily job, so a divergence up to a day old is expected
 * (warning); older than that, the sync is broken (fail). "Since when" comes from the previous
 * runs' reports in docs/reports (committed by CI), carried forward in
 * ratingConsistency.details.divergentSince.
 */
import * as path from "node:path";
import {
  loadRatingStatesFromFirestore,
  ratingStatesOf,
  type StoredRatingState,
} from "./firestoreHistory.js";
import { readPreviousRuns, resultKey } from "./reportHistory.js";
import type { CheckResult, PdpCheckResult, Platform } from "./types.js";

export const RATING_DIVERGENCE_GRACE_MS = 24 * 60 * 60 * 1000;
/**
 * Age from which a divergence fails. A bit under the 1-day grace: the monitor runs once a day,
 * and the next day's run can reach the SKU a few minutes earlier than the previous one (cron
 * delay, concurrency), which with a strict "> 24h" would leave it as a warning until the third
 * day.
 */
export const RATING_DIVERGENCE_FAIL_AFTER_MS = 20 * 60 * 60 * 1000;
type ResultKey = Pick<PdpCheckResult, "sku" | "vendor" | "country" | "channel">;

export const ratingResultKey = resultKey;

/** The SKU's ratingConsistency in its latest previous run. */
export interface PreviousRatingState {
  runTimestamp: string;
  /** Set when that run already saw the divergence. */
  divergentSince?: string;
}

/** Whether a previous result was a divergence, including reports from before `divergent` existed. */
function divergentSinceOf(feature: CheckResult, runTimestamp: string): string | undefined {
  const details = feature.details ?? {};
  if (typeof details.divergentSince === "string") {
    return details.divergentSince;
  }
  if (details.divergent === true || /^Inconsistência:/.test(feature.message)) {
    return runTimestamp;
  }
  return undefined;
}

/**
 * Whether the result actually compared the product rating with Konfidency's: a divergence or a
 * pass. Others (no reviews, product rating not captured, N/A, disabled, error) say nothing about
 * the divergence, so they must not reset since when it exists.
 */
export function isRatingComparison(feature: CheckResult): boolean {
  return feature.status === "pass" || divergentSinceOf(feature, "") !== undefined;
}

/**
 * Latest previous ratingConsistency state per SKU, from the platform's run index (newest runs
 * first). Missing files are skipped: a local checkout may not have every run.
 */
export function loadPreviousRatingStates(
  platform: Platform | undefined,
  reportsDir = path.join(process.cwd(), "docs", "reports"),
  excludeRunId?: string,
): Map<string, PreviousRatingState> {
  const states = new Map<string, PreviousRatingState>();
  for (const run of readPreviousRuns(platform, reportsDir, excludeRunId)) {
    for (const result of run.results) {
      const key = ratingResultKey(result);
      const feature = result.features?.find((f) => f.featureKey === "ratingConsistency");
      if (states.has(key) || !feature || !isRatingComparison(feature)) {
        continue;
      }
      const runTimestamp = result.timestamp ?? run.startTime ?? "";
      states.set(key, { runTimestamp, divergentSince: divergentSinceOf(feature, runTimestamp) });
    }
  }
  return states;
}

function formatAge(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  return hours >= 48 ? `${Math.floor(hours / 24)} dias` : `${hours}h`;
}

/**
 * Grades a divergent ratingConsistency (details.divergent): warning while the divergence is up
 * younger than RATING_DIVERGENCE_FAIL_AFTER_MS (the 1-day grace, see there), fail after that. The divergence started at the previous
 * run's divergentSince when that run was already divergent, else now. Other results are
 * returned as they are.
 */
export function applyRatingDivergenceGrace(
  feature: CheckResult,
  previous: PreviousRatingState | undefined,
  now: Date,
): CheckResult {
  if (feature.featureKey !== "ratingConsistency" || feature.details?.divergent !== true) {
    return feature;
  }
  const since = previous?.divergentSince ?? now.toISOString();
  const age = Math.max(0, now.getTime() - new Date(since).getTime());
  const sinceLabel = new Date(since).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const details = { ...feature.details, divergentSince: since, divergentForMs: age };
  if (age >= RATING_DIVERGENCE_FAIL_AFTER_MS) {
    return {
      ...feature,
      passed: false,
      status: "fail",
      message: `${feature.message} Divergente desde ${sinceLabel} (${formatAge(age)}): a nota da Konfidency não chegou ao SFCC em 1 dia.`,
      details,
    };
  }
  return {
    ...feature,
    passed: true,
    status: "warning",
    message: `${feature.message} ${previous?.divergentSince ? `Divergente desde ${sinceLabel} (${formatAge(age)})` : "Divergência vista pela 1ª vez"}: aguardando o SFCC atualizar com a nota da Konfidency (até 1 dia).`,
    details,
  };
}

const previousStatesCache = new Map<string, Map<string, PreviousRatingState>>();

/**
 * Loads the platform's previous rating states before the SKUs are checked: the Firestore
 * `ratingStates` collection (see firestoreHistory.ts) merged over the run reports in docs/reports,
 * the newer of the two winning per SKU. The reports keep it working without Firestore and cover
 * SKUs Firestore doesn't have yet. Call once at the start of the run; gradeRatingDivergence falls
 * back to the reports alone when it wasn't called.
 */
export async function preloadRatingStates(platform: Platform = "web"): Promise<void> {
  const fromReports = (() => {
    try {
      return loadPreviousRatingStates(platform === "web" ? undefined : platform);
    } catch {
      return new Map<string, PreviousRatingState>();
    }
  })();
  const fromFirestore = await loadRatingStatesFromFirestore(platform);
  for (const [key, state] of fromFirestore ?? []) {
    const current = fromReports.get(key);
    if (!current || state.runTimestamp >= current.runTimestamp) {
      fromReports.set(key, { runTimestamp: state.runTimestamp, divergentSince: state.divergentSince });
    }
  }
  if (fromFirestore) {
    console.log(`📚 Histórico da nota: ${fromFirestore.size} SKU(s) do Firestore, ${fromReports.size} no total`);
  }
  previousStatesCache.set(platform, fromReports);
}

/**
 * Grades the divergent ratingConsistency in a SKU's features (see applyRatingDivergenceGrace).
 * The platform's previous runs are read once per process; the current run isn't in the index
 * yet while its SKUs are checked.
 */
export function gradeRatingDivergence(
  features: CheckResult[],
  sku: ResultKey,
  platform: Platform = "web",
  now = new Date(),
): CheckResult[] {
  if (!features.some((f) => f.details?.divergent === true)) {
    return features;
  }
  try {
    let previous = previousStatesCache.get(platform);
    if (!previous) {
      previous = loadPreviousRatingStates(platform === "web" ? undefined : platform);
      previousStatesCache.set(platform, previous);
    }
    const state = previous.get(ratingResultKey(sku));
    return features.map((f) => applyRatingDivergenceGrace(f, state, now));
  } catch (err) {
    // The history only softens a divergence: never lose the SKU's results over it
    console.warn(`   ⚠️ Histórico de divergência de nota indisponível: ${(err as Error).message}`);
    return features;
  }
}

/** This run's rating states to store, skipping SKUs whose result didn't compare the ratings. */
export function currentRatingStates(results: PdpCheckResult[], platform: Platform): StoredRatingState[] {
  return ratingStatesOf(results, platform, ratingResultKey, isRatingComparison);
}
