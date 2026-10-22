import { describe, it, expect, vi, beforeEach } from 'vitest';

const app = vi.hoisted(() => ({
  existing: [] as object[],
  initializeApp: vi.fn(() => ({ name: 'novo' })),
  getFirestore: vi.fn(() => ({ db: true })),
}));

vi.mock('firebase/app', () => ({
  getApps: () => app.existing,
  initializeApp: app.initializeApp,
}));
vi.mock('firebase/firestore', () => ({ getFirestore: app.getFirestore }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe('firebase-init', () => {
  it('inicializa o app quando ainda não existe', async () => {
    app.existing = [];
    const { firebaseApp } = await import('../firebase-init');
    expect(app.initializeApp).toHaveBeenCalledTimes(1);
    expect(firebaseApp).toEqual({ name: 'novo' });
  });

  it('reaproveita o app existente (hot reload)', async () => {
    const existing = { name: 'existente' };
    app.existing = [existing];
    const { firebaseApp } = await import('../firebase-init');
    expect(app.initializeApp).not.toHaveBeenCalled();
    expect(firebaseApp).toBe(existing);
  });
});

describe('firebase-client', () => {
  it('cria o Firestore a partir do app', async () => {
    app.existing = [];
    const { db } = await import('../firebase-client');
    expect(app.getFirestore).toHaveBeenCalledWith({ name: 'novo' });
    expect(db).toEqual({ db: true });
  });
});
