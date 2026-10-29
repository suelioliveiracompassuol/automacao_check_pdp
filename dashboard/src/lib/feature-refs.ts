import { basePath } from './config';
import type { PdpCheckResult } from './types';

/**
 * Reference images: one fixed screenshot per feature per operation group, showing what each
 * check looks for. They live in `public/feature-refs/<group>/<featureKey>.png`, captured by the
 * monitor's `npm run refs:capture` or added by hand when the WAF blocks the capture.
 */

/** Available images per group (`natura-br` → `['reviews', 'coupons', …]`), read at build time. */
export type FeatureRefIndex = Record<string, string[]>;

/** Natura CO/CL/PE/MX share one layout and the same (neutral) Spanish copy. */
const NATURA_LATAM = new Set(['CO', 'CL', 'PE', 'MX']);

/** Same grouping as the monitor's src/featureRefGroups.ts (checked by the feature-refs test). */
export function refGroupOf(result: Pick<PdpCheckResult, 'vendor' | 'country' | 'channel'>): string {
  if (result.channel === 'socialcommerce') {
    return `minha-loja-${result.vendor}`;
  }
  if (result.vendor === 'natura' && NATURA_LATAM.has(result.country)) {
    return 'natura-latam';
  }
  return `${result.vendor}-${result.country.toLowerCase()}`;
}

/** featureKey → image URL for the result's operation group. */
export function featureRefUrls(
  index: FeatureRefIndex,
  result: Pick<PdpCheckResult, 'vendor' | 'country' | 'channel'>,
): Record<string, string> {
  const group = refGroupOf(result);
  return Object.fromEntries(
    (index[group] ?? []).map((key) => [key, `${basePath}/feature-refs/${group}/${key}.png`]),
  );
}
