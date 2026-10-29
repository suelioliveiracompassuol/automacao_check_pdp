import { Globe, type LucideIcon } from 'lucide-react';
import { FaAndroid, FaApple } from 'react-icons/fa';
import type { FeatureKey, Platform } from './types';

export interface PlatformMeta {
  platform: Platform;
  label: string;
  href: string;
  icon: LucideIcon | typeof FaAndroid;
  /** Short channel description shown under the platform name. */
  channel: string;
  /** Not live yet — rendered as "em breve" instead of pass-rate stats. */
  upcoming?: boolean;
  /** Live but still being validated — shown with a "Beta" badge. */
  beta?: boolean;
  /**
   * Checks the platform's monitor runs, shown on the overview. Declared here (kept in sync with
   * the monitor code) so a new check shows up before the next run; without it, the keys are read
   * from the latest run. Web always runs the whole catalog.
   */
  featureKeys?: FeatureKey[];
}

/** Single source for platform labels/icons/routes, shared by the home cards and page heroes. */
export const PLATFORMS: PlatformMeta[] = [
  {
    platform: 'web',
    label: 'Web',
    href: '/web',
    icon: Globe,
    channel: 'Site · Natura & Avon · Minha Loja',
  },
  {
    platform: 'android',
    label: 'Android',
    href: '/android',
    icon: FaAndroid,
    channel: 'App nativo · Appium',
    beta: true,
    // checkPdpOnDriver() em src/index.android.ts
    featureKeys: [
      'addToCart',
      'images',
      'contentBanners',
      'brandShowcase',
      'recommendationShowcase',
    ],
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
