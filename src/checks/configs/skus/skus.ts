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

function toSkuConfig(raw: RawSkuEntry): SkuConfig {
  return {
    sku: raw.sku,
    name: raw.name,
    slug: raw.slug,
    vendor: raw.vendor,
    country: raw.country,
    channel: raw.channel !== 'ecommerce' ? (raw.channel as 'socialcommerce') : undefined,
    expectedFeatures: raw.expectedFeatures.length > 0 ? (raw.expectedFeatures as FeatureKey[]) : undefined,
  };
}

function loadFromJson(): SkuConfig[] {
  const skusPath = path.resolve(__dirname, '../../../../config/skus.json');
  return (JSON.parse(fs.readFileSync(skusPath, 'utf-8')) as RawSkuEntry[]).map(toSkuConfig);
}

async function loadFromFirestore(): Promise<SkuConfig[]> {
  const { db } = await import('../../../firebase.js');
  const snapshot = await db.collection('skus').orderBy('sku').get();
  return snapshot.docs.map((doc) => toSkuConfig({ id: doc.id, ...doc.data() } as RawSkuEntry));
}

/** Carrega SKUs do Firestore se configurado, ou do config/skus.json como fallback. */
export async function loadSkus(): Promise<SkuConfig[]> {
  if (!process.env.FIREBASE_PROJECT_ID) {
    console.log('ℹ️  FIREBASE_PROJECT_ID não definido — usando config/skus.json');
    return loadFromJson();
  }
  try {
    const skus = await loadFromFirestore();
    console.log(`✅ ${skus.length} SKUs carregados do Firestore`);
    return skus;
  } catch (err) {
    console.warn('⚠️  Falha ao carregar SKUs do Firestore, usando config/skus.json como fallback:', err);
    return loadFromJson();
  }
}
