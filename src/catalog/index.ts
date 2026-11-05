import "../loadEnv.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { parseCatalogRows, toProduct } from "./parseCatalog.js";
import { CATALOG_QUALITY_COLLECTION, hasFirestoreCredentials, publishCatalogQuality } from "./publish.js";
import { checkCatalogQuality } from "./quality.js";
import { CATALOG_SOURCES, downloadCatalog, type DownloadedCatalog } from "./sfcc.js";
import { buildSnapshot, newProducts } from "./snapshot.js";
import type { CatalogSnapshot } from "./types.js";

const LOCAL_OUTPUT_DIR = path.resolve(process.cwd(), "reports/catalog");

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

/** CATALOG_FILE reads a local export instead of downloading (one operation only). */
async function loadCatalog(operation: string): Promise<DownloadedCatalog> {
  const localFile = process.env.CATALOG_FILE;
  if (!localFile) {
    return downloadCatalog(operation);
  }
  return {
    file: CATALOG_SOURCES[operation]?.file ?? path.basename(localFile),
    text: fs.readFileSync(localFile, "utf-8"),
    lastModified: fs.statSync(localFile).mtime.toISOString(),
  };
}

async function main(): Promise<void> {
  const operations = (process.env.CATALOG_OPERATIONS || "natura-BR")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const outDir = getOutputDir();
  fs.mkdirSync(outDir, { recursive: true });

  for (const operation of operations) {
    console.log(
      process.env.CATALOG_FILE
        ? `📦 Lendo catálogo ${operation} de ${process.env.CATALOG_FILE}...`
        : `📦 Baixando catálogo ${operation}...`,
    );
    const fetchedAt = new Date().toISOString();
    const download = await loadCatalog(operation);
    const rows = download.text.split(/\r?\n/).filter((l) => l.trim() !== "").length - 1;
    const catalogRows = parseCatalogRows(download.text);
    const products = catalogRows.map(toProduct);
    const source = { file: download.file, lastModified: download.lastModified, rows };

    const filePath = path.join(outDir, `${operation}.json`);
    const previous = readPrevious(filePath);
    const snapshot = buildSnapshot({
      operation,
      fetchedAt,
      products,
      previous,
      source,
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

    const quality = checkCatalogQuality(catalogRows, { operation, fetchedAt, source });
    // Restricted to logged-in users: the local copy always goes to the git-ignored folder, never
    // to CATALOG_OUTPUT_DIR (docs/catalog is published), and the dashboard reads it from Firestore.
    fs.mkdirSync(LOCAL_OUTPUT_DIR, { recursive: true });
    const qualityPath = path.join(LOCAL_OUTPUT_DIR, `${operation}.quality.json`);
    fs.writeFileSync(qualityPath, JSON.stringify(quality, null, 2), "utf-8");
    const errors = quality.issues.filter((i) => i.severity === "error").length;
    console.log(
      `🔎 Validação do catálogo: ${errors} erro(s), ${quality.issues.length - errors} alerta(s) em ${quality.checked} PDPs`,
    );
    for (const rule of quality.rules) {
      const count = quality.issues.filter((i) => i.rule === rule.key).length;
      if (count > 0) {
        console.log(`   ${String(count).padStart(5)}  ${rule.label}`);
      }
    }
    console.log(`💾 ${qualityPath}`);

    if (hasFirestoreCredentials()) {
      await publishCatalogQuality(quality);
      console.log(`☁️  Validação publicada no Firestore (${CATALOG_QUALITY_COLLECTION}/${operation})`);
    } else {
      console.log(
        "⚠️  Sem FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY: validação não publicada (o dashboard lê do Firestore).",
      );
    }
  }
}

main().catch((error) => {
  console.error("❌", error instanceof Error ? error.message : error);
  process.exit(1);
});
