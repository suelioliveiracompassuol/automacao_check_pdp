import { formatMs } from '@/lib/format';
import type { PerfOpportunity } from '@/lib/types';
import { cn } from '@/lib/utils';

interface OpportunitiesListProps {
  items: PerfOpportunity[];
  className?: string;
}

export function OpportunitiesList({ items, className }: OpportunitiesListProps) {
  if (!items || items.length === 0) {
    return (
      <div className={cn('text-xs text-medium-emphasis', className)}>
        <p className="font-semibold text-highlight mb-1">Oportunidades de Otimização</p>
        <p className="italic text-low-emphasis">Nenhuma oportunidade relevante</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-xs font-semibold text-highlight">Oportunidades de Otimização</p>
      <ul className="space-y-1.5 text-xs">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded bg-neutral-50 px-2.5 py-1.5 border border-neutral-75"
          >
            <span className="font-medium text-high-emphasis">{item.title}</span>
            <span className="font-semibold text-primary-darkest tabular-nums">
              economia estimada: {formatMs(item.savingsMs)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
