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
  { href: '/android', label: 'Android', icon: <FaAndroid className="w-4 h-4" /> },
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
        'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-indigo-50 text-indigo-700'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
      )}
    >
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
    <aside className="hidden md:block w-56 shrink-0 border-r border-gray-200/60 bg-white/60">
      <div className="sticky top-14.25">
        <nav className="flex flex-col gap-1 p-3">
          <NavLink href="/" active={pathname === '/'}>
            <BarChart3 className="w-4 h-4" />
            Visão Geral
          </NavLink>

          <Collapsible.Root open={platformsOpen} onOpenChange={setPlatformsOpen} className="mt-2">
            <Collapsible.Trigger className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400 hover:text-gray-600 cursor-pointer">
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
                    <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.5">
                      {badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </Collapsible.Content>
          </Collapsible.Root>

          <div className="mt-2 pt-2 border-t border-gray-100">
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
