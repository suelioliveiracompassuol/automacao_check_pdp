'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** id do elemento que descreve o diálogo (aria-describedby). */
  describedBy: string;
  className?: string;
  children: ReactNode;
}

/** Diálogo centralizado (Radix) com overlay — base dos modais do SKU Manager. */
export function Modal({ open, onClose, describedBy, className, children }: ModalProps) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={describedBy}
          className={cn(
            'dialog-content fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-xl',
            className,
          )}
        >
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const ModalTitle = Dialog.Title;

export function ModalCloseButton({ className }: { className?: string }) {
  return (
    <Dialog.Close
      aria-label="Fechar"
      className={cn(
        'rounded-lg p-2 text-low-emphasis transition-colors hover:bg-neutral-75 hover:text-medium-emphasis',
        className,
      )}
    >
      <X className="h-4 w-4" aria-hidden="true" />
    </Dialog.Close>
  );
}

/** Classes dos botões de ação dos modais. */
export const modalButtonClass = {
  secondary:
    'rounded-xl border border-neutral-100 bg-white px-4 py-2.5 text-sm font-medium text-high-emphasis transition-colors hover:bg-neutral-50 disabled:opacity-50',
  primary:
    'rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-highlight transition-colors hover:bg-primary-dark disabled:opacity-50',
  danger:
    'rounded-xl bg-alert px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-alert-dark disabled:opacity-50',
};
