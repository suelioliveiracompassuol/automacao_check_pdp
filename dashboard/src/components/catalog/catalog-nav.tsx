import Link from 'next/link';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/catalogo', key: 'products', label: 'Produtos' },
  { href: '/catalogo/qualidade', key: 'quality', label: 'Qualidade' },
] as const;

/** Abas do catálogo: cada uma é uma rota (export estático), por isso links e não Radix Tabs. */
export function CatalogNav({ active }: { active: (typeof LINKS)[number]['key'] }) {
  return (
    <nav
      aria-label="Seções do catálogo"
      className="inline-flex w-fit items-center gap-1 rounded-full border border-neutral-75 bg-surface p-1 shadow-tiny"
    >
      {LINKS.map(({ href, key, label }) => (
        <Link
          key={key}
          href={href}
          aria-current={active === key ? 'page' : undefined}
          className={cn(
            'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
            active === key
              ? 'bg-highlight font-bold text-white'
              : 'text-medium-emphasis hover:text-high-emphasis',
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
