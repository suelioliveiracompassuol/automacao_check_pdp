import fs from 'fs';
import path from 'path';
import type { SkuEntry } from './types';

const SKU_FILE_PATH = path.resolve(process.cwd(), '..', 'config', 'skus.json');

export function readSkus(): SkuEntry[] {
  const raw = fs.readFileSync(SKU_FILE_PATH, 'utf-8');
  return JSON.parse(raw) as SkuEntry[];
}

export function writeSkus(skus: SkuEntry[]): void {
  fs.writeFileSync(SKU_FILE_PATH, JSON.stringify(skus, null, 2) + '\n', 'utf-8');
}

export function createSku(data: Omit<SkuEntry, 'id'>): SkuEntry {
  const skus = readSkus();
  const id = data.channel === 'socialcommerce' ? `${data.sku}:sc` : data.sku;
  const newEntry: SkuEntry = { id, ...data };
  skus.push(newEntry);
  writeSkus(skus);
  return newEntry;
}

export function updateSku(id: string, data: Partial<Omit<SkuEntry, 'id'>>): SkuEntry | null {
  const skus = readSkus();
  const index = skus.findIndex((s) => s.id === id);
  if (index === -1) return null;
  skus[index] = { ...skus[index], ...data };
  writeSkus(skus);
  return skus[index];
}

export function deleteSku(id: string): boolean {
  const skus = readSkus();
  const index = skus.findIndex((s) => s.id === id);
  if (index === -1) return false;
  skus.splice(index, 1);
  writeSkus(skus);
  return true;
}
