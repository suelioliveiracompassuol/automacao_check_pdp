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
  getPerfIndex,
  getPerfRun,
  getPerfReportDownloads,
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

  describe('getPerfIndex / getPerfRun', () => {
    it('retorna { runs: [] } quando docs/perf/index.json não existe', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(getPerfIndex()).toEqual({ runs: [] });
    });

    it('lê e faz parse de docs/perf/index.json quando existir', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ runs: [{ runId: 'run_1' }] }));
      expect(getPerfIndex()).toEqual({ runs: [{ runId: 'run_1' }] });
    });

    it('retorna null quando docs/perf/<runId>.json não existe', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(getPerfRun('run_999')).toBeNull();
    });

    it('lê e faz parse de docs/perf/<runId>.json quando existir', () => {
      const mockPerfRun = {
        runId: 'run_1',
        timestamp: '2024-01-01T00:00:00Z',
        formFactor: 'desktop',
        runsPerSku: 3,
        results: [],
      };
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockPerfRun));
      expect(getPerfRun('run_1')).toEqual(mockPerfRun);
    });
  });

  describe('medições publicadas + locais', () => {
    const files: Record<string, unknown> = {
      'docs/perf/index.json': {
        runs: [{ runId: 'run_1', timestamp: '2024-05-01T12:00:00Z', skus: [] }],
      },
      // Execução local (npm run perf:local), mais recente, e uma cópia de run_1
      'reports/perf/index.json': {
        runs: [
          { runId: 'run_2', timestamp: '2024-05-02T12:00:00Z', skus: [] },
          { runId: 'run_1', timestamp: '2024-05-01T12:00:00Z', skus: [{ sku: 'dup' }] },
        ],
      },
      'reports/perf/run_2.json': { runId: 'run_2', results: [] },
    };
    const key = (p: unknown) => {
      const normalized = String(p).split('\\').join('/');
      return Object.keys(files).find((k) => normalized.endsWith(k));
    };

    beforeEach(() => {
      vi.mocked(fs.existsSync).mockImplementation((p) => key(p) !== undefined);
      vi.mocked(fs.readFileSync).mockImplementation((p) => JSON.stringify(files[key(p)!]));
    });

    it('junta os dois históricos, sem duplicar, do mais recente para o mais antigo', () => {
      const { runs } = getPerfIndex();
      expect(runs.map((r) => r.runId)).toEqual(['run_2', 'run_1']);
      // Em duplicata, vale a versão publicada
      expect(runs[1].skus).toEqual([]);
    });

    it('encontra a execução na pasta local', () => {
      expect(getPerfRun('run_2')).toEqual({ runId: 'run_2', results: [] });
      expect(getPerfRun('run_9')).toBeNull();
    });
  });

  describe('getPerfReportDownloads', () => {
    const day = (d: number) => `2024-05-${String(d).padStart(2, '0')}T12:00:00Z`;
    const perfFiles: Record<string, string> = {
      'index.json': JSON.stringify({
        runs: [
          { runId: 'run_20', timestamp: day(20), skus: [] },
          { runId: 'run_15', timestamp: day(15), skus: [] },
          // Fora da janela de 10 dias a partir da medição mais recente
          { runId: 'run_05', timestamp: day(5), skus: [] },
        ],
      }),
      'run_20.json': JSON.stringify({
        results: [
          { sku: 'A', name: 'Full', pageType: 'PDPFull', reportJsonPath: 'run_20/A.json' },
          { sku: 'B', name: 'Low', pageType: 'PDPLow', reportJsonPath: 'run_20/B.json' },
          // Rodada antiga, sem relatório JSON
          { sku: 'C', name: 'Old' },
        ],
      }),
      'run_15.json': JSON.stringify({
        results: [{ sku: 'A', name: 'Full', reportJsonPath: 'run_15/A.json' }],
      }),
    };
    const removed = new Set(['run_15/A.json', 'run_20/B.json']);
    // Caminho relativo a docs/perf, normalizando as barras do Windows.
    const rel = (p: unknown) => String(p).split('\\').join('/').split('/perf/')[1] ?? '';

    beforeEach(() => {
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        const file = rel(p);
        return (
          file in perfFiles || (file.endsWith('.json') && file.includes('/') && !removed.has(file))
        );
      });
      vi.mocked(fs.readFileSync).mockImplementation((p) => perfFiles[rel(p)]);
    });

    it('lista só os relatórios dos últimos dias que ainda existem no disco', () => {
      expect(getPerfReportDownloads(10)).toEqual([
        {
          runId: 'run_20',
          timestamp: day(20),
          files: [{ sku: 'A', name: 'Full', pageType: 'PDPFull', path: 'run_20/A.json' }],
        },
      ]);
    });
  });
});
