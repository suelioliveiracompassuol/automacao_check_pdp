/**
 * PDP Feature Monitor - Main Orchestrator (Web)
 *
 * Loads the SKUs, runs each PDP (src/web/checkPdp.ts) grouped by operation and writes the
 * report + index. Pieces:
 * - src/web/runOptions.ts: env filters, SKU selection, smoke mode, browser per SKU
 * - src/web/checkPdp.ts: one PDP (captures → navigation → flags → checks → verdict)
 * - src/web/featureGating.ts: which features run (vendor, Remote Config, Commerce flags)
 * - src/web/pdpResults.ts: legacy endpoint check and the PDP verdict
 */

import { chromium, firefox, Browser } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { MonitoringReport, PdpCheckResult } from "./types.js";
import { generateJsonReport } from "./reporter.js";
import { upsertReportIndexEntry } from "./reportIndex.js";
import { currentRatingStates, preloadRatingStates } from "./ratingDivergence.js";
import { markNewFailuresFromReports } from "./reportHistory.js";
import { recordRunInFirestore } from "./firestoreHistory.js";
import { loadSkusWithSource } from "./checks/configs/skus/skus.js";
import { PDP_ENDPOINT_RULES } from "./checks/configs/endpoints-rules.js";
import { runWithConcurrency, jitter, parseConcurrency } from "./concurrency.js";
import { describePlaywrightTraceMode, getPlaywrightTraceMode } from "./playwrightTrace.js";
import { checkPdp } from "./web/checkPdp.js";
import {
  SMOKE_FEATURES,
  groupByOperation,
  parseRunOptions,
  selectSkus,
  usesFirefox,
} from "./web/runOptions.js";

/**
 * Main execution function
 */
async function main() {
  const runId = `run_${Date.now()}`;
  const startTime = new Date();
  const outputDir = path.join(process.cwd(), "docs", "reports", runId);

  // Create output directories
  fs.mkdirSync(path.join(outputDir, "screenshots"), { recursive: true });

  // Carrega SKUs do Firestore (ou JSON como fallback)
  const { skus: SKUS, source: skuSource } = await loadSkusWithSource();
  // Since when each SKU's rating diverges (Firestore, falling back to docs/reports)
  await preloadRatingStates("web");

  // Env-based filters (set via workflow_dispatch inputs) and MODE=smoke
  const options = parseRunOptions(process.env);
  const { operationsFilter, endpointMatch, monitorEndpoints, isSmokeMode } = options;
  const { skus: skusToCheck, featuresFilter } = selectSkus(SKUS, options);

  console.log("🚀 PDP Feature Monitor");
  console.log(`📅 Started: ${startTime.toISOString()}`);
  console.log(`📂 Output: ${outputDir}`);
  const operationsFilterNote =
    operationsFilter && operationsFilter.length > 0 ? ` (filtro: ${operationsFilter.join(", ")})` : "";
  console.log(`📦 SKUs to check: ${skusToCheck.length}${operationsFilterNote}`);
  if (isSmokeMode) {
    console.log(
      `⚡ MODE=smoke — healthcheck rápido (1 SKU/domínio, features: ${SMOKE_FEATURES.join(", ")})`,
    );
  }
  if (featuresFilter) {
    console.log(`🔍 Features filter: ${[...featuresFilter].join(", ")}`);
  }
  if (endpointMatch) {
    console.log(`🌐 Endpoint check (ENDPOINT_MATCH): ${endpointMatch}`);
  }
  if (monitorEndpoints) {
    console.log(`🌐 Monitoramento de endpoints PDP ativado (${PDP_ENDPOINT_RULES.length} regras)`);
  }
  const traceMode = getPlaywrightTraceMode();
  if (traceMode !== "off") {
    console.log(
      `🎬 Trace Playwright: ${describePlaywrightTraceMode(traceMode)} — abrir com: npx playwright show-trace <caminho.zip>`,
    );
  }
  console.log("");

  // Launch browsers
  // Chromium for BR sites, Firefox for international (HTTP2 issues with headless Chromium)
  const isHeadless = process.env.HEADLESS !== "false";
  const browserChromium = await chromium.launch({
    headless: isHeadless,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox", "--disable-dev-shm-usage"],
  });
  let browserFirefox: Browser | null = null;
  try {
    browserFirefox = await firefox.launch({ headless: isHeadless });
  } catch {
    console.log("⚠️  Firefox not available, falling back to Chromium for all sites");
  }

  const results: PdpCheckResult[] = [];

  // Concurrency from CONCURRENCY env var (default 3; hard-capped at 8 to reduce WAF risk)
  const concurrency = parseConcurrency(3);
  console.log(`⚡ Concorrência: ${concurrency} worker(s) | jitter 1–3 s entre SKUs do mesmo domínio\n`);

  // Group SKUs by domain key so same-origin requests stay serial within each group
  const skusByDomain = groupByOperation(skusToCheck);
  console.log(`🗂️  ${skusByDomain.size} grupo(s) de domínio: ${[...skusByDomain.keys()].join(", ")}\n`);

  try {
    // One async task per domain group; groups run in parallel up to the concurrency limit.
    // SKUs within each group run serially with a random 1–3 s jitter between requests.
    const skuTasks = [...skusByDomain.values()].map((group) => async (): Promise<PdpCheckResult[]> => {
      const groupResults: PdpCheckResult[] = [];
      for (let i = 0; i < group.length; i++) {
        if (i > 0) {
          await jitter(1000, 2000); // 1–3 s between consecutive hits on the same domain
        }
        const sku = group[i];
        const browser = browserFirefox !== null && usesFirefox(sku) ? browserFirefox : browserChromium;
        groupResults.push(
          await checkPdp({ browser, sku, outputDir, featuresFilter, endpointMatch, monitorEndpoints }),
        );
      }
      return groupResults;
    });
    const groupedResults = await runWithConcurrency(skuTasks, concurrency);
    results.push(...groupedResults.flat());
  } finally {
    await browserChromium.close();
    if (browserFirefox) {
      await browserFirefox.close();
    }
  }

  const endTime = new Date();
  const durationMs = endTime.getTime() - startTime.getTime();

  // Failures that didn't happen in the SKU's previous run: the ones most worth a human look
  const newFailures = markNewFailuresFromReports(results, "web", runId);

  // Generate report
  const report: MonitoringReport = {
    runId,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    durationMs,
    skuSource,
    summary: {
      total: results.length,
      passed: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success && !r.error).length,
      errors: results.filter((r) => r.error).length,
      newFailures,
    },
    results,
  };

  // Save report (the dashboard renders it)
  const jsonPath = path.join(outputDir, "report.json");
  fs.writeFileSync(jsonPath, generateJsonReport(report));

  const indexEntry = {
    runId: report.runId,
    startTime: report.startTime,
    endTime: report.endTime,
    durationMs: report.durationMs,
    summary: report.summary,
    skuSource: report.skuSource,
    // Path relative to the /docs root for the frontend
    jsonPath: path.join("reports", runId, "report.json").replace(/\\/g, "/"),
  };

  // Copy to last-report files and update index
  try {
    const docsDir = path.join(process.cwd(), "docs");
    fs.copyFileSync(jsonPath, path.join(docsDir, "last-report.json"));
    // Update index.json (upsert by runId, lock-protected against concurrent writers —
    // see reportIndex.ts, shared with the Android orchestrator)
    await upsertReportIndexEntry(indexEntry);
    console.log(`\n✅  Índice de relatórios atualizado`);
  } catch (e) {
    console.error("\n❌ Erro ao atualizar o histórico de relatórios:", e);
  }

  // Rating states and run summary in Firestore (best effort, see firestoreHistory.ts)
  await recordRunInFirestore(report, indexEntry, "web", currentRatingStates(report.results, "web"));

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 RESUMO");
  console.log("=".repeat(60));
  console.log(`✅ Passou: ${report.summary.passed}/${report.summary.total}`);
  console.log(`❌ Falhou: ${report.summary.failed}/${report.summary.total}`);
  console.log(`⚠️  Erros: ${report.summary.errors}/${report.summary.total}`);
  console.log(`⏱️  Duração: ${(durationMs / 1000).toFixed(1)}s`);
  console.log(`📄 Relatório: ${jsonPath}`);
  console.log("=".repeat(60));

  // Exit with error code if any failures
  if (report.summary.failed > 0 || report.summary.errors > 0) {
    console.log("\n🔴 Há falhas no monitoramento!");
    process.exit(1);
  } else {
    console.log("\n🟢 Todas as verificações passaram!");
    process.exit(0);
  }
}

// Run
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
