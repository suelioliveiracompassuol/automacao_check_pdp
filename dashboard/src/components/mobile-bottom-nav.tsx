'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ALL_NAV, isNavActive } from '@/lib/navigation';
import { cn } from '@/lib/utils';

/** Persistent bottom tab bar, mobile only. Always shows which route is active and puts the
 * others one tap away — no drawer to open first. Desktop keeps the left Sidebar instead. */
export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      className="md:hidden fixed inset-x-0 bottom-0 z-40 flex border-t border-neutral-75 bg-surface/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]"
    >
      {ALL_NAV.map(({ href, label, icon: Icon }) => {
        const active = isNavActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative flex flex-1 flex-col items-center gap-1 min-h-14 justify-center py-2 text-xs font-medium transition-colors',
              active ? 'font-bold text-primary-darkest' : 'text-medium-emphasis',
            )}
          >
            {active && (
              <span
                aria-hidden="true"
                className="absolute inset-x-5 top-0 h-0.5 rounded-b-full bg-brand"
              />
            )}
            <Icon className="w-5 h-5" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
