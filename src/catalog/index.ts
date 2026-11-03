import "../loadEnv.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { parseCatalogPsv } from "./parseCatalog.js";
import { downloadCatalog } from "./sfcc.js";
import { buildSnapshot, newProducts } from "./snapshot.js";
import type { CatalogSnapshot } from "./types.js";

/** Same split as perf: reports/catalog (git-ignored) for local runs, docs/catalog when published. */
function getOutputDir(): string {
  return path.resolve(process.cwd(), process.env.CATALOG_OUTPUT_DIR || "reports/catalog");
}

function readPrevious(filePath: string): CatalogSnapshot | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as CatalogSnapshot;
  } catch (e) {
    console.warn(`⚠️  Snapshot anterior ilegível (${filePath}); começando uma nova base:`, e);
    return null;
  }
}

async function main(): Promise<void> {
  const operations = (process.env.CATALOG_OPERATIONS || "natura-BR")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const outDir = getOutputDir();
  fs.mkdirSync(outDir, { recursive: true });

  for (const operation of operations) {
    console.log(`📦 Baixando catálogo ${operation}...`);
    const fetchedAt = new Date().toISOString();
    const download = await downloadCatalog(operation);
    const rows = download.text.split(/\r?\n/).filter((l) => l.trim() !== "").length - 1;
    const products = parseCatalogPsv(download.text);

    const filePath = path.join(outDir, `${operation}.json`);
    const previous = readPrevious(filePath);
    const snapshot = buildSnapshot({
      operation,
      fetchedAt,
      products,
      previous,
      source: { file: download.file, lastModified: download.lastModified, rows },
    });
    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), "utf-8");

    const fresh = newProducts(snapshot);
    console.log(
      `   ${rows} linhas no arquivo (o feed repete linhas e inclui os produtos pai) → ${snapshot.products.length} PDPs (${snapshot.products.filter((p) => p.available).length} disponíveis)`,
    );
    console.log(
      previous
        ? `   ${fresh.length} produto(s) novo(s) desde ${snapshot.baselineAt}`
        : "   Primeiro download: esta é a base; os próximos downloads apontam o que entrou depois.",
    );
    for (const p of fresh.slice(0, 20)) {
      console.log(`   🆕 ${p.sku} ${p.name}`);
    }
    console.log(`💾 ${filePath}`);
  }
}

main().catch((error) => {
  console.error("❌", error instanceof Error ? error.message : error);
  process.exit(1);
});
