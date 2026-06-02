/**
 * Optional Playwright tracing for Node-driven scripts (not playwright.config test runs).
 *
 * Env:
 * - PLAYWRIGHT_TRACE=off (default) — no trace
 * - PLAYWRIGHT_TRACE=on-failure — record; save .zip only when the run did not succeed
 * - PLAYWRIGHT_TRACE=always — always save trace per browser context session
 * - PLAYWRIGHT_TRACE_SOURCES=false — omit source maps from trace (smaller files)
 */

import * as fs from "fs/promises";
import * as path from "path";
import type { BrowserContext } from "@playwright/test";

export type PlaywrightTraceMode = "off" | "on-failure" | "always";

export function getPlaywrightTraceMode(): PlaywrightTraceMode {
  const raw = process.env.PLAYWRIGHT_TRACE?.trim().toLowerCase() ?? "";
  if (!raw || raw === "0" || raw === "false" || raw === "off" || raw === "no") {
    return "off";
  }
  if (raw === "always" || raw === "all" || raw === "true" || raw === "1") {
    return "always";
  }
  if (
    raw === "on-failure" ||
    raw === "failure" ||
    raw === "failures" ||
    raw === "retain-on-failure"
  ) {
    return "on-failure";
  }
  return "off";
}

export function describePlaywrightTraceMode(mode: PlaywrightTraceMode): string {
  if (mode === "off") {
    return "desligado";
  }
  if (mode === "always") {
    return "sempre gravar";
  }
  return "gravar só em falha";
}

/**
 * Starts tracing on the context. Returns whether tracing is active (caller must finalize).
 */
export async function startBrowserTraceIfEnabled(
  context: BrowserContext,
  mode: PlaywrightTraceMode,
): Promise<boolean> {
  if (mode === "off") {
    return false;
  }
  const sources = process.env.PLAYWRIGHT_TRACE_SOURCES !== "false";
  await context.tracing.start({
    screenshots: true,
    snapshots: true,
    sources,
  });
  return true;
}

/**
 * Stops tracing. Persists to disk when mode is "always", or when mode is "on-failure" and runSucceeded is false.
 * Pass hadStarted=false to no-op (safe if start was skipped).
 */
export async function finalizeBrowserTrace(
  context: BrowserContext,
  mode: PlaywrightTraceMode,
  hadStarted: boolean,
  /** true when checks completed without overall failure */
  runSucceeded: boolean,
  traceZipPath: string,
): Promise<string | undefined> {
  if (!hadStarted || mode === "off") {
    return undefined;
  }

  const persist = mode === "always" || (mode === "on-failure" && !runSucceeded);

  try {
    if (persist) {
      await fs.mkdir(path.dirname(traceZipPath), { recursive: true });
      await context.tracing.stop({ path: traceZipPath });
      return traceZipPath;
    }
    await context.tracing.stop();
    return undefined;
  } catch {
    return undefined;
  }
}
