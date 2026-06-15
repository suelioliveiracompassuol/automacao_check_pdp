import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Status, PdpCheckResult } from "./types";
import { basePath } from "./config";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${minutes}m ${secs}s`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

export function getStatusColor(status: Status): string {
  const colors: Record<Status, string> = {
    pass: "text-emerald-600 bg-emerald-50",
    fail: "text-red-600 bg-red-50",
    error: "text-amber-600 bg-amber-50",
    warning: "text-amber-600 bg-amber-50",
    disabled: "text-gray-500 bg-gray-100",
    na: "text-gray-400 bg-gray-50",
  };
  return colors[status] || "text-gray-500 bg-gray-50";
}

export function getStatusIcon(status: Status): string {
  const icons: Record<Status, string> = {
    pass: "✅",
    fail: "❌",
    error: "⚠️",
    warning: "⚠️",
    disabled: "🚫",
    na: "➖",
  };
  return icons[status] || "❓";
}

export function getOperationKey(result: PdpCheckResult): string {
  const channel = result.channel || "ecommerce";
  return `${result.vendor}-${result.country}${channel === "socialcommerce" ? "-social" : ""}`;
}

export function groupByOperation(
  results: PdpCheckResult[],
): Map<string, PdpCheckResult[]> {
  const map = new Map<string, PdpCheckResult[]>();
  for (const r of results) {
    const key = getOperationKey(r);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return map;
}

export function getCountryFlag(country: string): string {
  return `https://flagcdn.com/20x15/${country.toLowerCase()}.png`;
}

/**
 * Build the URL for a screenshot file.
 * In production (GitHub Pages), screenshots are served from /reports/{runId}/...
 * In dev, Next.js rewrites proxy /reports/ to the local docs folder.
 */
export function getScreenshotUrl(runId: string, path: string): string {
  // path comes as "screenshots/FILE.png" from the report data
  return `${basePath}/reports/${runId}/${path}`;
}
