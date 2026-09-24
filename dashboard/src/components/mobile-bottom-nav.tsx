'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Database, Globe, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FaAndroid, FaApple } from 'react-icons/fa';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon | React.ComponentType;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Visão Geral', icon: BarChart3 },
  { href: '/web', label: 'Web', icon: Globe },
  { href: '/android', label: 'Android', icon: FaAndroid },
  { href: '/ios', label: 'iOS', icon: FaApple },
  { href: '/skus', label: 'SKUs', icon: Database },
];

/** Persistent bottom tab bar, mobile only. Always shows which route is active and puts the
 * others one tap away — no drawer to open first. Desktop keeps the left Sidebar instead. */
export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      className="md:hidden fixed inset-x-0 bottom-0 z-40 flex border-t border-neutral-75 bg-surface/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]"
    >
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active =
          href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors',
              active ? 'font-bold text-primary-dark' : 'text-medium-emphasis',
            )}
          >
            {active && (
              <span
                aria-hidden="true"
                className="absolute inset-x-5 top-0 h-0.5 rounded-b-full bg-brand"
              />
            )}
            <Icon className="w-5 h-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
