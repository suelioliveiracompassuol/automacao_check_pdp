import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase-client';
import type { CatalogQualityReport } from './types';

/**
 * Validação do catálogo, publicada pelo `npm run catalog` no Firestore. Não vai no export
 * estático (ficaria legível no HTML): só é lida no navegador, depois do login, e as regras
 * do Firestore recusam a leitura de quem não está autenticado.
 */
const COL = 'catalogQuality';

/** null quando a operação ainda não tem validação publicada. */
export async function readCatalogQuality(operation: string): Promise<CatalogQualityReport | null> {
  const snap = await getDoc(doc(db, COL, operation));
  return snap.exists() ? (snap.data() as CatalogQualityReport) : null;
}
