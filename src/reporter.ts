/**
 * Report Generator
 *
 * Generates HTML and JSON reports from monitoring results
 */

import * as fs from "node:fs";
import * as nodePath from "node:path";
import {
  MonitoringReport,
  PdpCheckResult,
  CheckResult,
  RemoteConfigFlags,
  CommerceFeatureFlags,
} from "./types.js";
import {
  getFlagsByCategory,
  countCapturedFlags,
  getCommerceFlagsByCategory,
  countCommerceFlags,
} from "./checks/remoteConfig.js";

/**
 * Read a screenshot file (relative to outputDir) and return a base64 data URI,
 * or null if the file cannot be read.
 */
function screenshotToDataUri(
  relPath: string,
  outputDir: string,
): string | null {
  try {
    const absPath = nodePath.isAbsolute(relPath)
      ? relPath
      : nodePath.join(outputDir, relPath);
    if (fs.existsSync(absPath)) {
      const ext = nodePath.extname(absPath).toLowerCase().slice(1) || "png";
      const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
      const base64 = fs.readFileSync(absPath).toString("base64");
      return `data:${mime};base64,${base64}`;
    }
  } catch {
    // ignore read errors — fall back to relative path
  }
  return null;
}

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

/**
 * Generate HTML report
 */
export function generateHtmlReport(
  report: MonitoringReport,
  outputDir?: string,
): string {
  const { summary, results, startTime, durationMs, runId } = report;

  const flag = (country: string) =>
    `<img src="https://flagcdn.com/20x15/${country.toLowerCase()}.png" alt="${country}" style="vertical-align:middle;margin-right:2px" width="20" height="15">`;

  const statusEmoji = (passed: boolean, status: string) => {
    if (status === "na") return "⬜";
    if (status === "error") return "⚠️";
    if (status === "disabled") return "🚫";
    if (status === "warning") return "⚠️";
    return passed ? "✅" : "❌";
  };

  const statusClass = (passed: boolean, status: string) => {
    if (status === "na") return "status-na";
    if (status === "error") return "status-error";
    if (status === "disabled") return "status-disabled";
    if (status === "warning") return "status-warning";
    return passed ? "status-pass" : "status-fail";
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const REVIEW_RATING_KEYS = new Set([
    "reviews",
    "reviewFilter",
    "reviewSort",
    "reviewPhotos",
    "reviewRecommendation",
    "aiReviewSummary",
    "rating",
  ]);

  /**
   * Render a screenshot as an inline base64 thumbnail (if outputDir is
   * available and the file exists), or fall back to a plain relative link.
   */
  const renderScreenshot = (
    screenshotPath: string | undefined,
    thumbnail = true,
  ): string => {
    if (!screenshotPath) return "-";
    if (outputDir) {
      const dataUri = screenshotToDataUri(screenshotPath, outputDir);
      if (dataUri) {
        return thumbnail
          ? `<a href="${dataUri}" target="_blank"><img src="${dataUri}" style="max-width:80px;max-height:50px;border-radius:4px;cursor:pointer;vertical-align:middle;border:1px solid #e5e7eb" alt="screenshot"></a>`
          : `<a href="${dataUri}" target="_blank">📷 Ver screenshot da página completa</a>`;
      }
    }
    // fallback to relative link (works when report is served from the same dir)
    return thumbnail
      ? `<a href="${screenshotPath}" target="_blank">📷</a>`
      : `<a href="${screenshotPath}" target="_blank">📷 Ver screenshot da página completa</a>`;
  };

  const generateFeatureRow = (feature: CheckResult) => {
    return `
    <tr class="${statusClass(feature.passed, feature.status)}">
      <td>${statusEmoji(feature.passed, feature.status)} ${feature.feature}</td>
      <td>${feature.message}</td>
      <td>${renderScreenshot(feature.screenshot)}</td>
    </tr>
  `;
  };

  const generateGroupedFeatures = (features: CheckResult[]) => {
    const reviewFeatures = features.filter((f) =>
      REVIEW_RATING_KEYS.has(f.featureKey),
    );
    const endpointFeatures = features.filter(
      (f) =>
        f.featureKey.startsWith("endpoint_") ||
        f.featureKey === "endpointResponse",
    );
    const otherFeatures = features.filter(
      (f) =>
        !REVIEW_RATING_KEYS.has(f.featureKey) &&
        !f.featureKey.startsWith("endpoint_") &&
        f.featureKey !== "endpointResponse",
    );

    const reviewPassCount = reviewFeatures.filter(
      (f) => f.passed || f.status === "warning" || f.status === "disabled",
    ).length;
    const reviewFailCount = reviewFeatures.filter(
      (f) =>
        !f.passed &&
        f.status !== "na" &&
        f.status !== "warning" &&
        f.status !== "disabled",
    ).length;
    const reviewDisabledCount = reviewFeatures.filter(
      (f) => f.status === "disabled",
    ).length;
    const reviewTotal = reviewFeatures.filter((f) => f.status !== "na").length;

    const endpointPassCount = endpointFeatures.filter(
      (f) => f.passed || f.status === "warning" || f.status === "disabled",
    ).length;
    const endpointFailCount = endpointFeatures.filter(
      (f) => !f.passed && f.status !== "na" && f.status !== "disabled",
    ).length;
    const endpointTotal = endpointFeatures.filter(
      (f) => f.status !== "na",
    ).length;

    const reviewGroupStatus = reviewFailCount > 0 ? "fail" : "pass";
    const reviewGroupEmoji = reviewFailCount > 0 ? "❌" : "✅";
    const endpointGroupStatus = endpointFailCount > 0 ? "fail" : "pass";
    const endpointGroupEmoji = endpointFailCount > 0 ? "❌" : "✅";

    let html = "";

    // Review & Rating group
    if (reviewFeatures.length > 0) {
      const disabledNote =
        reviewDisabledCount > 0
          ? `, ${reviewDisabledCount} desabilitado(s)`
          : "";
      html += `
        <tr class="feature-group-header status-${reviewGroupStatus} expanded" onclick="this.classList.toggle('expanded');var rows=this.parentElement.querySelectorAll('.group-review-rating');rows.forEach(function(r){r.classList.toggle('group-hidden')})" style="cursor:pointer">
          <td>${reviewGroupEmoji} ⭐ Avaliações & Rating <span class="group-toggle">▶</span> <span class="group-summary">(${reviewPassCount}/${reviewTotal} ok${disabledNote})</span></td>
          <td>${reviewFailCount > 0 ? `${reviewFailCount} falha(s)` : "Todas as sub-features ok"}</td>
          <td>-</td>
        </tr>
      `;
      for (const f of reviewFeatures) {
        html += `
        <tr class="group-review-rating ${statusClass(f.passed, f.status)}">
          <td style="padding-left:32px">${statusEmoji(f.passed, f.status)} ${f.feature}</td>
          <td>${f.message}</td>
          <td>${renderScreenshot(f.screenshot)}</td>
        </tr>
        `;
      }
    }

    // Endpoint monitoring group
    if (endpointFeatures.length > 0) {
      html += `
        <tr class="feature-group-header status-${endpointGroupStatus} expanded" onclick="this.classList.toggle('expanded');var rows=this.parentElement.querySelectorAll('.group-endpoint');rows.forEach(function(r){r.classList.toggle('group-hidden')})" style="cursor:pointer">
          <td>${endpointGroupEmoji} 🌐 Endpoints de API <span class="group-toggle">▶</span> <span class="group-summary">(${endpointPassCount}/${endpointTotal} ok)</span></td>
          <td>${endpointFailCount > 0 ? `${endpointFailCount} falha(s)` : "Todos os endpoints ok"}</td>
          <td>-</td>
        </tr>
      `;
      for (const f of endpointFeatures) {
        const bodyPreview = f.details?.bodyPreview
          ? `<br><code style="font-size:11px;color:#6b7280;word-break:break-all">${String(f.details.bodyPreview).slice(0, 300)}</code>`
          : "";
        const calls = Array.isArray(f.details?.calls)
          ? (
              f.details.calls as Array<{
                method: string;
                status: number;
                url: string;
              }>
            )
              .map(
                (c) =>
                  `<code style="font-size:11px">${c.method} ${c.status} ${new URL(c.url).pathname}</code>`,
              )
              .join("<br>")
          : "";
        html += `
        <tr class="group-endpoint ${statusClass(f.passed, f.status)}">
          <td style="padding-left:32px">${statusEmoji(f.passed, f.status)} ${f.feature}</td>
          <td>${f.message}${bodyPreview}${calls ? `<br><small>${calls}</small>` : ""}</td>
          <td>-</td>
        </tr>
        `;
      }
    }

    // Other features
    for (const f of otherFeatures) {
      html += generateFeatureRow(f);
    }

    return html;
  };

  const generateRemoteConfigSection = (
    flags: RemoteConfigFlags | undefined,
  ) => {
    if (!flags)
      return '<div class="remote-config-section"><em>Remote Config não capturado</em></div>';

    const categories = getFlagsByCategory(flags);
    const totalFlags = countCapturedFlags(flags);

    if (Object.keys(categories).length === 0) {
      return '<div class="remote-config-section"><em>Nenhuma flag capturada</em></div>';
    }

    const formatValue = (v: unknown): string => {
      if (v === true) return '<span class="flag-true">✓</span>';
      if (v === false) return '<span class="flag-false">✗</span>';
      if (v === undefined || v === null)
        return '<span class="flag-na">-</span>';
      return String(v);
    };

    let html = `
      <div class="remote-config-section">
        <details>
          <summary>🔧 Remote Config Flags (${totalFlags} capturadas) - locale: ${flags.locale}</summary>
          <div class="rc-categories">
    `;

    for (const [category, flagsInCategory] of Object.entries(categories)) {
      html += `
        <div class="rc-category">
          <h4>${category}</h4>
          <div class="rc-flags-grid">
      `;

      for (const [key, value] of Object.entries(flagsInCategory)) {
        html += `<div class="rc-flag"><code>${key}</code> ${formatValue(value)}</div>`;
      }

      html += `
          </div>
        </div>
      `;
    }

    html += `
          </div>
        </details>
      </div>
    `;

    return html;
  };

  const generateCommerceFeatureFlagsSection = (
    flags: CommerceFeatureFlags | undefined,
  ) => {
    if (!flags)
      return '<div class="remote-config-section commerce-flags"><em>Commerce Feature Flags não capturado</em></div>';

    const categories = getCommerceFlagsByCategory(flags);
    const totalFlags = countCommerceFlags(flags);

    if (Object.keys(categories).length === 0) {
      return '<div class="remote-config-section commerce-flags"><em>Nenhuma flag commerce capturada</em></div>';
    }

    const formatValue = (v: unknown): string => {
      if (v === true) return '<span class="flag-true">✓</span>';
      if (v === false) return '<span class="flag-false">✗</span>';
      if (v === undefined || v === null)
        return '<span class="flag-na">-</span>';
      return String(v);
    };

    let html = `
      <div class="remote-config-section commerce-flags">
        <details>
          <summary>🛒 Commerce Feature Flags (${totalFlags} capturadas)</summary>
          <div class="rc-categories">
    `;

    for (const [category, flagsInCategory] of Object.entries(categories)) {
      html += `
        <div class="rc-category">
          <h4>${category}</h4>
          <div class="rc-flags-grid">
      `;

      for (const [key, value] of Object.entries(flagsInCategory)) {
        html += `<div class="rc-flag"><code>${key}</code> ${formatValue(value)}</div>`;
      }

      html += `
          </div>
        </div>
      `;
    }

    html += `
          </div>
        </details>
      </div>
    `;

    return html;
  };

  const operations = new Map<
    string,
    {
      vendor: string;
      country: string;
      channel?: string;
      remoteConfigFlags?: RemoteConfigFlags;
      commerceFeatureFlags?: CommerceFeatureFlags;
    }
  >();

  for (const result of results) {
    const channel = result.channel ?? "ecommerce";
    const key = `${result.vendor}/${result.country}/${channel}`;
    if (!operations.has(key)) {
      operations.set(key, {
        vendor: result.vendor,
        country: result.country,
        channel,
        remoteConfigFlags: result.remoteConfigFlags,
        commerceFeatureFlags: result.commerceFeatureFlags,
      });
    } else {
      const op = operations.get(key)!;
      if (!op.remoteConfigFlags && result.remoteConfigFlags) {
        op.remoteConfigFlags = result.remoteConfigFlags;
      }
      if (!op.commerceFeatureFlags && result.commerceFeatureFlags) {
        op.commerceFeatureFlags = result.commerceFeatureFlags;
      }
    }
  }

  const generateOperationsFeatureFlags = () => {
    if (operations.size === 0) return "";

    let html = `<div class="operations-flags-container" style="margin-bottom: 24px;">
      <h2 style="font-size: 20px; margin-bottom: 16px;">🔧 Feature Flags por Operação</h2>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px;">
    `;

    for (const op of operations.values()) {
      const isSocialCommerce = op.channel === "socialcommerce";
      const title = isSocialCommerce
        ? `${op.vendor} / ${op.country} <span style="font-size:12px;color:#6b7280">(Minha Loja)</span>`
        : `${op.vendor} / ${op.country}`;
      const opKey = `${op.vendor}-${op.country}${isSocialCommerce ? "-social" : ""}`;
      html += `
        <div class="pdp-card" style="margin-bottom: 0;" data-operation="${opKey}" data-status="info">
          <div class="pdp-header" style="margin-bottom: 12px;">
            <div class="pdp-title">
              <h3 style="font-size: 16px; text-transform: capitalize;">${title}</h3>
            </div>
            <div class="pdp-meta">
              <span class="badge badge-vendor">${op.vendor}</span>
              <span class="badge badge-country">${flag(op.country)} ${op.country}</span>
              ${isSocialCommerce ? `<span class="badge" style="background:#f3e8ff;color:#7c3aed">Minha Loja</span>` : ""}
            </div>
          </div>
          ${generateRemoteConfigSection(op.remoteConfigFlags)}
          ${generateCommerceFeatureFlagsSection(op.commerceFeatureFlags)}
        </div>
      `;
    }

    html += `</div></div>`;
    return html;
  };

  const getOperationKey = (r: PdpCheckResult) => {
    const ch = r.channel ?? "ecommerce";
    return `${r.vendor}-${r.country}${ch === "socialcommerce" ? "-social" : ""}`;
  };

  const generatePdpCard = (result: PdpCheckResult) => `
    <div class="pdp-card ${result.success ? "success" : "failure"}" data-operation="${getOperationKey(result)}" data-status="${result.success ? "pass" : result.error ? "error" : "fail"}">
      <div class="pdp-header">
        <div class="pdp-title">
          <span class="pdp-status">${result.success ? "✅" : "❌"}</span>
          <h3>${result.name}</h3>
        </div>
        <div class="pdp-meta">
          <span class="badge badge-vendor">${result.vendor}</span>
          <span class="badge badge-country">${flag(result.country)} ${result.country}</span>
        </div>
      </div>

      <div class="pdp-info">
        <p><strong>SKU:</strong> ${result.sku}</p>
        <p><strong>URL:</strong> <a href="${result.url}" target="_blank">${result.url}</a></p>
        ${result.loadTime ? `<p><strong>Tempo de carga:</strong> ${formatDuration(result.loadTime)}</p>` : ""}
        ${result.error ? `<p class="error-message"><strong>Erro:</strong> ${result.error}</p>` : ""}
      </div>

      <table class="features-table">
        <thead>
          <tr>
            <th>Feature</th>
            <th>Status</th>
            <th>Screenshot</th>
          </tr>
        </thead>
        <tbody>
          ${generateGroupedFeatures(result.features)}
        </tbody>
      </table>

      ${
        result.pageScreenshot
          ? `
        <div class="page-screenshot">
          ${renderScreenshot(result.pageScreenshot, false)}
        </div>
      `
          : ""
      }
      ${
        result.playwrightTracePath
          ? `
        <div class="page-screenshot">
          <a href="${result.playwrightTracePath}" target="_blank">🎬 Trace Playwright (.zip)</a>
          <p style="margin-top:6px;font-size:12px;color:#6b7280">Abrir no terminal: <code style="background:#e5e7eb;padding:2px 6px;border-radius:4px">npx playwright show-trace</code> + caminho do arquivo</p>
        </div>
      `
          : ""
      }
    </div>
  `;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PDP Monitor Report - ${new Date(startTime).toLocaleDateString("pt-BR")}</title>
  <style>
    :root {
      --color-pass: #10b981;
      --color-fail: #ef4444;
      --color-warn: #f59e0b;
      --color-na: #6b7280;
      --color-bg: #f3f4f6;
      --color-card: #ffffff;
      --color-text: #1f2937;
      --color-border: #e5e7eb;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: var(--color-bg);
      color: var(--color-text);
      line-height: 1.6;
      padding: 20px;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    header {
      background: var(--color-card);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    header h1 {
      font-size: 24px;
      margin-bottom: 16px;
    }

    .run-info {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      font-size: 14px;
      color: #6b7280;
    }

    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .summary-card {
      background: var(--color-card);
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .summary-card.pass { border-left: 4px solid var(--color-pass); }
    .summary-card.fail { border-left: 4px solid var(--color-fail); }
    .summary-card.error { border-left: 4px solid var(--color-warn); }
    .summary-card.total { border-left: 4px solid #3b82f6; }

    .summary-number {
      font-size: 36px;
      font-weight: 700;
    }

    .summary-card.pass .summary-number { color: var(--color-pass); }
    .summary-card.fail .summary-number { color: var(--color-fail); }
    .summary-card.error .summary-number { color: var(--color-warn); }
    .summary-card.total .summary-number { color: #3b82f6; }

    .summary-label {
      font-size: 14px;
      color: #6b7280;
      margin-top: 4px;
    }

    .pdp-card {
      background: var(--color-card);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .pdp-card.success { border-left: 4px solid var(--color-pass); }
    .pdp-card.failure { border-left: 4px solid var(--color-fail); }

    .pdp-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 16px;
    }

    .pdp-title {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .pdp-title h3 {
      font-size: 18px;
    }

    .pdp-status {
      font-size: 24px;
    }

    .pdp-meta {
      display: flex;
      gap: 8px;
    }

    .badge {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .badge-ouro { background: #fef3c7; color: #92400e; }
    .badge-critico { background: #fee2e2; color: #991b1b; }
    .badge-vendor { background: #f3e8ff; color: #6b21a8; }
    .badge-country { background: #ecfdf5; color: #065f46; }

    .pdp-info {
      margin-bottom: 16px;
      font-size: 14px;
    }

    .pdp-info p {
      margin-bottom: 4px;
    }

    .pdp-info a {
      color: #3b82f6;
      text-decoration: none;
    }

    .pdp-info a:hover {
      text-decoration: underline;
    }

    .error-message {
      color: var(--color-fail);
      background: #fef2f2;
      padding: 8px 12px;
      border-radius: 6px;
      margin-top: 8px;
    }

    .features-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }

    .features-table th,
    .features-table td {
      padding: 10px 12px;
      text-align: left;
      border-bottom: 1px solid var(--color-border);
    }

    .features-table th {
      background: var(--color-bg);
      font-weight: 600;
    }

    .features-table tr:last-child td {
      border-bottom: none;
    }

    .status-pass { background: #f0fdf4; }
    .status-fail { background: #fef2f2; }
    .status-error { background: #fffbeb; }
    .status-na { background: #f9fafb; color: #9ca3af; }
    .status-disabled { background: #f3f4f6; color: #6b7280; }
    .status-warning { background: #fffbeb; }

    .flag-info {
      color: #6b7280;
      font-size: 11px;
      font-family: monospace;
    }

    .remote-config-section {
      margin-top: 8px;
      padding: 12px;
      background: #f3f4f6;
      border-radius: 8px;
      font-size: 12px;
    }

    .remote-config-section summary {
      cursor: pointer;
      font-weight: 600;
      color: #374151;
      font-size: 14px;
    }

    .remote-config-section .rc-flags {
      margin-top: 8px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .remote-config-section code {
      background: #e5e7eb;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 11px;
    }

    .rc-categories {
      margin-top: 12px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .rc-category {
      background: white;
      border-radius: 6px;
      padding: 10px;
      border: 1px solid #e5e7eb;
    }

    .rc-category h4 {
      margin: 0 0 8px 0;
      font-size: 13px;
      color: #4b5563;
    }

    .rc-flags-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 6px;
    }

    .rc-flag {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 8px;
      background: #f9fafb;
      border-radius: 4px;
      font-size: 11px;
    }

    .rc-flag code {
      color: #374151;
      background: transparent;
      padding: 0;
    }

    .flag-true {
      color: #059669;
      font-weight: bold;
    }

    .flag-false {
      color: #dc2626;
      font-weight: bold;
    }

    .flag-na {
      color: #9ca3af;
    }

    .page-screenshot {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid var(--color-border);
    }

    .page-screenshot a {
      color: #3b82f6;
      text-decoration: none;
    }

    .feature-group-header {
      font-weight: 600;
    }

    .feature-group-header td:first-child {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .group-toggle {
      font-size: 10px;
      transition: transform 0.2s;
      display: inline-block;
      margin: 0 4px;
      transform: rotate(90deg);
    }

    .feature-group-header:not(.expanded) .group-toggle {
      transform: rotate(0deg);
    }

    .group-summary {
      font-weight: 400;
      font-size: 12px;
      color: #6b7280;
    }

    .group-review-rating {
      display: table-row;
    }

    .group-review-rating.group-hidden {
      display: none;
    }

    .group-review-rating td:first-child {
      font-size: 13px;
    }

    .group-endpoint {
      display: table-row;
    }

    .group-endpoint.group-hidden {
      display: none;
    }

    .group-endpoint td:first-child {
      font-size: 13px;
    }

    footer {
      text-align: center;
      padding: 24px;
      color: #6b7280;
      font-size: 14px;
    }

    @media (max-width: 640px) {
      .pdp-header {
        flex-direction: column;
      }

      .summary {
        grid-template-columns: repeat(2, 1fr);
      }

      .filter-bar {
        flex-direction: column;
      }
    }

    /* ── Operation & Status Filters ── */
    .filter-section {
      background: var(--color-card);
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .filter-section h2 {
      font-size: 15px;
      margin-bottom: 12px;
      color: #374151;
    }

    .filter-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }

    .filter-bar-group {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }

    .filter-bar-separator {
      width: 1px;
      height: 24px;
      background: #d1d5db;
      margin: 0 8px;
    }

    .filter-btn {
      padding: 5px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      border: 2px solid transparent;
      transition: all 0.15s ease;
      user-select: none;
      text-transform: uppercase;
    }

    .filter-btn:hover {
      opacity: 0.85;
      transform: translateY(-1px);
    }

    .filter-btn.active {
      box-shadow: 0 0 0 2px rgba(59,130,246,0.5);
    }

    /* operation badges */
    .filter-btn[data-filter-type="operation"] {
      background: #f3f4f6;
      color: #374151;
    }
    .filter-btn[data-filter-type="operation"].active {
      background: #3b82f6;
      color: #fff;
    }

    /* status badges */
    .filter-btn[data-filter-status="all"] {
      background: #e0e7ff;
      color: #3730a3;
    }
    .filter-btn[data-filter-status="all"].active {
      background: #3b82f6;
      color: #fff;
    }
    .filter-btn[data-filter-status="pass"] {
      background: #d1fae5;
      color: #065f46;
    }
    .filter-btn[data-filter-status="pass"].active {
      background: var(--color-pass);
      color: #fff;
    }
    .filter-btn[data-filter-status="fail"] {
      background: #fee2e2;
      color: #991b1b;
    }
    .filter-btn[data-filter-status="fail"].active {
      background: var(--color-fail);
      color: #fff;
    }
    .filter-btn[data-filter-status="error"] {
      background: #fef3c7;
      color: #92400e;
    }
    .filter-btn[data-filter-status="error"].active {
      background: var(--color-warn);
      color: #fff;
    }

    .filter-count {
      display: inline-block;
      min-width: 18px;
      text-align: center;
      background: rgba(0,0,0,0.1);
      border-radius: 10px;
      padding: 1px 5px;
      font-size: 11px;
      margin-left: 4px;
    }

    .filter-btn.active .filter-count {
      background: rgba(255,255,255,0.3);
    }

    .pdp-card.filter-hidden {
      display: none !important;
    }

    .filter-empty-msg {
      text-align: center;
      padding: 40px 20px;
      color: #6b7280;
      font-size: 15px;
      display: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🔍 PDP Feature Monitor Report</h1>
      <div class="run-info">
        <span>📅 ${new Date(startTime).toLocaleString("pt-BR")}</span>
        <span>⏱️ Duração: ${formatDuration(durationMs)}</span>
        <span>🆔 ${runId}</span>
      </div>
    </header>

    <div class="summary">
      <div class="summary-card total">
        <div class="summary-number">${summary.total}</div>
        <div class="summary-label">Total de PDPs</div>
      </div>
      <div class="summary-card pass">
        <div class="summary-number">${summary.passed}</div>
        <div class="summary-label">Passou</div>
      </div>
      <div class="summary-card fail">
        <div class="summary-number">${summary.failed}</div>
        <div class="summary-label">Falhou</div>
      </div>
      <div class="summary-card error">
        <div class="summary-number">${summary.errors}</div>
        <div class="summary-label">Erros</div>
      </div>
    </div>
    ${(() => {
      // Build unique operations + counts
      const opCounts = new Map<
        string,
        {
          label: string;
          total: number;
          pass: number;
          fail: number;
          error: number;
        }
      >();
      for (const r of results) {
        const key = getOperationKey(r);
        if (!opCounts.has(key)) {
          const ch = r.channel ?? "ecommerce";
          const label = `${r.vendor}/${r.country}${ch === "socialcommerce" ? " Social" : ""}`;
          opCounts.set(key, { label, total: 0, pass: 0, fail: 0, error: 0 });
        }
        const c = opCounts.get(key)!;
        c.total++;
        if (r.success) c.pass++;
        else if (r.error) c.error++;
        else c.fail++;
      }

      const totalPass = results.filter((r) => r.success).length;
      const totalFail = results.filter((r) => !r.success && !r.error).length;
      const totalError = results.filter((r) => !!r.error).length;

      const opBtns = [...opCounts.entries()]
        .map(
          ([key, c]) =>
            `<button class="filter-btn active" data-filter-type="operation" data-filter-op="${key}">${flag(c.label.split("/")[1]?.split(" ")[0] ?? "")} ${c.label}<span class="filter-count">${c.total}</span></button>`,
        )
        .join("");

      return `
    <div class="filter-section" id="filterSection">
      <h2>🔎 Filtrar Resultados</h2>
      <div class="filter-bar">
        <div class="filter-bar-group" id="statusFilters">
          <button class="filter-btn active" data-filter-status="all">Todos<span class="filter-count">${results.length}</span></button>
          <button class="filter-btn" data-filter-status="pass">✅ Passou<span class="filter-count">${totalPass}</span></button>
          <button class="filter-btn" data-filter-status="fail">❌ Falhou<span class="filter-count">${totalFail}</span></button>
          ${totalError > 0 ? `<button class="filter-btn" data-filter-status="error">⚠️ Erro<span class="filter-count">${totalError}</span></button>` : ""}
        </div>
        <div class="filter-bar-separator"></div>
        <div class="filter-bar-group" id="operationFilters">
          ${opBtns}
        </div>
      </div>
    </div>
      `;
    })()}

    ${generateOperationsFeatureFlags()}


    <main id="pdpResults">
      ${[...results.filter((r) => r.sku === "explore"), ...results.filter((r) => r.sku !== "explore")].map((r) => generatePdpCard(r)).join("")}
    </main>
    <div class="filter-empty-msg" id="filterEmptyMsg">Nenhum resultado corresponde aos filtros selecionados.</div>

    <footer>
      PDP Feature Monitor • Gerado automaticamente
    </footer>
  </div>

  <script>
  (function() {
    var activeStatus = 'all';
    var activeOps = new Set();

    // Init: all operations active
    document.querySelectorAll('#operationFilters .filter-btn').forEach(function(btn) {
      activeOps.add(btn.getAttribute('data-filter-op'));
    });

    function applyFilters() {
      var cards = document.querySelectorAll('.pdp-card[data-operation]');
      var visibleCount = 0;
      cards.forEach(function(card) {
        var cardOp = card.getAttribute('data-operation');
        var cardStatus = card.getAttribute('data-status');
        var matchOp = activeOps.has(cardOp);

        // Os cards de config tem status="info", vamos exibi-los apenas se status for "all"
        // ou se houvesse um filtro específico para info (que não existe no momento).
        var matchStatus = activeStatus === 'all' || cardStatus === activeStatus;

        if (matchOp && matchStatus) {
          card.classList.remove('filter-hidden');
          // Conta apenas os cards de resultado real para a mensagem de 'vazio'
          if (card.closest('#pdpResults')) {
            visibleCount++;
          }
        } else {
          card.classList.add('filter-hidden');
        }
      });
      document.getElementById('filterEmptyMsg').style.display = visibleCount === 0 ? 'block' : 'none';
    }

    // Status filter
    document.querySelectorAll('#statusFilters .filter-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('#statusFilters .filter-btn').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        activeStatus = btn.getAttribute('data-filter-status');
        applyFilters();
      });
    });

    // Operation filter (toggle individual)
    document.querySelectorAll('#operationFilters .filter-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var op = btn.getAttribute('data-filter-op');
        if (activeOps.has(op)) {
          // Don't allow deselecting all
          if (activeOps.size > 1) {
            activeOps.delete(op);
            btn.classList.remove('active');
          } else {
            // If clicking the last active one, reactivate all
            document.querySelectorAll('#operationFilters .filter-btn').forEach(function(b) {
              activeOps.add(b.getAttribute('data-filter-op'));
              b.classList.add('active');
            });
          }
        } else {
          activeOps.add(op);
          btn.classList.add('active');
        }
        applyFilters();
      });
    });
  })();
  </script>
</body>
</html>`;
}
