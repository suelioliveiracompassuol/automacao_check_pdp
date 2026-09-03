import { config } from 'dotenv';
import { resolve } from 'node:path';

// Carrega .env.local antes de inicializar o Firebase
config({ path: resolve(process.cwd(), '.env.local') });

import { readFileSync } from 'node:fs';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });

const db = getFirestore(app);

interface SkuEntry {
  id: string;
  sku: string;
  name: string;
  slug?: string;
  vendor: string;
  country: string;
  channel: string;
  expectedFeatures: string[];
}

const skusPath = resolve(process.cwd(), '..', 'config', 'skus.json');
const skus: SkuEntry[] = JSON.parse(readFileSync(skusPath, 'utf-8')) as SkuEntry[];

async function seed() {
  const col = db.collection('skus');
  // Firestore batch suporta até 500 operações por vez
  const batch = db.batch();

  for (const { id, ...data } of skus) {
    batch.set(col.doc(id), data);
  }

  await batch.commit();
  console.log(`✓ ${skus.length.toString()} SKUs gravados no Firestore (coleção "skus")`);
}

seed().catch((err: unknown) => {
  console.error('Erro ao fazer seed:', err);
  process.exit(1);
});
