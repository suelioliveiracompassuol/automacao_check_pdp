import type { Channel, Country, FeatureKey, Vendor } from './types';

/** Constantes de domínio compartilhadas (SKU Manager, visão geral, filtros). */

export const VENDORS: Vendor[] = ['natura', 'avon'];

export const CHANNELS: Channel[] = ['ecommerce', 'socialcommerce'];

/** Fonte única dos rótulos de país; a ordem define a ordem de exibição. */
export const COUNTRY_INFO: Record<Country, { label: string }> = {
  AR: { label: 'Argentina' },
  BR: { label: 'Brasil' },
  CL: { label: 'Chile' },
  CO: { label: 'Colômbia' },
  MX: { label: 'México' },
  PE: { label: 'Peru' },
};

export const COUNTRIES = Object.keys(COUNTRY_INFO) as Country[];

export function countryLabel(code: string): string {
  return COUNTRY_INFO[code.toUpperCase() as Country]?.label ?? code;
}

export const VENDOR_INFO: Record<Vendor, { label: string; className: string }> = {
  natura: { label: 'Natura', className: 'bg-primary-wash text-primary-darkest' },
  avon: { label: 'Avon', className: 'bg-pink-100 text-pink-800' },
};

export function vendorInfo(vendor: string): { label: string; className: string } {
  return (
    VENDOR_INFO[vendor.toLowerCase() as Vendor] ?? {
      label: vendor,
      className: 'bg-neutral-75 text-medium-emphasis',
    }
  );
}

export const CHANNEL_INFO: Record<
  Channel,
  { label: string; shortLabel: string; className: string }
> = {
  ecommerce: {
    label: 'E-commerce',
    shortLabel: 'E-com',
    className: 'bg-primary-lightest text-primary-darkest',
  },
  socialcommerce: {
    label: 'Social Commerce',
    shortLabel: 'Social',
    className: 'bg-info-lightest text-info-dark',
  },
};

/** Lista de todas as FeatureKey — fonte única de "quantas checagens rodamos". */
export const ALL_FEATURE_KEYS: FeatureKey[] = [
  'reviews',
  'aiReviewSummary',
  'reviewFilter',
  'reviewSort',
  'reviewPhotos',
  'reviewRecommendation',
  'brandShowcase',
  'recommendationShowcase',
  'shopTheSet',
  'images',
  'ratingConsistency',
  'rating',
  'addToCart',
  'favoriteButton',
  'productVariations',
  'contentBanners',
  'coupons',
  'giftModule',
  'topRatedBadge',
];
