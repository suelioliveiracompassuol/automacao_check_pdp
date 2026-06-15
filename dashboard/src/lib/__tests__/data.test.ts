import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";

// Mock fs module
vi.mock("node:fs", () => ({
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
} from "../data";

const mockReport = {
  runId: "run_123",
  startTime: "2024-01-01T00:00:00Z",
  endTime: "2024-01-01T00:05:00Z",
  durationMs: 300000,
  summary: { total: 5, passed: 4, failed: 1, errors: 0 },
  results: [],
};

const mockIndex = {
  reports: [
    {
      runId: "run_123",
      startTime: "2024-01-01T00:00:00Z",
      endTime: "2024-01-01T00:05:00Z",
      durationMs: 300000,
      summary: { total: 5, passed: 4, failed: 1, errors: 0 },
      htmlPath: "reports/run_123/report.html",
      jsonPath: "reports/run_123/report.json",
    },
  ],
};

describe("data.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getLastReport", () => {
    it("reads and parses last-report.json", () => {
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockReport));
      const result = getLastReport();
      expect(result).toEqual(mockReport);
      expect(fs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining("last-report.json"),
        "utf-8",
      );
    });
  });

  describe("getReportIndex", () => {
    it("reads and parses index.json", () => {
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockIndex));
      const result = getReportIndex();
      expect(result).toEqual(mockIndex);
      expect(fs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining("index.json"),
        "utf-8",
      );
    });
  });

  describe("getReportById", () => {
    it("returns report when file exists", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockReport));
      const result = getReportById("run_123");
      expect(result).toEqual(mockReport);
    });

    it("returns null when file does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const result = getReportById("run_nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("getScreenshotsForRun", () => {
    it("returns png files from screenshots directory", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        "shot1.png",
        "shot2.png",
        "readme.txt",
      ] as unknown as fs.Dirent<NonSharedBuffer>[]);
      const result = getScreenshotsForRun("run_123");
      expect(result).toEqual(["shot1.png", "shot2.png"]);
    });

    it("returns empty array when directory does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const result = getScreenshotsForRun("run_nonexistent");
      expect(result).toEqual([]);
    });
  });
});
