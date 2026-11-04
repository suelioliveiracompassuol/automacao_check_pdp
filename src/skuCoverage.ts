/**
 * Which hard cases each operation's SKU list covers, read from the latest runs' reports:
 *
 *   npm run skus:coverage
 *
 * Bugs in the checks show up on edge-case products (a master SKU that opens on a shade, a product
 * without reviews, one out of stock); with no such SKU in an operation, a check can be wrong there
 * for months without anyone noticing. This only reports the gaps; picking SKUs to fill them and
 * adding them (dashboard /skus) is up to a person. Signals come from the checks' details, so a
 * case the platform's report doesn't record is shown as "sem sinal", never as covered.
 */
import * as path from "node:path";
import { readPreviousRuns, resultKey } from "./reportHistory.js";
import type { CheckResult, PdpCheckResult, Platform } from "./types.js";

/** Runs to read per platform: the newest result of each SKU wins (filtered runs miss SKUs). */
const RUNS_TO_READ = 5;

interface Case {
  label: string;
  /** undefined: the platform's report has no signal for this case. */
  matches?: (byKey: Map<string, CheckResult>) => boolean;
  /**
   * Whether the SKU's result records the data `matches` reads: a SKU without it (e.g. a report
   * from before the field existed) is "unknown", never counted as not being the case.
   */
  known?: (byKey: Map<string, CheckResult>) => boolean;
}

const num = (v: unknown) => (typeof v === "number" ? v : undefined);
const api = (f?: CheckResult) => (f?.details?.api ?? {}) as Record<string, unknown>;

/** Android: the PDP API told whether the product has variations (variationCount, or no variations at all). */
const androidVariationsKnown = (k: Map<string, CheckResult>) =>
  num(api(k.get("images")).variationCount) !== undefined || api(k.get("images")).source === "images";

const noReviews: Case = {
  label: "sem avaliações",
  matches: (k) => num(k.get("reviews")?.details?.reviewCount) === 0,
  known: (k) => num(k.get("reviews")?.details?.reviewCount) !== undefined,
};

const CASES: Record<"web" | "android", Case[]> = {
  web: [
    {
      label: "com variações",
      matches: (k) => (num(k.get("productVariations")?.details?.variationsCount) ?? 0) > 1,
      known: (k) => num(k.get("productVariations")?.details?.variationsCount) !== undefined,
    },
    // The Web report doesn't tell a master SKU from its variation, nor the stock
    { label: "master que abre outra variação" },
    noReviews,
    { label: "esgotado" },
  ],
  android: [
    {
      label: "com variações",
      matches: (k) => (num(api(k.get("images")).variationCount) ?? 0) > 1,
      known: androidVariationsKnown,
    },
    {
      label: "master que abre outra variação",
      matches: (k) => typeof api(k.get("images")).openedVariation === "string",
      known: androidVariationsKnown,
    },
    noReviews,
    {
      label: "esgotado",
      matches: (k) => ["notifyMe", "unavailable"].includes(String(k.get("addToCart")?.details?.state)),
      known: (k) => typeof k.get("addToCart")?.details?.state === "string",
    },
  ],
};

function latestResults(platform: Platform, reportsDir: string): PdpCheckResult[] {
  const latest = new Map<string, PdpCheckResult>();
  for (const run of readPreviousRuns(platform === "web" ? undefined : platform, reportsDir, undefined, RUNS_TO_READ)) {
    for (const r of run.results) {
      // Runs are newest first; a result with no features (SKU that errored) says nothing
      if (!latest.has(resultKey(r)) && r.features.length > 0) {
        latest.set(resultKey(r), r);
      }
    }
  }
  return [...latest.values()];
}

function main(): void {
  const reportsDir = path.join(process.cwd(), "docs", "reports");
  let gaps = 0;
  let unverifiable = 0;
  for (const platform of ["web", "android"] as const) {
    const results = latestResults(platform, reportsDir);
    console.log(`\n${platform === "web" ? "🌐 Web" : "📱 Android"} (${results.length} SKU(s) nos últimos ${RUNS_TO_READ} runs)`);
    if (results.length === 0) {
      console.log("   sem relatórios em docs/reports");
      continue;
    }
    const byOperation = new Map<string, PdpCheckResult[]>();
    for (const r of results) {
      const op = `${r.vendor}-${r.country}${r.channel === "socialcommerce" ? " (Minha Loja)" : ""}`;
      byOperation.set(op, [...(byOperation.get(op) ?? []), r]);
    }
    for (const [op, skus] of [...byOperation].sort(([a], [b]) => a.localeCompare(b))) {
      console.log(`\n   ${op} — ${skus.length} SKU(s)`);
      for (const c of CASES[platform]) {
        if (!c.matches) {
          console.log(`      ·  ${c.label}: sem sinal no relatório desta plataforma`);
          continue;
        }
        const maps = skus.map((r) => new Map(r.features.map((f) => [f.featureKey, f])));
        const hits = skus.filter((_, i) => c.matches!(maps[i]));
        const unknown = maps.filter((m) => c.known && !c.known(m)).length;
        if (hits.length > 0) {
          const sample = hits.slice(0, 3).map((r) => r.sku).join(", ");
          console.log(`      ✅ ${c.label}: ${hits.length} (${sample}${hits.length > 3 ? ", ..." : ""})`);
        } else if (unknown > 0) {
          unverifiable++;
          console.log(`      ❔ ${c.label}: não dá para saber, ${unknown} SKU(s) sem esse dado no relatório (runs anteriores ao campo?)`);
        } else {
          gaps++;
          console.log(`      ❌ ${c.label}: nenhum SKU`);
        }
      }
    }
  }
  console.log(
    gaps
      ? `\n${gaps} caso(s) sem SKU. Adicione SKUs que cubram esses casos em /skus no dashboard.`
      : "\nNenhum caso confirmado sem SKU.",
  );
  if (unverifiable) {
    console.log(`${unverifiable} caso(s) sem dado para verificar: rode o monitor de novo para os relatórios trazerem o campo.`);
  }
}

main();
