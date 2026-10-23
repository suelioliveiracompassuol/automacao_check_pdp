import { BarChart3, Database, Gauge } from 'lucide-react';
import { PLATFORMS, type PlatformMeta } from './platforms';

export interface NavItem {
  href: string;
  label: string;
  icon: PlatformMeta['icon'];
  /** "em breve" (ainda não lançada) ou "beta" (em validação). */
  badge?: string;
}

/** Rotas do app — fonte única para a Sidebar (desktop) e a MobileBottomNav. */
export const MAIN_NAV: NavItem[] = [
  { href: '/', label: 'Visão Geral', icon: BarChart3 },
  { href: '/performance', label: 'Performance', icon: Gauge },
];

export const PLATFORM_NAV: NavItem[] = PLATFORMS.map(({ href, label, icon, upcoming, beta }) => ({
  href,
  label,
  icon,
  badge: upcoming ? 'em breve' : beta ? 'beta' : undefined,
}));

export const ADMIN_NAV: NavItem[] = [{ href: '/skus', label: 'SKUs', icon: Database }];

export const ALL_NAV: NavItem[] = [...MAIN_NAV, ...PLATFORM_NAV, ...ADMIN_NAV];

/** A home só é ativa em "/"; as demais rotas também ficam ativas nas sub-rotas (ex.: /web/run_1). */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
