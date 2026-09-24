import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-card border border-neutral-75 bg-surface p-5 shadow-soft transition-all duration-200',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        className,
      )}
    >
      {children}
    </span>
  );
}

interface SectionHeaderProps {
  id: string;
  title: string;
  description?: ReactNode;
  /** Small uppercase label above the title, e.g. "Plataformas". */
  eyebrow?: string;
  action?: ReactNode;
}

/** Shared section heading — keeps every dashboard section on the same type scale. */
export function SectionHeader({ id, title, description, eyebrow, action }: SectionHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && (
          <p className="mb-1 text-[11px] font-bold tracking-widest text-primary-dark uppercase">
            {eyebrow}
          </p>
        )}
        <h2 id={id} className="text-2xl font-bold tracking-tight text-highlight">
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-medium-emphasis">{description}</p>}
      </div>
      {action}
    </div>
  );
}
