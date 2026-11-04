/**
 * Device farm capacity (LambdaTest): how many mobile sessions the organization can still open.
 *
 * The concurrency limit is shared by everyone in the LambdaTest organization (e.g. other teams'
 * HML suites). A session requested while it's full waits in LambdaTest's queue for about 2 min
 * and is cancelled ("Concurrency limit reached"), and webdriver retries the request, so a busy
 * farm cost ~8 min per session and then lost its SKUs. The Android orchestrator therefore asks
 * for the free slots first: it only opens the sessions that fit and waits (bounded) for a slot.
 */
const LAMBDATEST_MOBILE_CONCURRENCY_URL =
  "https://mobile-api.lambdatest.com/mobile-automation/api/v1/org/concurrency";

export interface DeviceFarmCapacity {
  max: number;
  running: number;
  queued: number;
}

/** Sessions that can start right now (queued requests take slots first). */
export function freeSlots(capacity: DeviceFarmCapacity): number {
  return Math.max(0, capacity.max - capacity.running - capacity.queued);
}

/**
 * The LambdaTest organization's mobile concurrency, or null when it can't be read (another
 * provider, no credentials, API error): callers then proceed as if there was room.
 */
export async function fetchDeviceFarmCapacity(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<DeviceFarmCapacity | null> {
  // Same default as getDeviceFarmProvider (deviceSetup.ts), read here so this stays webdriver-free
  if (
    (env.DEVICE_FARM_PROVIDER || "lambdatest").toLowerCase() !== "lambdatest"
  ) {
    return null;
  }
  const user = env.LAMBDATEST_USERNAME;
  const key = env.LAMBDATEST_ACCESS_KEY;
  if (!user || !key) {
    return null;
  }
  try {
    const response = await fetchImpl(LAMBDATEST_MOBILE_CONCURRENCY_URL, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${user}:${key}`).toString("base64")}`,
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as {
      data?: { max_concurrency?: unknown; running?: unknown; queued?: unknown };
    };
    const { max_concurrency: max, running, queued } = body.data ?? {};
    if (typeof max !== "number" || typeof running !== "number") {
      return null;
    }
    return { max, running, queued: typeof queued === "number" ? queued : 0 };
  } catch {
    return null;
  }
}

/** How long a session waits for a free slot: ANDROID_SLOT_WAIT_MINUTES, default 10. */
export function parseSlotWaitMs(env: NodeJS.ProcessEnv = process.env): number {
  const minutes = Number.parseFloat(env.ANDROID_SLOT_WAIT_MINUTES ?? "10");
  return (Number.isFinite(minutes) && minutes >= 0 ? minutes : 10) * 60_000;
}

export type SlotWaitOutcome = "free" | "unknown" | "timeout" | "stopped";

/**
 * Waits until the farm has a free slot, polling its capacity. Returns "unknown" right away when
 * the capacity can't be read, "stopped" as soon as `shouldStop` says the slot isn't needed any
 * more (e.g. the other sessions already took every SKU), and "timeout" after `maxWaitMs`.
 */
export async function waitForDeviceFarmSlot(opts: {
  label: string;
  maxWaitMs: number;
  pollMs?: number;
  shouldStop?: () => boolean;
  getCapacity?: () => Promise<DeviceFarmCapacity | null>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}): Promise<SlotWaitOutcome> {
  const {
    label,
    maxWaitMs,
    pollMs = 30_000,
    shouldStop = () => false,
    getCapacity = () => fetchDeviceFarmCapacity(),
    sleep = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms)),
    now = Date.now,
  } = opts;
  const deadline = now() + maxWaitMs;
  let logged = false;
  for (;;) {
    if (shouldStop()) {
      return "stopped";
    }
    const capacity = await getCapacity();
    if (!capacity) {
      return "unknown";
    }
    if (freeSlots(capacity) > 0) {
      if (logged) {
        console.log(`   ✓ ${label}: vaga livre no device farm`);
      }
      return "free";
    }
    if (now() >= deadline) {
      console.warn(
        `   ⚠️ ${label}: device farm ainda cheio após ${Math.round(maxWaitMs / 60_000)} min, tentando abrir mesmo assim`,
      );
      return "timeout";
    }
    if (!logged) {
      console.log(
        `   ⏳ ${label}: device farm cheio (${capacity.running}/${capacity.max} sessões da organização em uso, ${capacity.queued} na fila), aguardando vaga...`,
      );
      logged = true;
    }
    await sleep(Math.min(pollMs, Math.max(0, deadline - now())));
  }
}
