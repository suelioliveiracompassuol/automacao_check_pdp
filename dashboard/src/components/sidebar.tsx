'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as Collapsible from '@radix-ui/react-collapsible';
import { ChevronDown } from 'lucide-react';
import { ADMIN_NAV, MAIN_NAV, PLATFORM_NAV, isNavActive, type NavItem } from '@/lib/navigation';
import { cn } from '@/lib/utils';

function NavLink({ href, label, icon: Icon, badge, active }: NavItem & { active: boolean }) {
  return (
    <Link
      href={href}
      title={badge ? `${label} (${badge})` : label}
      aria-label={badge ? `${label} (${badge})` : label}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative mx-auto flex h-10 w-10 items-center justify-center gap-3 rounded-full text-sm font-medium transition-colors',
        'lg:mx-0 lg:h-auto lg:w-auto lg:justify-start lg:px-4 lg:py-2.5',
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
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="hidden flex-1 whitespace-nowrap lg:inline">{label}</span>
      {badge && (
        <>
          <span className="hidden rounded-full bg-secondary-lightest/60 px-2 py-0.5 text-[11px] font-bold tracking-wide whitespace-nowrap text-secondary-darkest uppercase lg:inline">
            {badge}
          </span>
          {/* Rail mode (< lg): a dot stands in for the badge */}
          <span
            aria-hidden="true"
            className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-secondary ring-2 ring-surface lg:hidden"
          />
        </>
      )}
    </Link>
  );
}

/** Persistent left sidebar from md up — mobile navigation lives in the bottom tab bar
 * (MobileBottomNav) instead. Between md and lg it collapses to an icon-only rail so narrow
 * embeds (e.g. the Google Sites iframe, ~800px wide) keep most of the width for content. */
export function Sidebar() {
  const pathname = usePathname();
  const [platformsOpen, setPlatformsOpen] = useState(true);

  return (
    <aside className="hidden w-16 shrink-0 self-stretch border-r border-neutral-75 bg-surface md:block lg:w-60">
      <div className="sticky top-17">
        <nav aria-label="Navegação principal" className="flex flex-col gap-1 px-3 py-6">
          {MAIN_NAV.map((item) => (
            <NavLink key={item.href} {...item} active={isNavActive(pathname, item.href)} />
          ))}

          <Collapsible.Root
            open={platformsOpen}
            onOpenChange={setPlatformsOpen}
            className="mt-4 border-t border-neutral-75 pt-4 lg:border-0 lg:pt-0"
          >
            <Collapsible.Trigger className="hidden w-full cursor-pointer items-center justify-between rounded-full px-4 py-2 text-[11px] font-bold tracking-widest text-low-emphasis uppercase hover:text-high-emphasis lg:flex">
              <span>Plataformas</span>
              <ChevronDown
                aria-hidden="true"
                className={cn('h-3.5 w-3.5 transition-transform', platformsOpen && 'rotate-180')}
              />
            </Collapsible.Trigger>
            {/* forceMount: the rail has no toggle, so links stay visible there even if the
                section was collapsed on a wider screen. */}
            <Collapsible.Content
              forceMount
              className="mt-1 flex flex-col gap-1 lg:data-[state=closed]:hidden"
            >
              {PLATFORM_NAV.map((item) => (
                <NavLink key={item.href} {...item} active={isNavActive(pathname, item.href)} />
              ))}
            </Collapsible.Content>
          </Collapsible.Root>

          <div className="mt-4 border-t border-neutral-75 pt-4">
            {ADMIN_NAV.map((item) => (
              <NavLink key={item.href} {...item} active={isNavActive(pathname, item.href)} />
            ))}
          </div>
        </nav>
      </div>
    </aside>
  );
}
