import { RawSkuConfig } from "../../../types";

// =============================================================================
// SKUs TO MONITOR
// =============================================================================

import { SkuConfig, Vendor, Country } from "../../../types";
import { NATURA_BR_SKUS } from "./natura-br.js";
import { NATURA_AR_SKUS } from "./natura-ar.js";
import { NATURA_CO_SKUS } from "./natura-co";
import { NATURA_CL_SKUS } from "./natura-cl";
import { NATURA_MX_SKUS } from "./natura-mx";
import { NATURA_PE_SKUS } from "./natura-pe";
import { MINHA_LOJA_AVON_NATURA_BR_SKUS } from "./minha-loja-avon-natura-br";
import { AVON_BR_SKUS } from "./avon-br";
import { AVON_AR_SKUS } from "./avon-ar";
import { AVON_MX_SKUS } from "./avon-mx";

const RAW_SKUS: RawSkuConfig[] = [
  // ===== NATURA BRASIL =====
  ...NATURA_BR_SKUS,

  // ===== NATURA ARGENTINA =====
  ...NATURA_AR_SKUS,

  // ===== NATURA CHILE =====
  ...NATURA_CL_SKUS,

  // ===== NATURA COLOMBIA =====
  ...NATURA_CO_SKUS,

  // ===== NATURA MEXICO =====
  ...NATURA_MX_SKUS,

  // ===== NATURA PERU =====
  ...NATURA_PE_SKUS,

  // ===== SOCIAL COMMERCE - MINHA LOJA (BR) AVON/NATURA =====
  ...MINHA_LOJA_AVON_NATURA_BR_SKUS,

  // ===== AVON BRASIL =====
  ...AVON_BR_SKUS,

  // ===== AVON ARGENTINA =====
  ...AVON_AR_SKUS,

  // ===== AVON MEXICO =====
  ...AVON_MX_SKUS,
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
