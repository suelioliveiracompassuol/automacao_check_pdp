/**
 * Android session-chunking utilities
 *
 * Pure helpers shared by the Android orchestrator (index.android.ts) and its unit tests.
 * Kept in their own module (mirroring concurrency.ts for the Web orchestrator) so tests can
 * import them without pulling in index.android.ts, which runs main() unconditionally at import
 * time.
 */

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
