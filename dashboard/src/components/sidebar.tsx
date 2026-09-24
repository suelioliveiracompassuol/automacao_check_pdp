'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as Collapsible from '@radix-ui/react-collapsible';
import { BarChart3, ChevronDown, Database, Globe } from 'lucide-react';
import { FaAndroid, FaApple } from 'react-icons/fa';
import { cn } from '@/lib/utils';

interface PlatformLink {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}

const PLATFORM_LINKS: PlatformLink[] = [
  { href: '/web', label: 'Web', icon: <Globe className="w-4 h-4" /> },
  {
    href: '/android',
    label: 'Android',
    icon: <FaAndroid className="w-4 h-4" />,
    badge: 'em breve',
  },
  { href: '/ios', label: 'iOS', icon: <FaApple className="w-4 h-4" />, badge: 'em breve' },
];

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'relative flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-colors',
        active
          ? 'bg-primary-wash font-bold text-primary-darkest'
          : 'text-medium-emphasis hover:bg-neutral-50 hover:text-highlight',
      )}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute top-1/2 -left-3 h-6 w-1 -translate-y-1/2 rounded-r-full bg-brand"
        />
      )}
      {children}
    </Link>
  );
}

/** Persistent left sidebar, desktop only (md+) — mobile navigation lives in the bottom tab bar
 * (MobileBottomNav) instead, which stays visible without needing to open anything. */
export function Sidebar() {
  const pathname = usePathname();
  const [platformsOpen, setPlatformsOpen] = useState(true);

  return (
    <aside className="hidden w-60 shrink-0 self-stretch border-r border-neutral-75 bg-surface md:block">
      <div className="sticky top-17">
        <nav className="flex flex-col gap-1 px-3 py-6">
          <NavLink href="/" active={pathname === '/'}>
            <BarChart3 className="w-4 h-4" />
            Visão Geral
          </NavLink>

          <Collapsible.Root open={platformsOpen} onOpenChange={setPlatformsOpen} className="mt-4">
            <Collapsible.Trigger className="flex w-full items-center justify-between rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-low-emphasis hover:text-high-emphasis cursor-pointer">
              <span>Plataformas</span>
              <ChevronDown
                className={cn('w-3.5 h-3.5 transition-transform', platformsOpen && 'rotate-180')}
              />
            </Collapsible.Trigger>
            <Collapsible.Content className="flex flex-col gap-1 mt-1">
              {PLATFORM_LINKS.map(({ href, label, icon, badge }) => (
                <NavLink
                  key={href}
                  href={href}
                  active={pathname === href || pathname.startsWith(`${href}/`)}
                >
                  {icon}
                  <span className="flex-1">{label}</span>
                  {badge && (
                    <span className="rounded-full bg-secondary-lightest/60 px-2 py-0.5 text-[9px] font-bold tracking-wide text-secondary-darkest uppercase">
                      {badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </Collapsible.Content>
          </Collapsible.Root>

          <div className="mt-4 border-t border-neutral-75 pt-4">
            <NavLink href="/skus" active={pathname === '/skus'}>
              <Database className="w-4 h-4" />
              SKUs
            </NavLink>
          </div>
        </nav>
      </div>
    </aside>
  );
}
