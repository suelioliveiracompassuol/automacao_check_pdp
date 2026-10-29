'use client';

import { useCallback, useEffect, useState } from 'react';

import { Plus } from 'lucide-react';

import { SkuDeleteDialog } from '@/components/sku-manager/sku-delete-dialog';
import { SkuForm } from '@/components/sku-manager/sku-form';
import { SkuList } from '@/components/sku-manager/sku-list';
import { AuthDisabledButton, AuthRequiredNotice } from '@/components/auth-guard';
import { useAuth } from '@/components/auth-context';
import { createSku, deleteSku, readSkus, updateSku } from '@/lib/sku-data-client';
import type { SkuEntry } from '@/lib/types';

type SkuPayload = Omit<SkuEntry, 'id'>;

export function SkusClient() {
  const { user, loading: authLoading } = useAuth();
  const [skus, setSkus] = useState<SkuEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  // Muda a cada abertura para remontar o formulário com o estado inicial certo.
  const [formKey, setFormKey] = useState(0);
  const [editingEntry, setEditingEntry] = useState<SkuEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    readSkus()
      .then(setSkus)
      .catch((error: unknown) => {
        console.error(error);
        setLoadError('Não foi possível carregar os SKUs. Tente recarregar a página.');
      })
      .finally(() => setLoading(false));
  }, []);

  const canEdit = Boolean(user) && !authLoading;
  const deletingName =
    deletingId !== null ? (skus.find((s) => s.id === deletingId)?.name ?? null) : null;

  const openForm = useCallback((entry: SkuEntry | null) => {
    setEditingEntry(entry);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  }, []);

  const closeForm = useCallback(() => setFormOpen(false), []);

  const handleSubmit = useCallback(
    async (data: SkuPayload) => {
      if (editingEntry === null) {
        const created = await createSku(data);
        setSkus((prev) => [...prev, created]);
      } else {
        const updated = await updateSku(editingEntry.id, data);
        if (updated === null) {
          throw new Error('SKU não encontrado');
        }
        // O id muda quando sku/canal mudam, então substitui pelo id antigo.
        setSkus((prev) => prev.map((s) => (s.id === editingEntry.id ? updated : s)));
      }
      closeForm();
    },
    [editingEntry, closeForm],
  );

  const handleDelete = useCallback(async () => {
    if (deletingId === null) {
      return;
    }
    await deleteSku(deletingId);
    setSkus((prev) => prev.filter((s) => s.id !== deletingId));
    setDeletingId(null);
  }, [deletingId]);

  if (loading) {
    return (
      <div
        role="status"
        className="flex items-center justify-center py-24 text-sm text-low-emphasis"
      >
        Carregando SKUs…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-highlight">Gerenciar SKUs</h1>
          <p className="mt-0.5 text-sm text-medium-emphasis">
            Cadastro de produtos monitorados pela automação
          </p>
        </div>
        <AuthDisabledButton disabled={!canEdit}>
          <button
            type="button"
            onClick={() => openForm(null)}
            disabled={!canEdit}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-highlight transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Novo SKU
          </button>
        </AuthDisabledButton>
      </div>

      {!user && !authLoading && <AuthRequiredNotice />}

      {loadError && (
        <p
          role="alert"
          className="rounded-lg border border-alert-light/60 bg-alert-lightest/50 p-4 text-sm text-alert-dark"
        >
          {loadError}
        </p>
      )}

      <SkuList skus={skus} onEdit={openForm} onDelete={setDeletingId} disabled={!user} />
      <SkuForm
        key={formKey}
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
