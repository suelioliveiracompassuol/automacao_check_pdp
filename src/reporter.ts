/**
 * Report Generator
 *
 * Generates the JSON report of a run (report.json). The dashboard renders it; there is no
 * HTML report.
 */

import { MonitoringReport } from "./types.js";

/**
 * Generate JSON report
 */
export function generateJsonReport(report: MonitoringReport): string {
  const normalizedReport = {
    ...report,
    results: report.results.map((result) => ({
      ...result,
      remoteConfigFlags: result.remoteConfigFlags ?? null,
      commerceFeatureFlags: result.commerceFeatureFlags ?? null,
    })),
  };

  return JSON.stringify(normalizedReport, null, 2);
}
