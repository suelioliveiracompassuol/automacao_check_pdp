import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn().mockResolvedValue(undefined),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  collection: vi.fn(() => 'col-ref'),
  doc: vi.fn(() => 'doc-ref'),
  orderBy: vi.fn(() => 'order'),
  query: vi.fn(() => 'query-ref'),
}));

vi.mock('firebase/firestore', () => ({
  collection: mocks.collection,
  getDocs: mocks.getDocs,
  doc: mocks.doc,
  getDoc: mocks.getDoc,
  setDoc: mocks.setDoc,
  updateDoc: mocks.updateDoc,
  deleteDoc: mocks.deleteDoc,
  orderBy: mocks.orderBy,
  query: mocks.query,
}));

vi.mock('@/lib/firebase-client', () => ({ db: {} }));

import { readSkus, createSku, updateSku, deleteSku } from '@/lib/sku-data-client';

const BASE = {
  sku: 'NATBRA-70983',
  name: 'Creme Hidratante Ekos',
  vendor: 'natura' as const,
  country: 'BR' as const,
  channel: 'ecommerce' as const,
  expectedFeatures: [] as never[],
};

describe('readSkus', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mapeia docs do Firestore para SkuEntry[]', async () => {
    mocks.getDocs.mockResolvedValue({
      docs: [{ id: 'NATBRA-70983', data: () => ({ ...BASE }) }],
    });
    const result = await readSkus();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'NATBRA-70983', ...BASE });
  });

  it('retorna array vazio quando não há documentos', async () => {
    mocks.getDocs.mockResolvedValue({ docs: [] });
    const result = await readSkus();
    expect(result).toEqual([]);
  });

  it('relança erros do Firestore', async () => {
    mocks.getDocs.mockRejectedValue(new Error('Firestore error'));
    await expect(readSkus()).rejects.toThrow('Firestore error');
  });
});

describe('createSku', () => {
  beforeEach(() => vi.clearAllMocks());

  it('usa o sku como document ID para canal ecommerce', async () => {
    await createSku(BASE);
    expect(mocks.doc).toHaveBeenCalledWith({}, 'skus', 'NATBRA-70983');
    expect(mocks.setDoc).toHaveBeenCalledWith('doc-ref', BASE);
  });

  it('adiciona :sc ao document ID para canal socialcommerce', async () => {
    await createSku({ ...BASE, channel: 'socialcommerce' });
    expect(mocks.doc).toHaveBeenCalledWith({}, 'skus', 'NATBRA-70983:sc');
  });

  it('retorna a entrada criada com o id correto', async () => {
    const result = await createSku(BASE);
    expect(result).toEqual({ id: 'NATBRA-70983', ...BASE });
  });
});

describe('updateSku', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna null e não chama updateDoc quando doc não existe', async () => {
    mocks.getDoc.mockResolvedValue({ exists: () => false });
    const result = await updateSku('NATBRA-70983', { name: 'Novo Nome' });
    expect(result).toBeNull();
    expect(mocks.updateDoc).not.toHaveBeenCalled();
  });

  it('atualiza e retorna entrada mesclada quando doc existe', async () => {
    mocks.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ ...BASE }) });
    const result = await updateSku('NATBRA-70983', { name: 'Novo Nome' });
    expect(mocks.updateDoc).toHaveBeenCalledWith('doc-ref', { name: 'Novo Nome' });
    expect(result).toMatchObject({ id: 'NATBRA-70983', name: 'Novo Nome' });
  });
});

describe('deleteSku', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna false e não chama deleteDoc quando doc não existe', async () => {
    mocks.getDoc.mockResolvedValue({ exists: () => false });
    const result = await deleteSku('NATBRA-70983');
    expect(result).toBe(false);
    expect(mocks.deleteDoc).not.toHaveBeenCalled();
  });

  it('deleta e retorna true quando doc existe', async () => {
    mocks.getDoc.mockResolvedValue({ exists: () => true });
    const result = await deleteSku('NATBRA-70983');
    expect(result).toBe(true);
    expect(mocks.deleteDoc).toHaveBeenCalledWith('doc-ref');
  });
});
