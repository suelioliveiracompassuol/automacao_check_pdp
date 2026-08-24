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

export async function readSkus(): Promise<SkuEntry[]> {
  const snapshot = await getDocs(query(collection(db, COL), orderBy('sku')));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as SkuEntry));
}

export async function createSku(data: Omit<SkuEntry, 'id'>): Promise<SkuEntry> {
  const id = data.channel === 'socialcommerce' ? `${data.sku}:sc` : data.sku;
  await setDoc(doc(db, COL, id), data);
  return { id, ...data };
}

export async function updateSku(id: string, data: Partial<Omit<SkuEntry, 'id'>>): Promise<SkuEntry | null> {
  const ref = doc(db, COL, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  await updateDoc(ref, data as Record<string, unknown>);
  return { id, ...snap.data(), ...data } as SkuEntry;
}

export async function deleteSku(id: string): Promise<boolean> {
  const ref = doc(db, COL, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return false;
  await deleteDoc(ref);
  return true;
}
