import { describe, it, expect } from 'vitest';
import { cn, getOperationKey, getCountryFlag, getScreenshotUrl } from '../utils';
import type { PdpCheckResult } from '../types';

describe('cn (classnames utility)', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible');
  });

  it('merges tailwind classes correctly', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });
});

describe('getOperationKey', () => {
  it('builds key from vendor and country', () => {
    const result = {
      vendor: 'natura',
      country: 'br',
    } as PdpCheckResult;
    expect(getOperationKey(result)).toBe('natura-br');
  });

  it('appends -social for socialcommerce channel', () => {
    const result = {
      vendor: 'avon',
      country: 'ar',
      channel: 'socialcommerce',
    } as PdpCheckResult;
    expect(getOperationKey(result)).toBe('avon-ar-social');
  });

  it('defaults to ecommerce channel', () => {
    const result = {
      vendor: 'natura',
      country: 'co',
    } as PdpCheckResult;
    expect(getOperationKey(result)).toBe('natura-co');
  });
});

describe('getCountryFlag', () => {
  it('returns flagcdn URL with lowercase country code', () => {
    expect(getCountryFlag('BR')).toBe('https://flagcdn.com/20x15/br.png');
  });

  it('handles already lowercase input', () => {
    expect(getCountryFlag('ar')).toBe('https://flagcdn.com/20x15/ar.png');
  });
});

describe('getScreenshotUrl', () => {
  it('builds correct URL with basePath and runId', () => {
    const url = getScreenshotUrl('run_123', 'screenshots/shot.png');
    expect(url).toContain('run_123');
    expect(url).toContain('screenshots/shot.png');
  });
});
