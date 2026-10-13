import * as fs from "node:fs";
import * as path from "node:path";
import {
  getPerfSkus,
  PERF_RUNS_PER_SKU,
} from "./config.js";
import { measureSku } from "./lighthouseRunner.js";
import type {
  PerfRun,
  PerfIndex,
  PerfIndexEntry,
  PerfSkuResult,
} from "./types.js";

async function main(): Promise<void> {
  const timestamp = new Date().toISOString();
  const runId = `run_${Date.now()}`;
  const perfDir = path.join(process.cwd(), "docs", "perf");

  fs.mkdirSync(perfDir, { recursive: true });

  console.log("=".repeat(80));
  console.log("📈 Medição de Web Vitals da PDP (Lighthouse desktop)");
  console.log("=".repeat(80));

  const skus = getPerfSkus();
  console.log(`SKUs configurados (${skus.length}):`);
  for (const s of skus) {
    console.log(` - ${s.pageType ?? "PDP"} ${s.sku}: ${s.name} (slug: ${s.slug})`);
  }
  console.log(`Execuções por SKU: ${PERF_RUNS_PER_SKU}`);
  console.log("=".repeat(80));

  const results: PerfSkuResult[] = [];

  for (const skuTarget of skus) {
    const result = await measureSku(
      skuTarget,
      PERF_RUNS_PER_SKU,
      perfDir,
      runId,
    );
    results.push(result);
  }

  const perfRun: PerfRun = {
    runId,
    timestamp,
    formFactor: "desktop",
    runsPerSku: PERF_RUNS_PER_SKU,
    results,
  };

  const runJsonPath = path.join(perfDir, `${runId}.json`);
  fs.writeFileSync(runJsonPath, JSON.stringify(perfRun, null, 2), "utf-8");
  console.log(`\n💾 Relatório salvo em: ${runJsonPath}`);

  // Atualiza docs/perf/index.json
  const indexJsonPath = path.join(perfDir, "index.json");
  let perfIndex: PerfIndex = { runs: [] };

  if (fs.existsSync(indexJsonPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(indexJsonPath, "utf-8")) as PerfIndex;
      if (Array.isArray(existing.runs)) {
        perfIndex = existing;
      }
    } catch (e) {
      console.warn("⚠️  Falha ao ler index.json de performance existente; iniciando novo índice:", e);
    }
  }

  const indexEntry: PerfIndexEntry = {
    runId,
    timestamp,
    skus: results.map((r) => ({
      sku: r.sku,
      name: r.name,
      pageType: r.pageType,
      success: r.success,
      metrics: r.median,
    })),
  };

  perfIndex.runs.unshift(indexEntry);
  if (perfIndex.runs.length > 365) {
    perfIndex.runs = perfIndex.runs.slice(0, 365);
  }

  fs.writeFileSync(indexJsonPath, JSON.stringify(perfIndex, null, 2), "utf-8");
  console.log(`🗂️  Índice de performance atualizado: ${indexJsonPath}`);

  // Imprime tabela resumo
  console.log("\n" + "=".repeat(80));
  console.log("📊 RESUMO DE PERFORMANCE (Mediana Lighthouse Desktop)");
  console.log("=".repeat(80));

  console.table(
    results.map((r) => ({
      Tipo: r.pageType ?? "—",
      SKU: r.sku,
      Status: r.success ? "✅ OK" : "❌ Falha",
      Score: r.median?.performanceScore ?? "—",
      "LCP (ms)": r.median?.lcp ?? "—",
      CLS: r.median?.cls ?? "—",
      "TBT (ms)": r.median?.tbt ?? "—",
      "FCP (ms)": r.median?.fcp ?? "—",
      "TTFB (ms)": r.median?.ttfb ?? "—",
    })),
  );
  console.log("=".repeat(80));

  const allFailed = results.length > 0 && results.every((r) => !r.success);
  if (allFailed) {
    console.error("\n🔴 Todos os SKUs falharam na medição de performance!");
    process.exit(1);
  } else {
    console.log("\n🟢 Medição de performance concluída com sucesso!");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("❌ Erro fatal durante medição de performance:", err);
  process.exit(1);
});
