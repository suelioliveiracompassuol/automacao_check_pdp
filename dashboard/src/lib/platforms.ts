import { Globe, type LucideIcon } from 'lucide-react';
import { FaAndroid, FaApple } from 'react-icons/fa';
import type { Platform } from './types';

export interface PlatformMeta {
  platform: Platform;
  label: string;
  href: string;
  icon: LucideIcon | typeof FaAndroid;
  /** Short channel description shown under the platform name. */
  channel: string;
  /** Not live yet — rendered as "em breve" instead of pass-rate stats. */
  upcoming?: boolean;
}

/** Single source for platform labels/icons/routes, shared by the home cards and page heroes. */
export const PLATFORMS: PlatformMeta[] = [
  { platform: 'web', label: 'Web', href: '/web', icon: Globe, channel: 'Site · Natura & Avon' },
  {
    platform: 'android',
    label: 'Android',
    href: '/android',
    icon: FaAndroid,
    channel: 'App nativo',
    upcoming: true,
  },
  {
    platform: 'ios',
    label: 'iOS',
    href: '/ios',
    icon: FaApple,
    channel: 'App nativo',
    upcoming: true,
  },
];

export const PLATFORM_META = Object.fromEntries(PLATFORMS.map((p) => [p.platform, p])) as Record<
  Platform,
  PlatformMeta
>;
