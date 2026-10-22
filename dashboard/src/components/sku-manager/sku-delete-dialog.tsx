'use client';

import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { Modal, ModalCloseButton, ModalTitle, modalButtonClass } from '@/components/ui/modal';

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
    <Modal
      open={skuName !== null}
      onClose={onCancel}
      describedBy="delete-dialog-description"
      className="max-w-md p-6"
    >
      <ModalCloseButton className="absolute top-3 right-3" />
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-alert-lightest">
          <AlertTriangle className="h-6 w-6 text-alert-dark" aria-hidden="true" />
        </div>
        <div>
          <ModalTitle className="text-base font-semibold text-highlight">Excluir SKU</ModalTitle>
          <p id="delete-dialog-description" className="mt-1 text-sm text-medium-emphasis">
            Tem certeza que deseja excluir{' '}
            <span className="font-medium text-high-emphasis">{skuName}</span>? Esta ação não pode
            ser desfeita.
          </p>
        </div>
        <div className="flex w-full gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className={`flex-1 ${modalButtonClass.secondary}`}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className={`flex-1 ${modalButtonClass.danger}`}
          >
            {loading ? 'Excluindo…' : 'Excluir'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
