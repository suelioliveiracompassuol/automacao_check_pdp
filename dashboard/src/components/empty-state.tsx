import type { ReactNode } from 'react';
import type { Platform } from '@/lib/types';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  badge?: string;
  description?: ReactNode;
  /** Página de plataforma: usa a cor dela no lugar da faixa laranja→amarela. */
  platform?: Platform;
}

/** Estado vazio de página inteira (plataforma sem dados, nenhuma execução ainda). */
export function EmptyState({ icon, title, badge, description, platform }: EmptyStateProps) {
  return (
    <div
      data-platform={platform}
      className="relative mx-auto mt-6 max-w-2xl overflow-hidden rounded-card border border-neutral-75 bg-surface px-8 py-16 text-center shadow-soft"
    >
      <div
        className={`absolute inset-x-0 top-0 h-1 ${platform ? 'bg-platform' : 'bg-brand-gradient'}`}
        aria-hidden="true"
      />
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-platform-wash text-3xl text-platform">
        {icon}
      </div>
      {badge && (
        <span className="mb-3 inline-block rounded-full bg-secondary-lightest/60 px-3 py-1 text-[11px] font-bold tracking-widest text-secondary-darkest uppercase">
          {badge}
        </span>
      )}
      <h1 className="text-xl font-bold text-highlight">{title}</h1>
      {description && (
        <div className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-medium-emphasis">
          {description}
        </div>
      )}
    </div>
  );
}
