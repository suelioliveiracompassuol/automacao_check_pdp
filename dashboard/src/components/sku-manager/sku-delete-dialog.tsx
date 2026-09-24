'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';

interface SkuDeleteDialogProps {
  skuName: string | null;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function SkuDeleteDialog({ skuName, onConfirm, onCancel }: SkuDeleteDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root
      open={skuName !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          aria-describedby="delete-dialog-description"
        >
          <Dialog.Close
            className="absolute right-4 top-4 rounded-lg p-1 text-low-emphasis transition-colors hover:bg-neutral-75 hover:text-medium-emphasis"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </Dialog.Close>
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-alert-lightest">
              <AlertTriangle className="h-6 w-6 text-alert-dark" aria-hidden="true" />
            </div>
            <div>
              <Dialog.Title className="text-base font-semibold text-highlight">
                Excluir SKU
              </Dialog.Title>
              <p id="delete-dialog-description" className="mt-1 text-sm text-medium-emphasis">
                Tem certeza que deseja excluir{' '}
                <span className="font-medium text-high-emphasis">{skuName}</span>? Esta ação não
                pode ser desfeita.
              </p>
            </div>
            <div className="flex w-full gap-3">
              <button
                type="button"
                onClick={onCancel}
                disabled={loading === true}
                className="flex-1 rounded-xl border border-neutral-100 bg-white px-4 py-2.5 text-sm font-medium text-high-emphasis transition-colors hover:bg-neutral-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading === true}
                className="flex-1 rounded-xl bg-alert px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-alert-dark disabled:opacity-50"
              >
                {loading === true ? 'Excluindo…' : 'Excluir'}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
