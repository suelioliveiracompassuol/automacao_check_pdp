/**
 * Operation group of the reference images (`dashboard/public/feature-refs/<group>/`).
 *
 * No imports on purpose: the dashboard test (dashboard/src/lib/__tests__/feature-refs.test.ts)
 * loads this file to check that its own `refGroupOf` gives the same groups.
 */

/** Natura CO/CL/PE/MX share one layout and the same (neutral) Spanish copy. */
const NATURA_LATAM = new Set(["CO", "CL", "PE", "MX"]);

export function refGroupOf(sku: {
  vendor: string;
  country: string;
  channel?: string;
}): string {
  if (sku.channel === "socialcommerce") {
    return `minha-loja-${sku.vendor}`;
  }
  if (sku.vendor === "natura" && NATURA_LATAM.has(sku.country)) {
    return "natura-latam";
  }
  return `${sku.vendor}-${sku.country.toLowerCase()}`;
}
