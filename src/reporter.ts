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
    `<img src="https://flagcdn.com/20x15/${country.toLowerCase()}.png" alt="${country}" style="vertical-align:middle;margin-right:2px;border-radius:2px" width="20" height="15">`;

  const vendorLogo = (vendor: string) => {
    const v = vendor.toLowerCase();
    if (v === "natura") {
      return `<svg width="70" height="30" viewBox="0 0 148 32" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle;">
        <path fill="#EB6619" d="M58.2134 14.5687C52.8233 14.5687 49.805 17.8028 49.805 23.0491V29.9485H53.4703V22.6898C53.4703 18.6653 54.9076 16.2217 58.2136 16.2217C61.3039 16.2217 62.7412 18.6653 62.7412 22.6898V29.9485H66.4065V23.0491C66.4065 17.8028 63.6753 14.5687 58.2134 14.5687Z" />
        <path fill="#EB6619" d="M77.9053 14.5687C73.5214 14.5687 69.4968 17.5153 69.4968 22.6898C69.4968 27.5769 72.8027 30.4515 77.4023 30.4515C79.8458 30.4515 81.7144 29.4453 82.7204 27.5767V29.9483H86.242V23.1209C86.242 17.8745 83.3672 14.5687 77.9053 14.5687ZM77.9053 28.7985C74.6712 28.7985 73.1619 26.6425 73.1619 22.6896C73.1619 19.0963 74.6712 16.2215 77.9053 16.2215C81.1394 16.2215 82.5766 19.0963 82.5766 22.6896C82.5766 26.4267 80.6361 28.7985 77.9053 28.7985Z" />
        <path fill="#EB6619" d="M113.839 22.3304C113.839 26.355 112.546 28.7985 109.383 28.7985C106.365 28.7985 105.071 26.355 105.071 22.3304V15.0717H101.406V21.9711C101.406 27.2175 103.993 30.4515 109.383 30.4515C114.63 30.4515 117.504 27.2175 117.504 21.9711V15.0717H113.839V22.3304Z" />
        <path fill="#EB6619" d="M139.137 14.5687C134.753 14.5687 130.728 17.5153 130.728 22.6898C130.728 27.5769 134.034 30.4515 138.634 30.4515C141.077 30.4515 142.946 29.4453 143.952 27.5767V29.9483H147.473V23.1209C147.473 17.8745 144.598 14.5687 139.137 14.5687ZM139.137 28.7985C135.903 28.7985 134.393 26.6425 134.393 22.6896C134.393 19.0963 135.903 16.2215 139.137 16.2215C142.371 16.2215 143.808 19.0963 143.808 22.6896C143.808 26.4267 141.867 28.7985 139.137 28.7985Z" />
        <path fill="#EB6619" d="M121.457 21.4679V29.9483H125.122V21.0366C125.122 18.1618 125.769 16.2933 128.716 16.2933C129.075 16.2933 129.506 16.2933 129.937 16.365V14.8557C129.147 14.6402 128.356 14.5682 127.566 14.5682C124.044 14.5682 121.457 16.5808 121.457 21.4679Z" />
        <path fill="#EB6619" d="M96.7345 28.7265C94.9377 28.7265 93.8597 27.5767 93.8597 24.0552V16.7965H98.6748V15.0717H93.8597V11.3346H90.1943V23.4804C90.1943 28.7987 93.0691 30.4515 96.1595 30.4515C97.6687 30.4515 99.0342 30.0203 100.04 29.3017C99.681 28.9425 99.3935 28.5112 99.2498 28.08C98.531 28.5112 97.7405 28.7265 96.7345 28.7265Z" />
        <path fill="#EB6619" d="M37.3037 7.74661C37.3037 9.8619 36.2308 12.4317 35.4675 13.7888C35.0445 14.541 34.9412 14.7144 34.9412 14.8314C34.9412 14.9136 34.9915 14.9836 35.0899 14.9836C35.5982 14.9836 39.8332 11.7234 42.8046 11.7234C44.5462 11.7234 46.1396 12.649 46.1396 14.8347C46.1396 17.0785 44.6552 20.6483 39.7078 23.2983C39.3539 23.4879 38.6121 23.8815 38.0918 24.1573C37.4262 24.5101 37.2519 24.6833 37.2519 24.903C37.2519 25.4648 39.2185 25.1965 39.2185 26.3476C39.2185 26.9621 38.4686 27.9794 36.5043 29.0763C34.7089 30.079 32.3163 30.9025 29.3414 30.9025C27.2228 30.9025 26.0351 30.4867 25.8087 30.4867C25.7221 30.4867 25.655 30.5131 25.5602 30.5955C25.4375 30.7025 23.9203 32 20.3907 32C16.3329 32 11.7867 30.3383 11.7867 28.7883C11.7867 28.0341 12.7407 27.8235 12.7407 27.662C12.7407 27.5964 12.6282 27.5721 12.5827 27.5599C6.91843 26.0325 0.526489 23.0137 0.526489 18.9439C0.526489 17.8189 1.32077 17.2382 2.46569 17.2382C4.45605 17.2382 7.2108 18.1594 7.81039 18.1594C7.95658 18.1594 8.01173 18.0794 8.01173 17.9977C8.01173 17.8874 7.92335 17.7644 7.75147 17.6183C4.12226 14.5346 2.60877 11.6992 2.60877 9.32676C2.60877 6.25705 4.82484 3.93311 7.76941 3.3539C13.1958 2.28673 16.4678 6.91666 19.3583 10.6367C19.4392 10.7408 19.5865 10.9565 19.7668 10.9565C19.9891 10.9565 20.0456 10.7423 20.2467 9.92613C20.4479 9.10992 20.5079 8.85896 20.7648 7.81328C21.6114 4.36946 23.652 0 29.5436 0C33.0118 0 37.3037 2.34675 37.3037 7.74661ZM20.5141 15.4857C19.4183 15.4857 18.8398 14.871 17.7208 13.4716C17.5432 13.2495 16.7677 12.3108 16.5701 12.0724C13.8628 8.80447 11.8994 7.3282 9.6559 7.3282C8.301 7.3282 6.26767 8.08594 6.26767 10.6708C6.26767 11.0084 6.31153 12.4565 7.71537 14.1727C9.50329 16.3584 12.0915 19.2463 12.3289 19.5158C12.5715 19.7911 12.6988 20.0844 12.6968 20.3449C12.6957 20.4897 12.651 21.1241 11.5705 21.1241C10.5157 21.1241 5.90575 19.7754 4.2917 19.7754C3.54349 19.7754 3.06151 20.099 3.06151 20.6479C3.06151 22.065 5.828 24.9792 14.5222 26.9399C15.6139 27.1862 15.7103 27.5767 15.7103 27.7103C15.7103 28.2186 14.3569 28.4541 14.3569 29.3155C14.3569 30.5795 18.4446 31.1402 19.6168 31.1402C21.7031 31.1402 22.7273 30.5284 23.5049 29.9941C24.1694 29.5376 24.5473 29.3622 24.9907 29.3622C25.9239 29.3622 26.7964 29.9447 29.6298 29.9447C33.0769 29.9447 36.6955 28.1457 36.6955 27.1658C36.6955 26.7831 36.1234 26.6859 34.836 26.2617C34.1602 26.0389 33.7708 25.7653 33.7708 25.3438C33.7708 24.9425 34.1004 24.6257 35.0752 24.2027C36.1172 23.7506 36.8621 23.4181 37.6306 23.048C41.8222 21.0289 43.4469 18.5654 43.4567 16.7837C43.4631 15.6418 42.8063 14.8673 41.7374 14.8673C40.3289 14.8673 38.784 15.6819 37.2774 16.4454C34.4582 17.8741 33.4315 18.4203 32.4428 18.4203C31.7424 18.4203 31.4157 17.8222 31.411 17.4685C31.4084 17.2636 31.4425 17.0284 31.5357 16.7759C31.8999 15.7905 32.1588 15.1306 32.5573 14.0745C33.1433 12.5212 33.8535 10.7461 33.8535 8.99164C33.8535 6.24819 31.7236 4.37809 28.9274 4.37809C25.7977 4.37809 24.458 7.32887 23.664 9.67407C23.4469 10.3149 22.6227 12.814 22.3715 13.5638C21.9323 14.8744 21.3531 15.4857 20.5141 15.4857Z" />
      </svg>`;
    }
    if (v === "avon") {
      return `<svg width="47" height="30" viewBox="0 0 171 54" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle;">
        <path fill="#FF2469" d="M138.583 52.4431H131.355V1.40088H141.266L163.759 41.1993V1.40088H171V52.4431H161.827L138.641 11.6713L138.583 52.4431Z" />
        <path fill="#FF2469" d="M102.323 53.8413C88.3959 53.8413 77.6187 42.5504 77.6187 26.9207C77.6187 11.2909 88.3959 0 102.323 0C116.25 0 127.099 11.2909 127.099 26.9207C127.099 42.5504 116.322 53.8413 102.323 53.8413ZM102.323 46.5884C112.264 46.5884 119.262 37.9874 119.262 26.9207C119.262 15.8539 112.264 7.25298 102.323 7.25298C92.3821 7.25298 85.4559 15.851 85.4559 26.9207C85.4559 37.9904 92.4539 46.5884 102.323 46.5884Z" />
        <path fill="#FF2469" d="M17.916 1.39795L0 52.4402H7.69368L22.8767 9.18184L38.0598 52.4402H45.7535L27.8375 1.39795H17.9132H17.916Z" />
        <path fill="#FF2469" d="M52.583 52.4431L34.667 1.40088H42.3607L57.5437 44.6592L72.7268 1.40088H80.4205L62.5045 52.4431H52.5803H52.583Z" />
      </svg>`;
    }
    return `<span class="badge badge-vendor">${vendor}</span>`;
  };

  const statusEmoji = (passed: boolean, status: string) => {
    if (status === "na") {
      return "⬜";
    }
    if (status === "error") {
      return "⚠️";
    }
    if (status === "disabled") {
      return "🚫";
    }
    if (status === "warning") {
      return "⚠️";
    }
    return passed ? "✅" : "❌";
  };

  const statusClass = (passed: boolean, status: string) => {
    if (status === "na") {
      return "status-na";
    }
    if (status === "error") {
      return "status-error";
    }
    if (status === "disabled") {
      return "status-disabled";
    }
    if (status === "warning") {
      return "status-warning";
    }
    return passed ? "status-pass" : "status-fail";
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) {
      return `${ms}ms`;
    }
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
    "ratingConsistency",
  ]);

  /**
   * Render a screenshot as an inline base64 thumbnail (if outputDir is
   * available and the file exists), or fall back to a plain relative link.
   */
  const renderScreenshot = (
    screenshotPath: string | undefined,
    thumbnail = true,
  ): string => {
    if (!screenshotPath) {
      return "-";
    }
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
    if (!flags) {
      return '<div class="remote-config-section"><em>Remote Config não capturado</em></div>';
    }

    const categories = getFlagsByCategory(flags);
    const totalFlags = countCapturedFlags(flags);

    if (Object.keys(categories).length === 0) {
      return '<div class="remote-config-section"><em>Nenhuma flag capturada</em></div>';
    }

    const formatValue = (v: unknown): string => {
      if (v === true) {
        return '<span class="flag-true">✓</span>';
      }
      if (v === false) {
        return '<span class="flag-false">✗</span>';
      }
      if (v === undefined || v === null) {
        return '<span class="flag-na">-</span>';
      }
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
    if (!flags) {
      return '<div class="remote-config-section commerce-flags"><em>Commerce Feature Flags não capturado</em></div>';
    }

    const categories = getCommerceFlagsByCategory(flags);
    const totalFlags = countCommerceFlags(flags);

    if (Object.keys(categories).length === 0) {
      return '<div class="remote-config-section commerce-flags"><em>Nenhuma flag commerce capturada</em></div>';
    }

    const formatValue = (v: unknown): string => {
      if (v === true) {
        return '<span class="flag-true">✓</span>';
      }
      if (v === false) {
        return '<span class="flag-false">✗</span>';
      }
      if (v === undefined || v === null) {
        return '<span class="flag-na">-</span>';
      }
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
    if (operations.size === 0) {
      return "";
    }

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
              ${vendorLogo(op.vendor)}
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
          ${vendorLogo(result.vendor)}
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

  const generateHistory = () => {
    // History is loaded dynamically at runtime from docs/reports/index.json.
    // This avoids broken relative paths when the report is placed at different
    // directory depths (e.g. docs/last-report.html vs docs/reports/run_X/report.html).
    return `
      <div class="history-dropdown" id="historyDropdown" style="display:none">
        <button class="history-button">📖 Histórico de Execuções</button>
        <ul class="history-list" id="historyList"></ul>
      </div>
      <script>
      (function() {
        var currentRunId = ${JSON.stringify(runId)};
        // Detect whether this page is inside a reports/run_* sub-directory.
        var isInRunDir = window.location.pathname.indexOf('/reports/run_') >= 0;
        // From reports/run_XXX/report.html  -> ../index.json  = reports/index.json
        // From docs/last-report.html        -> reports/index.json = reports/index.json
        var indexUrl = isInRunDir ? '../index.json' : 'reports/index.json';
        fetch(indexUrl)
          .then(function(r) { return r.ok ? r.json() : Promise.reject(); })
          .then(function(data) {
            var reports = (data.reports || []).slice(0, 25);
            if (reports.length <= 1) return;
            var list = document.getElementById('historyList');
            reports.forEach(function(rep) {
              var li = document.createElement('li');
              var date = new Date(rep.startTime).toLocaleString('pt-BR', {dateStyle: 'short', timeStyle: 'medium'});
              if (rep.runId === currentRunId) {
                li.style.fontWeight = 'bold';
                li.style.color = '#3b82f6';
                li.textContent = date + ' (Atual)';
              } else {
                var a = document.createElement('a');
                // Build link relative to the current page location
                a.href = isInRunDir ? ('../' + rep.runId + '/report.html') : rep.htmlPath;
                a.textContent = date;
                li.appendChild(a);
              }
              list.appendChild(li);
            });
            document.getElementById('historyDropdown').style.display = 'inline-block';
          })
          .catch(function() { /* no history available (e.g. local file://) */ });
      })();
      </script>
    `;
  };

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
      justify-content: space-between;
      align-items: center;
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

    /* ── History Dropdown ── */
    .history-dropdown {
      position: relative;
      display: inline-block;
    }

    .history-button {
      background: #fff;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .history-button:hover {
      background: #f9fafb;
    }

    .history-list {
      display: none;
      position: absolute;
      background-color: #ffffff;
      min-width: 220px;
      box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
      z-index: 1;
      list-style: none;
      padding: 8px 0;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
      max-height: 400px;
      overflow-y: auto;
      right: 0;
    }

    .history-dropdown:hover .history-list {
      display: block;
    }

    .history-list li {
      padding: 8px 16px;
      font-size: 13px;
    }

    .history-list li:hover {
      background-color: #f3f4f6;
    }

    .history-list a {
      text-decoration: none;
      color: #374151;
      display: block;
    }

    .history-list a:hover {
      color: #1f2937;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🔍 PDP Feature Monitor Report</h1>
      <div class="run-info">
        <div>
          <span>📅 ${new Date(startTime).toLocaleString("pt-BR")}</span>
          <span>⏱️ Duração: ${formatDuration(durationMs)}</span>
          <span>🆔 ${runId}</span>
        </div>
        ${generateHistory()}
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
        if (r.success) {
          c.pass++;
        } else if (r.error) {
          c.error++;
        } else {
          c.fail++;
        }
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
