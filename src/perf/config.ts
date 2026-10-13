import { buildPdpUrl } from "../checks/configs/config.js";
import { DEFAULT_USER_AGENT } from "../browserSetup.js";

export const PERF_RUNS_PER_SKU = 3;
export const PERF_USER_AGENT = DEFAULT_USER_AGENT;

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
