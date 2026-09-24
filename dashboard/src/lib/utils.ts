import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Status, PdpCheckResult } from './types';
import { basePath } from './config';

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
  return new Date(iso).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'America/Sao_Paulo',
  });
}

export function getStatusColor(status: Status): string {
  const colors: Record<Status, string> = {
    pass: 'text-success-dark bg-success-lightest/50',
    fail: 'text-alert-dark bg-alert-lightest/50',
    error: 'text-warning-darkest bg-warning-lightest/50',
    warning: 'text-warning-darkest bg-warning-lightest/50',
    disabled: 'text-medium-emphasis bg-neutral-75',
    na: 'text-low-emphasis bg-neutral-50',
  };
  return colors[status] || 'text-medium-emphasis bg-neutral-50';
}

export function getStatusIcon(status: Status): string {
  const icons: Record<Status, string> = {
    pass: '✅',
    fail: '❌',
    error: '⚠️',
    warning: '⚠️',
    disabled: '🚫',
    na: '➖',
  };
  return icons[status] || '❓';
}

export function getOperationKey(result: PdpCheckResult): string {
  const channel = result.channel || 'ecommerce';
  return `${result.vendor}-${result.country}${channel === 'socialcommerce' ? '-social' : ''}`;
}

export function groupByOperation(results: PdpCheckResult[]): Map<string, PdpCheckResult[]> {
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
