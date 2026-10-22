import * as path from "node:path";
import { buildPdpUrl } from "../checks/configs/config.js";
import { DEFAULT_USER_AGENT } from "../browserSetup.js";

export const PERF_RUNS_PER_SKU = 3;
export const PERF_USER_AGENT = DEFAULT_USER_AGENT;

/**
 * Perfis de conexão do WebPageTest (limitação por pacote). Usamos os mesmos valores
 * para os números ficarem comparáveis com a automação de Web Vitals do site geral.
 */
export interface PerfConnectivity {
  name: string;
  downKbps: number;
  upKbps: number;
  rttMs: number;
}

export const WPT_CONNECTIVITY: Record<string, PerfConnectivity> = {
  Cable: { name: "Cable", downKbps: 5000, upKbps: 1000, rttMs: 28 },
  DSL: { name: "DSL", downKbps: 1500, upKbps: 384, rttMs: 50 },
  "4G": { name: "4G", downKbps: 9000, upKbps: 9000, rttMs: 170 },
  "3GFast": { name: "3GFast", downKbps: 1600, upKbps: 768, rttMs: 150 },
  FIOS: { name: "FIOS", downKbps: 20000, upKbps: 5000, rttMs: 4 },
};

/**
 * Condições de teste. Padrão = mesma conexão da automação do WebPageTest (4G), tela
 * 1920x1200, sem cookie
 * de consentimento (o WPT carrega a página com o banner do OneTrust).
 * Ajustáveis por env para calibrar contra a planilha do WPT:
 *   PERF_CONNECTIVITY=Cable|DSL|4G|3GFast|FIOS  ou  PERF_CONNECTIVITY=custom:<downKbps>/<upKbps>/<rttMs>
 *   PERF_VIEWPORT=1920x1200
 *   PERF_CONSENT_COOKIE=true
 */
export interface PerfConditions {
  connectivity: PerfConnectivity;
  viewport: { width: number; height: number };
  consentCookie: boolean;
}

function parseConnectivity(value: string | undefined): PerfConnectivity {
  const raw = value?.trim();
  if (!raw) {
    return WPT_CONNECTIVITY["4G"];
  }
  const custom = raw.match(/^custom:(\d+)\/(\d+)\/(\d+)$/i);
  if (custom) {
    return {
      name: `Custom ${custom[1]}/${custom[2]} kbps, ${custom[3]} ms`,
      downKbps: Number(custom[1]),
      upKbps: Number(custom[2]),
      rttMs: Number(custom[3]),
    };
  }
  const preset = WPT_CONNECTIVITY[raw];
  if (!preset) {
    console.warn(`⚠️  PERF_CONNECTIVITY "${raw}" desconhecido; usando 4G.`);
    return WPT_CONNECTIVITY["4G"];
  }
  return preset;
}

function parseViewport(value: string | undefined): { width: number; height: number } {
  const match = value?.trim().match(/^(\d+)x(\d+)$/);
  return match
    ? { width: Number(match[1]), height: Number(match[2]) }
    : { width: 1920, height: 1200 };
}

export function getPerfConditions(): PerfConditions {
  return {
    connectivity: parseConnectivity(process.env.PERF_CONNECTIVITY),
    viewport: parseViewport(process.env.PERF_VIEWPORT),
    consentCookie: process.env.PERF_CONSENT_COOKIE === "true",
  };
}

/**
 * Pasta de saída das medições. Só o workflow do GitHub Actions grava em docs/perf (via
 * PERF_OUTPUT_DIR), que é o que o dashboard publica; execuções locais vão para reports/perf,
 * ignorada pelo git, para nunca serem commitadas por engano.
 */
export function getPerfOutputDir(cwd: string = process.cwd()): string {
  const dir = process.env.PERF_OUTPUT_DIR?.trim() || path.join("reports", "perf");
  return path.resolve(cwd, dir);
}

/** Tipos de PDP usados pela automação de Web Vitals do site geral (WebPageTest). */
export type PerfPageType = "PDPFull" | "PDPLow";

export interface PerfSkuTarget {
  sku: string;
  slug: string;
  name: string;
  pageType?: PerfPageType;
}

// Mesmos SKUs da automação que mede o site geral, para os números serem comparáveis.
export const DEFAULT_PERF_SKUS: PerfSkuTarget[] = [
  {
    sku: "NATBRA-108403",
    slug: "desodorante-colonia-kaiak-pulso-masculino-100-ml",
    name: "Desodorante Colônia Kaiak Pulso Masculino 100 ml",
    pageType: "PDPFull",
  },
  {
    sku: "NATBRA-56948",
    slug: "refil-desodorante-corporal-kaiak-masculino-100-ml",
    name: "Refil Desodorante Corporal Kaiak Masculino 100 ml",
    pageType: "PDPLow",
  },
];

function parsePageType(value: string | undefined): PerfPageType | undefined {
  return value === "PDPFull" || value === "PDPLow" ? value : undefined;
}

/** Formato de PERF_SKUS: "SKU|slug|pageType,SKU|slug|pageType" (pageType opcional: PDPFull ou PDPLow). */
export function getPerfSkus(): PerfSkuTarget[] {
  const envSkus = process.env.PERF_SKUS?.trim();
  if (!envSkus) {
    return DEFAULT_PERF_SKUS;
  }

  const parsed = envSkus
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [sku, slug, pageType] = item.split("|").map((part) => part?.trim());
      return {
        sku,
        slug: slug || "",
        name: sku,
        pageType: parsePageType(pageType),
      };
    });

  return parsed.length > 0 ? parsed : DEFAULT_PERF_SKUS;
}

export function buildPerfUrl(target: PerfSkuTarget): string {
  return buildPdpUrl({
    sku: target.sku,
    name: target.name,
    slug: target.slug,
    vendor: "natura",
    country: "BR",
    channel: "ecommerce",
  });
}
