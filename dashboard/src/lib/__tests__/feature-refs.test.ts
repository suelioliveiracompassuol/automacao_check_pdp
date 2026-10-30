import { describe, it, expect } from 'vitest';
import { featureRefUrls, refGroupOf } from '../feature-refs';
// The monitor's copy, which names the folders the capture script writes to
import { refGroupOf as monitorRefGroupOf } from '../../../../src/featureRefGroups';

describe('refGroupOf', () => {
  it.each([
    [{ vendor: 'natura', country: 'BR' }, 'natura-br'],
    [{ vendor: 'natura', country: 'AR' }, 'natura-ar'],
    [{ vendor: 'natura', country: 'CO' }, 'natura-latam'],
    [{ vendor: 'natura', country: 'CL' }, 'natura-latam'],
    [{ vendor: 'natura', country: 'PE' }, 'natura-latam'],
    [{ vendor: 'natura', country: 'MX' }, 'natura-latam'],
    [{ vendor: 'avon', country: 'BR' }, 'avon-br'],
    [{ vendor: 'avon', country: 'AR' }, 'avon-ar'],
    [{ vendor: 'avon', country: 'MX' }, 'avon-mx'],
    [{ vendor: 'natura', country: 'BR', channel: 'socialcommerce' }, 'minha-loja-natura'],
    [{ vendor: 'avon', country: 'BR', channel: 'socialcommerce' }, 'minha-loja-avon'],
  ])('%o → %s', (result, group) => {
    expect(refGroupOf(result)).toBe(group);
  });
});

describe('refGroupOf × monitor', () => {
  const vendors = ['natura', 'avon'];
  const countries = ['BR', 'AR', 'CL', 'CO', 'PE', 'MX'];
  const channels = [undefined, 'ecommerce', 'socialcommerce'] as const;
  const cases = vendors.flatMap((vendor) =>
    countries.flatMap((country) => channels.map((channel) => ({ vendor, country, channel }))),
  );

  it.each(cases)('%o gives the same group as the monitor', (result) => {
    expect(refGroupOf(result)).toBe(monitorRefGroupOf(result));
  });
});

describe('featureRefUrls', () => {
  it('maps the group images to their public URLs', () => {
    const index = { 'natura-latam': ['coupons', 'reviews'] };
    expect(featureRefUrls(index, { vendor: 'natura', country: 'PE' })).toEqual({
      coupons: '/feature-refs/natura-latam/coupons.png',
      reviews: '/feature-refs/natura-latam/reviews.png',
    });
  });

  it('falls back to natura-br for features the group has no image for', () => {
    const index = { 'natura-latam': ['coupons'], 'natura-br': ['coupons', 'images'] };
    expect(featureRefUrls(index, { vendor: 'natura', country: 'PE' })).toEqual({
      coupons: '/feature-refs/natura-latam/coupons.png',
      images: '/feature-refs/natura-br/images.png',
    });
  });

  it('uses natura-br images for a group without images of its own', () => {
    const index = { 'natura-br': ['images'] };
    expect(featureRefUrls(index, { vendor: 'avon', country: 'MX' })).toEqual({
      images: '/feature-refs/natura-br/images.png',
    });
  });

  it('is empty when no group has images', () => {
    expect(featureRefUrls({}, { vendor: 'avon', country: 'MX' })).toEqual({});
  });
});
