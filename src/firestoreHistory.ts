/**
 * Run history kept in Firestore (free Spark tier: small documents, a handful of writes per run),
 * so it doesn't depend on the report files CI commits to the branch:
 *
 * - `ratingStates/{platform}|{vendor}|{country}|{channel}|{sku}`: the SKU's latest
 *   ratingConsistency state ({ runTimestamp, divergentSince? }), read by ratingDivergence.ts to
 *   know since when the product rating (SFCC) diverges from Konfidency's.
 * - `runs/{runId}`: the run's index entry plus a compact summary of every SKU (feature key, name,
 *   status and a trimmed message; no details or screenshots), which the dashboard merges with
 *   docs/reports at build time.
 *
 * Reads need the Firebase Admin credentials (FIREBASE_PROJECT_ID, same as the SKU loader).
 * Writes also need CI (GITHUB_ACTIONS=true) or FIRESTORE_HISTORY=true: local runs (smoke,
 * filtered, headed) must not land in the published history nor override CI's rating states.
 * FIRESTORE_HISTORY=false turns both off. Every call is best effort: a Firestore failure is
 * logged and the run goes on with the files in docs/reports.
 */
import type { ReportIndexEntry } from "./reportIndex.js";
import type { CheckResult, MonitoringReport, PdpCheckResult, Platform } from "./types.js";

export const RATING_STATES_COLLECTION = "ratingStates";
export const RUNS_COLLECTION = "runs";
/** Older run summaries are deleted (keeps the collection far below the free 1 GiB). */
export const RUN_RETENTION_DAYS = 180;
const MAX_MESSAGE_CHARS = 300;
/** Firestore's document limit is 1 MiB; leave room for field names/encoding overhead. */
const MAX_RUN_DOC_BYTES = 900_000;
const MAX_BATCH_OPS = 400;

export interface StoredRatingState {
  platform: Platform;
  key: string;
  runTimestamp: string;
  divergentSince?: string;
}

export interface RunSummaryFeature {
  featureKey?: string;
  feature: string;
  status?: string;
  passed: boolean;
  message?: string;
}

export interface RunSummaryResult {
  sku: string;
  name: string;
  url: string;
  vendor: string;
  country: string;
  channel?: string;
  platform?: Platform;
  timestamp: string;
  success: boolean;
  loadTime?: number;
  error?: string;
  features: RunSummaryFeature[];
}

export interface RunSummaryDoc extends ReportIndexEntry {
  platform: Platform;
  results: RunSummaryResult[];
}

export function firestoreHistoryEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.FIREBASE_PROJECT_ID) && env.FIRESTORE_HISTORY !== "false";
}

/** Whether this run may write the history (CI, or FIRESTORE_HISTORY=true locally). */
export function firestoreHistoryWritable(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    firestoreHistoryEnabled(env) &&
    (env.GITHUB_ACTIONS === "true" || env.FIRESTORE_HISTORY === "true")
  );
}

export function ratingStateDocId(platform: Platform, key: string): string {
  // Firestore ids can't contain "/"
  return `${platform}|${key}`.replace(/\//g, "_");
}

function trim(message: string | undefined): string | undefined {
  if (!message) {
    return undefined;
  }
  return message.length > MAX_MESSAGE_CHARS ? `${message.slice(0, MAX_MESSAGE_CHARS - 1)}…` : message;
}

/** Firestore rejects `undefined` fields: drop them. */
function compact<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

/** The run's index entry plus each SKU's feature statuses, small enough for one document. */
export function buildRunSummary(
  report: MonitoringReport,
  entry: ReportIndexEntry,
  platform: Platform,
): RunSummaryDoc {
  const build = (withMessages: boolean): RunSummaryDoc =>
    compact({
      ...entry,
      platform,
      results: report.results.map((r: PdpCheckResult) =>
        compact({
          sku: r.sku,
          name: r.name,
          url: r.url,
          vendor: r.vendor,
          country: r.country,
          channel: r.channel,
          platform: r.platform ?? platform,
          timestamp: r.timestamp,
          success: r.success,
          loadTime: r.loadTime,
          error: trim(r.error),
          features: r.features.map((f) =>
            compact({
              featureKey: f.featureKey,
              feature: f.feature,
              status: f.status,
              passed: f.passed,
              message: withMessages ? trim(f.message) : undefined,
            }),
          ),
        }),
      ),
    });
  const full = build(true);
  return Buffer.byteLength(JSON.stringify(full), "utf-8") <= MAX_RUN_DOC_BYTES ? full : build(false);
}

/**
 * Each SKU's ratingConsistency state in this run. Results `isComparison` rejects (the ratings
 * weren't compared) are skipped, so the stored state, and its divergentSince, is kept.
 */
export function ratingStatesOf(
  results: PdpCheckResult[],
  platform: Platform,
  keyOf: (r: PdpCheckResult) => string,
  isComparison: (feature: CheckResult) => boolean,
): StoredRatingState[] {
  const states: StoredRatingState[] = [];
  for (const r of results) {
    const feature = r.features.find((f) => f.featureKey === "ratingConsistency");
    if (!feature || !isComparison(feature)) {
      continue;
    }
    const since = feature.details?.divergent === true ? feature.details.divergentSince : undefined;
    states.push(
      compact({
        platform,
        key: keyOf(r),
        runTimestamp: r.timestamp,
        divergentSince: typeof since === "string" ? since : undefined,
      }),
    );
  }
  return states;
}

async function getDb() {
  const { db } = await import("./firebase.js");
  return db;
}

/** The platform's stored rating states by result key, or null when Firestore isn't available. */
export async function loadRatingStatesFromFirestore(
  platform: Platform,
): Promise<Map<string, StoredRatingState> | null> {
  if (!firestoreHistoryEnabled()) {
    return null;
  }
  try {
    const db = await getDb();
    const snapshot = await db
      .collection(RATING_STATES_COLLECTION)
      .where("platform", "==", platform)
      .get();
    const states = new Map<string, StoredRatingState>();
    for (const doc of snapshot.docs) {
      const data = doc.data() as StoredRatingState;
      if (typeof data.key === "string" && typeof data.runTimestamp === "string") {
        states.set(data.key, data);
      }
    }
    return states;
  } catch (err) {
    console.warn(`   ⚠️ Firestore: estado da nota não lido (${(err as Error).message}); usando os relatórios em docs/reports`);
    return null;
  }
}

/** Replaces each SKU's stored state with this run's (a consistent run clears divergentSince). */
export async function saveRatingStates(states: StoredRatingState[]): Promise<void> {
  if (!firestoreHistoryWritable() || states.length === 0) {
    return;
  }
  try {
    const db = await getDb();
    for (let i = 0; i < states.length; i += MAX_BATCH_OPS) {
      const batch = db.batch();
      for (const state of states.slice(i, i + MAX_BATCH_OPS)) {
        batch.set(db.collection(RATING_STATES_COLLECTION).doc(ratingStateDocId(state.platform, state.key)), state);
      }
      await batch.commit();
    }
    console.log(`✅ Firestore: estado da nota gravado para ${states.length} SKU(s)`);
  } catch (err) {
    console.warn(`⚠️ Firestore: estado da nota não gravado (${(err as Error).message})`);
  }
}

/**
 * Records a finished run: each SKU's rating state (see currentRatingStates in
 * ratingDivergence.ts) and the run summary. Only in CI or with FIRESTORE_HISTORY=true.
 */
export async function recordRunInFirestore(
  report: MonitoringReport,
  entry: ReportIndexEntry,
  platform: Platform,
  ratingStates: StoredRatingState[],
): Promise<void> {
  if (!firestoreHistoryWritable()) {
    if (firestoreHistoryEnabled()) {
      console.log("ℹ️  Firestore: histórico não gravado fora do CI (FIRESTORE_HISTORY=true para gravar)");
    }
    return;
  }
  await saveRatingStates(ratingStates);
  await saveRunSummary(buildRunSummary(report, entry, platform));
  await deleteOldRunSummaries();
}

/** Saves the run summary. */
export async function saveRunSummary(summary: RunSummaryDoc): Promise<void> {
  if (!firestoreHistoryWritable()) {
    return;
  }
  try {
    const db = await getDb();
    await db.collection(RUNS_COLLECTION).doc(summary.runId).set(summary);
    console.log(`✅ Firestore: resumo do run ${summary.runId} gravado`);
  } catch (err) {
    console.warn(`⚠️ Firestore: resumo do run não gravado (${(err as Error).message})`);
  }
}

/**
 * Deletes run summaries (of every platform: the retention is the same) older than
 * RUN_RETENTION_DAYS, at most MAX_BATCH_OPS per call; a daily run removes about one a day.
 */
export async function deleteOldRunSummaries(now = new Date()): Promise<void> {
  if (!firestoreHistoryWritable()) {
    return;
  }
  try {
    const db = await getDb();
    const cutoff = new Date(now.getTime() - RUN_RETENTION_DAYS * 86_400_000).toISOString();
    const old = await db
      .collection(RUNS_COLLECTION)
      .where("startTime", "<", cutoff)
      .limit(MAX_BATCH_OPS)
      .get();
    if (old.empty) {
      return;
    }
    const batch = db.batch();
    old.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    console.log(`   🧹 Firestore: ${old.size} resumo(s) de run com mais de ${RUN_RETENTION_DAYS} dias removido(s)`);
  } catch (err) {
    console.warn(`⚠️ Firestore: limpeza de resumos antigos falhou (${(err as Error).message})`);
  }
}
