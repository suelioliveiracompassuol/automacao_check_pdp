/* eslint-disable no-constant-binary-expression */
import { describe, it, expect } from 'vitest';
import {
  cn,
  formatDuration,
  formatDate,
  getStatusColor,
  getStatusIcon,
  getOperationKey,
  groupByOperation,
  getCountryFlag,
  getScreenshotUrl,
} from '../utils';
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

describe('formatDuration', () => {
  it('formats milliseconds', () => {
    expect(formatDuration(500)).toBe('500ms');
  });

  it('formats seconds', () => {
    expect(formatDuration(3500)).toBe('3.5s');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(125000)).toBe('2m 5s');
  });
});

describe('formatDate', () => {
  it('formats ISO date to pt-BR', () => {
    const result = formatDate('2024-01-15T10:30:00Z');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });
});

describe('getStatusColor', () => {
  it('returns emerald for pass', () => {
    expect(getStatusColor('pass')).toContain('emerald');
  });

  it('returns red for fail', () => {
    expect(getStatusColor('fail')).toContain('red');
  });

  it('returns amber for error', () => {
    expect(getStatusColor('error')).toContain('amber');
  });

  it('returns amber for warning', () => {
    expect(getStatusColor('warning')).toContain('amber');
  });

  it('returns gray for disabled', () => {
    expect(getStatusColor('disabled')).toContain('gray');
  });

  it('returns gray for na', () => {
    expect(getStatusColor('na')).toContain('gray');
  });
});

describe('getStatusIcon', () => {
  it('returns correct icons for each status', () => {
    expect(getStatusIcon('pass')).toBe('✅');
    expect(getStatusIcon('fail')).toBe('❌');
    expect(getStatusIcon('error')).toBe('⚠️');
    expect(getStatusIcon('warning')).toBe('⚠️');
    expect(getStatusIcon('disabled')).toBe('🚫');
    expect(getStatusIcon('na')).toBe('➖');
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

describe('groupByOperation', () => {
  it('groups results by operation key', () => {
    const results = [
      { vendor: 'natura', country: 'br' },
      { vendor: 'natura', country: 'br' },
      { vendor: 'avon', country: 'ar' },
    ] as PdpCheckResult[];
    const map = groupByOperation(results);
    expect(map.size).toBe(2);
    expect(map.get('natura-br')!.length).toBe(2);
    expect(map.get('avon-ar')!.length).toBe(1);
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
