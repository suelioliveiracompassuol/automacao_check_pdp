import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { PdpCheckResult } from './types';
import { basePath } from './config';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getOperationKey(result: PdpCheckResult): string {
  const channel = result.channel || 'ecommerce';
  return `${result.vendor}-${result.country}${channel === 'socialcommerce' ? '-social' : ''}`;
}

export function getCountryFlag(country: string): string {
  return `https://flagcdn.com/20x15/${country.toLowerCase()}.png`;
}

/**
 * Build the URL for a file of a monitor run (e.g. "screenshots/FILE.png").
 * In production (GitHub Pages), reports are served from /reports/{runId}/...
 */
export function getScreenshotUrl(runId: string, path: string): string {
  return `${basePath}/reports/${runId}/${path}`;
}

/** URL de um arquivo de docs/perf publicado no Pages (ex.: "run_1/NATBRA-1.json"). */
export function getPerfFileUrl(path: string): string {
  return `${basePath}/perf/${path}`;
}

/** Nome do arquivo ao baixar um relatório: "run_1/NATBRA-1.json" → "lighthouse_run_1_NATBRA-1.json". */
export function perfReportDownloadName(path: string): string {
  return `lighthouse_${path.replace(/\//g, '_')}`;
}
