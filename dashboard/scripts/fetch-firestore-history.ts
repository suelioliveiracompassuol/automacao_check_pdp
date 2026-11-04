/**
 * Baixa do Firestore os resumos de run (coleção `runs`, gravada pelo monitor em
 * src/firestoreHistory.ts) para ../docs/reports/index.firestore.json, que o dashboard junta ao
 * histórico de docs/reports no build (ver getReportIndex em src/lib/data.ts). Assim o dashboard
 * mostra runs cujo report.json não foi commitado.
 *
 * Sem as credenciais do Firebase Admin (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL,
 * FIREBASE_PRIVATE_KEY, lidas também de .env.local) o script não faz nada, e o build segue só com
 * os arquivos. Uma falha do Firestore também não quebra o build.
 *
 * Uso: npm run history:fetch (no CI, antes do build).
 */
import { config } from 'dotenv';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

config({ path: resolve(process.cwd(), '.env.local'), quiet: true });

/** Quantos runs (das duas plataformas) baixar: 1 leitura do Firestore por run. */
const MAX_RUNS = 200;
const OUTPUT = resolve(process.cwd(), '..', 'docs', 'reports', 'index.firestore.json');

async function main() {
  const missing = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'].filter(
    (name) => !process.env[name],
  );
  if (missing.length > 0) {
    console.log(
      `ℹ️  Credenciais do Firebase Admin ausentes (${missing.join(', ')}): histórico só de docs/reports`,
    );
    return;
  }
  const { cert, getApps, initializeApp } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const app =
    getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
      }),
    });
  const snapshot = await getFirestore(app)
    .collection('runs')
    .orderBy('startTime', 'desc')
    .limit(MAX_RUNS)
    .get();
  const reports = snapshot.docs.map((doc) => doc.data());
  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, JSON.stringify({ generatedAt: new Date().toISOString(), reports }));
  console.log(`✅ ${reports.length} run(s) do Firestore em ${OUTPUT}`);
}

main().catch((err) => {
  console.warn('⚠️  Histórico do Firestore não baixado, seguindo só com docs/reports:', err);
});
