/**
 * Android session-chunking utilities
 *
 * Pure helpers shared by the Android orchestrator (index.android.ts) and its unit tests.
 * Kept in their own module (mirroring concurrency.ts for the Web orchestrator) so tests can
 * import them without pulling in index.android.ts, which runs main() unconditionally at import
 * time.
 */
import type { SkuConfig } from "./types.js";
import {
  AndroidSessionTarget,
  findAndroidApp,
} from "./checks-android/configs/apps.js";

/** Splits `items` round-robin across `numChunks` groups, dropping empty groups (e.g. more sessions than SKUs). */
export function distributeIntoChunks<T>(items: T[], numChunks: number): T[][] {
  const chunks: T[][] = Array.from({ length: numChunks }, () => []);
  items.forEach((item, i) => chunks[i % numChunks].push(item));
  return chunks.filter((chunk) => chunk.length > 0);
}

/** ANDROID_CONCURRENCY = how many device sessions run in parallel; default 2, hard-capped at 5 (device farm plans usually limit concurrent sessions). */
export function parseAndroidConcurrency(maxTasks: number): number {
  const raw = Number.parseInt(process.env.ANDROID_CONCURRENCY ?? "2", 10);
  const bounded = Math.min(Math.max(1, Number.isNaN(raw) ? 2 : raw), 5);
  return Math.min(bounded, maxTasks);
}

export interface AndroidSessionPlan extends AndroidSessionTarget {
  skus: SkuConfig[];
}

/**
 * Groups SKUs into device sessions: a session runs one app with the device set to one country,
 * so SKUs are grouped by app + country first. The `concurrency` budget is shared across groups
 * (with a single group this is the same round-robin split as before). SKUs no app covers are
 * returned in `unsupported`.
 */
export function planAndroidSessions(
  skus: SkuConfig[],
  concurrency: number,
): { plans: AndroidSessionPlan[]; unsupported: SkuConfig[] } {
  const groups = new Map<string, AndroidSessionPlan>();
  const unsupported: SkuConfig[] = [];
  for (const sku of skus) {
    const app = findAndroidApp(sku);
    if (!app) {
      unsupported.push(sku);
      continue;
    }
    const key = `${app.key}|${sku.country}`;
    const group = groups.get(key) ?? {
      app,
      country: sku.country,
      skus: [],
    };
    group.skus.push(sku);
    groups.set(key, group);
  }

  const chunksPerGroup = Math.max(1, Math.floor(concurrency / groups.size));
  const plans = [...groups.values()].flatMap((group) =>
    distributeIntoChunks(group.skus, chunksPerGroup).map((chunk) => ({
      ...group,
      skus: chunk,
    })),
  );
  return { plans, unsupported };
}

/** SKUs of one app + country, taken one at a time by the sessions that manage to open. */
export interface SkuQueue {
  take(): SkuConfig | undefined;
  size(): number;
}

export function createSkuQueue(skus: SkuConfig[]): SkuQueue {
  const pending = [...skus];
  return {
    take: () => pending.shift(),
    size: () => pending.length,
  };
}

/** One app + country: its SKU queue and how many sessions may work on it in parallel. */
export interface AndroidSessionGroup extends AndroidSessionTarget {
  queue: SkuQueue;
  skus: SkuConfig[];
  sessions: number;
}

/**
 * Groups SKUs by app + country (one session can't mix them) and gives each group a share of the
 * `concurrency` budget, never more sessions than SKUs. Unlike fixed chunks, the sessions of a
 * group share its queue: one the farm doesn't open leaves its SKUs to the others, and a faster
 * one takes more.
 */
export function planAndroidSessionGroups(
  skus: SkuConfig[],
  concurrency: number,
): { groups: AndroidSessionGroup[]; unsupported: SkuConfig[] } {
  const { plans, unsupported } = planAndroidSessions(skus, concurrency);
  const groups = new Map<string, AndroidSessionGroup>();
  for (const plan of plans) {
    const key = `${plan.app.key}|${plan.country}`;
    const group = groups.get(key);
    if (group) {
      group.skus.push(...plan.skus);
      group.sessions += 1;
    } else {
      groups.set(key, {
        app: plan.app,
        country: plan.country,
        skus: [...plan.skus],
        sessions: 1,
        queue: createSkuQueue([]),
      });
    }
  }
  // Keep the input order (the chunks were filled round-robin)
  const order = new Map(skus.map((sku, i) => [sku, i]));
  return {
    groups: [...groups.values()].map((g) => {
      const ordered = [...g.skus].sort(
        (a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0),
      );
      return { ...g, skus: ordered, queue: createSkuQueue(ordered) };
    }),
    unsupported,
  };
}
