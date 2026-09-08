'use client';

import { useCallback, useEffect, useState } from 'react';

import { Plus } from 'lucide-react';

import { SkuDeleteDialog } from '@/components/sku-manager/sku-delete-dialog';
import { SkuForm } from '@/components/sku-manager/sku-form';
import { SkuList } from '@/components/sku-manager/sku-list';
import { AuthGuard, AuthDisabledButton } from '@/components/auth-guard';
import { useAuth } from '@/components/auth-context';
import { createSku, deleteSku, readSkus, updateSku } from '@/lib/sku-data-client';
import type { SkuEntry } from '@/lib/types';

export function SkusClient() {
  const { user, loading: authLoading } = useAuth();
  const [skus, setSkus] = useState<SkuEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<SkuEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    readSkus()
      .then(setSkus)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const deletingName =
    deletingId !== null ? (skus.find((s) => s.id === deletingId)?.name ?? null) : null;

  const openCreate = useCallback(() => {
    setEditingEntry(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((entry: SkuEntry) => {
    setEditingEntry(entry);
    setFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditingEntry(null);
  }, []);

  const handleCreate = useCallback(
    async (data: Omit<SkuEntry, 'id'>) => {
      const created = await createSku(data);
      setSkus((prev) => [...prev, created]);
      closeForm();
    },
    [closeForm],
  );

  const handleUpdate = useCallback(
    async (data: Omit<SkuEntry, 'id'>) => {
      if (editingEntry === null) return;
      const updated = await updateSku(editingEntry.id, data);
      if (updated === null) throw new Error('SKU não encontrado');
      setSkus((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      closeForm();
    },
    [editingEntry, closeForm],
  );

  const handleSubmit = useCallback(
    async (data: Omit<SkuEntry, 'id'>) => {
      if (editingEntry !== null) {
        await handleUpdate(data);
      } else {
        await handleCreate(data);
      }
    },
    [editingEntry, handleCreate, handleUpdate],
  );

  const handleDelete = useCallback(async () => {
    if (deletingId === null) return;
    await deleteSku(deletingId);
    setSkus((prev) => prev.filter((s) => s.id !== deletingId));
    setDeletingId(null);
  }, [deletingId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-gray-400">
        Carregando SKUs…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Gerenciar SKUs</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Cadastro de produtos monitorados pela automação
          </p>
        </div>
        <AuthDisabledButton disabled={!user || authLoading}>
          <button
            type="button"
            onClick={openCreate}
            disabled={!user || authLoading}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Novo SKU
          </button>
        </AuthDisabledButton>
      </div>

      {!user && !authLoading && (
        <AuthGuard>
          <div></div>
        </AuthGuard>
      )}

      <SkuList skus={skus} onEdit={openEdit} onDelete={setDeletingId} disabled={!user} />
      <SkuForm
        open={formOpen}
        initialData={editingEntry}
        onSubmit={handleSubmit}
        onClose={closeForm}
      />
      <SkuDeleteDialog
        skuName={deletingName}
        onConfirm={handleDelete}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
}
