import fs from 'node:fs';
import path from 'node:path';
import type { FeatureKey, SkuConfig } from '../../../types.js';

interface RawSkuEntry {
  id: string;
  sku: string;
  name: string;
  slug?: string;
  vendor: 'natura' | 'avon';
  country: 'BR' | 'AR' | 'CL' | 'CO' | 'MX' | 'PE';
  channel: string;
  expectedFeatures: string[];
}

const skusPath = path.resolve(__dirname, '../../../../config/skus.json');
const RAW_SKUS: RawSkuEntry[] = JSON.parse(fs.readFileSync(skusPath, 'utf-8'));

export const SKUS: SkuConfig[] = RAW_SKUS.map((raw) => ({
  sku: raw.sku,
  name: raw.name,
  slug: raw.slug,
  vendor: raw.vendor,
  country: raw.country,
  channel: raw.channel !== 'ecommerce' ? (raw.channel as 'socialcommerce') : undefined,
  expectedFeatures: raw.expectedFeatures.length > 0 ? (raw.expectedFeatures as FeatureKey[]) : undefined,
}));
