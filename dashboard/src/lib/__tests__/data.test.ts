import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';

// Mock fs module
vi.mock('node:fs', () => ({
  default: {
    readFileSync: vi.fn(),
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
  },
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
}));

import {
  getLastReport,
  getReportIndex,
  getReportById,
  getScreenshotsForRun,
  getReportsByPlatform,
  getLastReportByPlatform,
} from '../data';

const mockReport = {
  runId: 'run_123',
  startTime: '2024-01-01T00:00:00Z',
  endTime: '2024-01-01T00:05:00Z',
  durationMs: 300000,
  summary: { total: 5, passed: 4, failed: 1, errors: 0 },
  results: [],
};

const mockIndex = {
  reports: [
    {
      runId: 'run_123',
      startTime: '2024-01-01T00:00:00Z',
      endTime: '2024-01-01T00:05:00Z',
      durationMs: 300000,
      summary: { total: 5, passed: 4, failed: 1, errors: 0 },
      htmlPath: 'reports/run_123/report.html',
      jsonPath: 'reports/run_123/report.json',
    },
  ],
};

describe('data.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getLastReport', () => {
    it('reads and parses last-report.json', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockReport));
      const result = getLastReport();
      expect(result).toEqual(mockReport);
      expect(fs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('last-report.json'),
        'utf-8',
      );
    });
  });

  describe('getReportIndex', () => {
    it('reads and parses index.json', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockIndex));
      const result = getReportIndex();
      expect(result).toEqual(mockIndex);
      expect(fs.readFileSync).toHaveBeenCalledWith(expect.stringContaining('index.json'), 'utf-8');
    });
  });

  describe('getReportById', () => {
    it('returns report when file exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockReport));
      const result = getReportById('run_123');
      expect(result).toEqual(mockReport);
    });

    it('returns null when file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const result = getReportById('run_nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('getScreenshotsForRun', () => {
    it('returns only full-page and error screenshots', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        'shot1.png',
        'product_fullpage_001.png',
        'product_error_002.png',
        'shot2.png',
      ] as unknown as ReturnType<typeof fs.readdirSync>);

      const result = getScreenshotsForRun('run_123');

      expect(result).toEqual(['product_fullpage_001.png', 'product_error_002.png']);
    });

    it('accepts Android screenshots produced with generic timestamped names', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        'NATBRA-70983_1725971234567.png',
        'NATBRA-70983_login_debug_1725971234567.png',
        'not-a-screenshot.txt',
      ] as unknown as ReturnType<typeof fs.readdirSync>);

      const result = getScreenshotsForRun('run_android_123');

      expect(result).toEqual([
        'NATBRA-70983_1725971234567.png',
        'NATBRA-70983_login_debug_1725971234567.png',
      ]);
    });

    it('returns empty array when directory does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const result = getScreenshotsForRun('run_nonexistent');
      expect(result).toEqual([]);
    });
  });

  describe('getReportsByPlatform / getLastReportByPlatform', () => {
    const mockMultiPlatformIndex = {
      reports: [
        {
          runId: 'run_android_2',
          startTime: '2024-01-03T00:00:00Z',
          endTime: '2024-01-03T00:05:00Z',
          durationMs: 300000,
          summary: { total: 3, passed: 3, failed: 0, errors: 0 },
          jsonPath: 'reports/run_android_2/report.json',
          platform: 'android',
        },
        {
          runId: 'run_web_1',
          startTime: '2024-01-02T00:00:00Z',
          endTime: '2024-01-02T00:05:00Z',
          durationMs: 300000,
          summary: { total: 5, passed: 4, failed: 1, errors: 0 },
          jsonPath: 'reports/run_web_1/report.json',
          // no `platform` field — legacy entry, should be treated as 'web'
        },
        {
          runId: 'run_android_1',
          startTime: '2024-01-01T00:00:00Z',
          endTime: '2024-01-01T00:05:00Z',
          durationMs: 300000,
          summary: { total: 3, passed: 2, failed: 1, errors: 0 },
          jsonPath: 'reports/run_android_1/report.json',
          platform: 'android',
        },
      ],
    };

    beforeEach(() => {
      vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
        if (String(filePath).includes('index.json')) {
          return JSON.stringify(mockMultiPlatformIndex);
        }
        const runId = String(filePath).match(/run_\w+/)?.[0];
        return JSON.stringify({ ...mockReport, runId });
      });
      vi.mocked(fs.existsSync).mockReturnValue(true);
    });

    it('filters index entries by platform, treating a missing platform as web', () => {
      expect(getReportsByPlatform('android').map((r) => r.runId)).toEqual([
        'run_android_2',
        'run_android_1',
      ]);
      expect(getReportsByPlatform('web').map((r) => r.runId)).toEqual(['run_web_1']);
      expect(getReportsByPlatform('ios')).toEqual([]);
    });

    it('returns the most recent report for a platform', () => {
      const result = getLastReportByPlatform('android');
      expect(result?.runId).toBe('run_android_2');
    });

    it('returns null when the platform has no runs yet', () => {
      expect(getLastReportByPlatform('ios')).toBeNull();
    });
  });
});
