import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase-client';
import type { SkuEntry } from './types';

const COL = 'skus';

function getSkuDocumentId(sku: string, channel: string): string {
  return channel === 'socialcommerce' ? `${sku}:sc` : sku;
}

export async function readSkus(): Promise<SkuEntry[]> {
  const snapshot = await getDocs(query(collection(db, COL), orderBy('sku')));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as SkuEntry);
}

export async function createSku(data: Omit<SkuEntry, 'id'>): Promise<SkuEntry> {
  const id = getSkuDocumentId(data.sku, data.channel);
  const ref = doc(db, COL, id);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    throw new Error(`SKU já cadastrado para o identificador ${id}`);
  }

  await setDoc(ref, data);
  return { id, ...data };
}

export async function updateSku(
  id: string,
  data: Partial<Omit<SkuEntry, 'id'>>,
): Promise<SkuEntry | null> {
  const ref = doc(db, COL, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const current = snap.data() as Partial<SkuEntry>;
  const merged = { ...current, ...data } as Partial<SkuEntry>;
  const nextId = getSkuDocumentId(
    merged.sku ?? current.sku ?? id,
    merged.channel ?? current.channel ?? 'ecommerce',
  );

  if (nextId !== id) {
    const nextRef = doc(db, COL, nextId);
    const nextSnap = await getDoc(nextRef);

    if (nextSnap.exists() && nextSnap.id !== id) {
      throw new Error(`SKU já cadastrado para o identificador ${nextId}`);
    }

    await setDoc(nextRef, merged as Omit<SkuEntry, 'id'>);
    await deleteDoc(ref);
    return { id: nextId, ...merged } as SkuEntry;
  }

  await updateDoc(ref, data as Record<string, unknown>);
  return { id, ...current, ...data } as SkuEntry;
}

export async function deleteSku(id: string): Promise<boolean> {
  const ref = doc(db, COL, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return false;
  await deleteDoc(ref);
  return true;
}
