import { describe, it, expect } from 'vitest';
import { formatRunsCount, REPORT_INDEX_MAX_ENTRIES } from '../constants';

describe('formatRunsCount', () => {
  it('shows the exact count below the index limit', () => {
    expect(formatRunsCount(7)).toBe('7');
    expect(formatRunsCount(REPORT_INDEX_MAX_ENTRIES - 1)).toBe('99');
  });

  it('marks a full index with "+", since older runs were dropped', () => {
    expect(formatRunsCount(REPORT_INDEX_MAX_ENTRIES)).toBe('100+');
  });
});
