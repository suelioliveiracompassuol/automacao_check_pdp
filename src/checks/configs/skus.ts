// =============================================================================
// SKUs TO MONITOR
// =============================================================================

import { SkuConfig, Vendor, Country } from "../../types";

type RawSkuConfig = Omit<SkuConfig, "vendor" | "country"> & {
  vendor?: Vendor;
  country?: Country;
};

const RAW_SKUS: RawSkuConfig[] = [
  // ===== SKUs OURO (Alta prioridade) =====
  {
    sku: "NATBRA-169786",
    name: "Kaiak Ultra Masculino 100ml",
    slug: "deo-colonia-kaiak-ultra-masculino-100-ml",
  },
  {
    sku: "NATBRA-108875",
    name: "Sabonete em Barra Kaiak",
    slug: "sabonete-em-barra-corpo-e-barba-kaiak-2-un-de-90-g-cada",
  },
  {
    sku: "NATBRA-216032",
    name: "Kit Desodorante Kaiak Oceano",
    slug: "kit-desodorante-spray-corporal-kaiak-oceano-masculino-3-produtos",
  },
  {
    sku: "NATBRA-189390",
    name: "Desodorante Roll-on Kaiak Masculino",
    slug: "desodorante-antitranspirante-roll-on-kaiak-masculino-75-ml",
  },
  {
    sku: "NATBRA-258116",
    name: "Kit Desodorante Kaiak Clássico com Refil",
    slug: "kit-desodorante-corporal-kaiak-classico-masculino-com-refil-2-unidades-de-100-ml",
  },

  // ===== SKUs CRÍTICOS (Monitoramento especial) =====
  {
    sku: "NATBRA-171117",
    name: "Kaiak Aventura Intensa Masculino",
    slug: "desodorante-colonia-kaiak-aventura-intensa-masculino-100-ml",
  },
  {
    sku: "NATBRA-249685",
    name: "Kaiak Extremo Masculino Promoção",
    slug: "desodorante-colonia-kaiak-extremo-masculino-promocao-vai-dar-onda-100-ml",
  },
  {
    sku: "NATBRA-242220",
    name: "Presente Kaiak Aventura Feminino",
    slug: "presente-dia-dos-namorados-natura-kaiak-aventura",
  },
  {
    sku: "NATBRA-194223",
    name: "Kaiak Oceano Feminino Miniatura",
    slug: "desodorante-colonia-kaiak-oceano-feminino-miniatura-25-ml",
  },
  {
    sku: "NATBRA-160214",
    name: "Body Splash Kaiak Aventura",
    slug: "body-splash-desodorante-colonia-kaiak-aventura-feminino-200-ml",
  },

  // ===== SKU com Shop the Set =====
  {
    sku: "NATBRA-172407",
    name: "Óleo em Creme Tododia Jambo Rosa e Flor de Caju",
    slug: "oleo-em-creme-ultranutritivo-restaurador-tododia-jambo-rosa-e-flor-de-caju-200-ml",
    expectedFeatures: ["shopTheSet"],
  },
  {
    sku: "NATBRA-167756",
    name: "Essencial Sentir Feminino 100ml",
    slug: "essencial-sentir-feminino-100-ml",
  },

  // ===== SKUs POR CENÁRIO (Cobertura de features específicas) =====
  // Cenário: Produto com reviews ativos
  {
    sku: "NATBRA-246411",
    name: "Kaiak Masculino Promoção",
    slug: "desodorante-colonia-kaiak-masculino-promocao-vai-dar-onda-100-ml",
  },
  {
    sku: "NATBRA-242233",
    name: "Presente Kaiak Pulso",
    slug: "presente-dia-dos-namorados-natura-kaiak-pulso",
  },

  // ===== AVON BRASIL =====
  {
    sku: "AVNBRA-251533",
    name: "Iconic Batom Crystal",
    slug: "avon-iconic-batom-labial-24-g",
  },
  {
    sku: "AVNBRA-222050",
    name: "Volume Max Máscara Para Cílios",
    slug: "avon-supershock-volume-max-mascara-para-cilios-10-ml",
  },

  // ===== NATURA ARGENTINA =====
  {
    sku: "NATARG-81950",
    name: "Homem Potence EDP 100ml",
    slug: "homem-potence-edp-100-ml",
  },
  {
    sku: "NATARG-83323",
    name: "Kriska Shock EDT Femenino 100ml",
    slug: "kriska-shock-eau-de-toilette-femenino-100ml",
  },

  // ===== AVON ARGENTINA =====
  {
    sku: "AVNARG-207446",
    name: "Perfume de Mujer Lov/u",
    slug: "perfume-de-mujer-lov-u",
  },
  {
    sku: "AVNARG-135885",
    name: "Musk+ Instinct Masculino 75ml",
    slug: "eau-de-toilette-musk-instinct-masculino-75-ml",
  },

  // ===== NATURA CHILE =====
  {
    sku: "NATCHL-81950",
    name: "Homem Potence EDP Masculino 100ml",
    slug: "homem-potence-edp-masculino-homem-100ml",
  },
  {
    sku: "NATCHL-111172",
    name: "Kaiak Urbe EDT Masculino 100ml",
    slug: "kaiak-urbe-eau-de-toilette-masculino-100-ml",
  },

  // ===== NATURA COLOMBIA =====
  {
    sku: "NATCOL-73573",
    name: "Ekos Pitanga EDT Femenino 150ml",
    slug: "eau-de-toilette-ekos-pitanga-femenino-150ml",
  },
  {
    sku: "NATCOL-111174",
    name: "Kaiak Aero EDT Masculino 100ml",
    slug: "eau-de-toilette-kaiak-aero-masculino-100-ml",
  },

  // ===== NATURA MEXICO =====
  {
    sku: "NATMEX-81950",
    name: "Homem Potence EDP Masculino",
    slug: "natura-homem-eau-de-parfum-masculino-potence",
  },
  {
    sku: "NATMEX-111172",
    name: "Kaiak Urbe EDT Masculino",
    slug: "kaiak-urbe-eau-de-toilette-masculino",
  },

  // ===== NATURA PERU =====
  {
    sku: "NATPER-64746",
    name: "Meu Primeiro Humor EDT Femenino 75ml",
    slug: "humor-eau-de-toilette-femenina-meu-primeiro-humor-75-ml",
  },
  {
    sku: "NATPER-111172",
    name: "Kaiak Urbe EDT Masculino 100ml",
    slug: "kaiak-eau-de-toilette-masculino-urbe-100-ml",
  },

  // ===== SOCIAL COMMERCE - MINHA LOJA (BR) =====
  // Natura no Minha Loja
  {
    sku: "NATBRA-249685",
    name: "Kaiak Extremo Masculino (Social Commerce)",
    slug: "desodorante-colonia-kaiak-extremo-masculino-promocao-vai-dar-onda-100-ml",
    channel: "socialcommerce",
  },
  {
    sku: "NATBRA-172407",
    name: "Óleo em Creme Tododia Jambo Rosa (Social Commerce)",
    slug: "oleo-em-creme-ultranutritivo-restaurador-tododia-jambo-rosa-e-flor-de-caju-200-ml",
    channel: "socialcommerce",

    expectedFeatures: ["shopTheSet"],
  },
  // Avon no Minha Loja
  {
    sku: "AVNBRA-251533",
    name: "Iconic Batom Crystal (Social Commerce)",
    slug: "avon-iconic-batom-labial-24-g",
    channel: "socialcommerce",
  },
  {
    sku: "AVNBRA-222050",
    name: "Volume Max Máscara Para Cílios (Social Commerce)",
    slug: "avon-supershock-volume-max-mascara-para-cilios-10-ml",
    channel: "socialcommerce",
  },

  // ===== AVON MEXICO =====
  // TODO: Add Avon MX SKUs (site was unreachable during setup)
];

export const SKUS: SkuConfig[] = RAW_SKUS.map((raw) => {
  const prefix = raw.sku.split("-")[0];

  let vendorCode: string;
  let countryCode: string;

  if (prefix.startsWith("AVON")) {
    vendorCode = "AVON";
    countryCode = prefix.substring(4);
  } else {
    vendorCode = prefix.substring(0, 3);
    countryCode = prefix.substring(3);
  }

  const inferredVendor: Vendor =
    vendorCode === "AVN" || vendorCode === "AVON" ? "avon" : "natura";

  const countryMap: Record<string, Country> = {
    BRA: "BR",
    ARG: "AR",
    CHL: "CL",
    COL: "CO",
    MEX: "MX",
    PER: "PE",
  };
  const inferredCountry: Country = countryMap[countryCode] || "BR";

  return {
    ...raw,
    vendor: raw.vendor || inferredVendor,
    country: raw.country || inferredCountry,
  };
});
