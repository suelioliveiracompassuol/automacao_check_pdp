import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ToggleGroupProps {
  /** Rótulo acessível do grupo (ex.: "Filtrar por status"). */
  label: string;
  className?: string;
  children: ReactNode;
}

/** Grupo segmentado de botões de filtro (um ativo por vez, sinalizado por aria-pressed). */
export function ToggleGroup({ label, className, children }: ToggleGroupProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('flex items-center gap-1 rounded-lg bg-neutral-50 p-1', className)}
    >
      {children}
    </div>
  );
}

interface ToggleButtonProps {
  pressed: boolean;
  onClick: () => void;
  size?: 'sm' | 'md';
  ariaLabel?: string;
  /** Tooltip nativo (ex.: nome completo do país). */
  title?: string;
  /** Opção sem resultados para os outros filtros: visível, mas não clicável. */
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

export function ToggleButton({
  pressed,
  onClick,
  size = 'md',
  ariaLabel,
  title,
  disabled,
  className,
  children,
}: ToggleButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-md font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40',
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-1.5 text-sm',
        pressed
          ? 'bg-white text-highlight shadow-sm'
          : 'text-medium-emphasis enabled:hover:text-high-emphasis',
        className,
      )}
    >
      {children}
    </button>
  );
}
