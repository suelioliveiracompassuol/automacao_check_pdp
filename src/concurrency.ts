/**
 * Concurrency utilities
 *
 * Lightweight helpers shared by the main monitor (index.ts) and the
 * standalone exploratory-journey script (explore.ts).
 */

/**
 * Run an array of async tasks with a maximum concurrency limit.
 * Results are returned in the same order as the input tasks, regardless
 * of completion order.
 *
 * @param tasks   Array of zero-argument async factories.
 * @param limit   Maximum number of tasks running simultaneously.
 */
export async function runWithConcurrency<T>(
  tasks: ReadonlyArray<() => Promise<T>>,
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < tasks.length) {
      const i = next++;
      try {
        results[i] = await tasks[i]();
      } catch (e) {
        console.error(`Task ${i} failed:`, e);
        // We cast the error to unknown then T to satisfy the generic type T,
        // assuming the caller handles error objects or the task returns a specific error shape.
        // In the context of this project, tasks usually return PdpCheckResult or an array of them.
        // The caller (index.ts/explore.ts) should ideally handle these rejected promises,
        // but to prevent the whole worker pool from crashing, we catch and return the error.
        results[i] = {
          success: false,
          error: e instanceof Error ? e.message : String(e),
          features: [],
        } as unknown as T;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, worker),
  );
  return results;
}

/**
 * Return a promise that resolves after a random delay in the range
 * [minMs, minMs + rangeMs).  Use rangeMs = 0 for a fixed delay.
 *
 * Intended as a jitter helper to spread requests across time and reduce
 * the probability of triggering WAF / rate-limit rules.
 */
export function jitter(minMs: number, rangeMs: number): Promise<void> {
  const delay = minMs + Math.floor(Math.random() * Math.max(1, rangeMs));
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Parse the CONCURRENCY environment variable and return a safe value.
 * Defaults to 3; hard-capped at 8 to reduce WAF/rate-limit risk.
 */
export function parseConcurrency(defaultValue = 3): number {
  const raw = Number.parseInt(
    process.env.CONCURRENCY ?? String(defaultValue),
    10,
  );
  return Math.min(Math.max(1, Number.isNaN(raw) ? defaultValue : raw), 8);
}
