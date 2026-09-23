/**
 * Unit tests for reportIndex.ts's upsertReportIndexEntry — the shared, lock-protected
 * docs/reports/index.json writer used by both the Web and Android orchestrators.
 *
 * Runs via `npm run test:unit` (npx playwright test src/tests/).
 */

import { test, expect } from "@playwright/test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { upsertReportIndexEntry, ReportIndexEntry } from "../reportIndex.js";

function makeEntry(overrides: Partial<ReportIndexEntry> = {}): ReportIndexEntry {
  return {
    runId: "run_test_1",
    startTime: "2026-01-01T00:00:00.000Z",
    endTime: "2026-01-01T00:01:00.000Z",
    durationMs: 60_000,
    summary: { total: 1, passed: 1, failed: 0, errors: 0 },
    htmlPath: "reports/run_test_1/report.html",
    jsonPath: "reports/run_test_1/report.json",
    ...overrides,
  };
}

test.describe("upsertReportIndexEntry", () => {
  let tmpDir: string;
  let originalCwd: string;

  test.beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "report-index-test-"));
    fs.mkdirSync(path.join(tmpDir, "docs", "reports"), { recursive: true });
    process.chdir(tmpDir);
  });

  test.afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function readIndex(): { reports: ReportIndexEntry[] } {
    const indexPath = path.join(tmpDir, "docs", "reports", "index.json");
    return JSON.parse(fs.readFileSync(indexPath, "utf-8"));
  }

  test("creates the index file when it doesn't exist yet", async () => {
    await upsertReportIndexEntry(makeEntry());
    const index = readIndex();
    expect(index.reports).toHaveLength(1);
    expect(index.reports[0].runId).toBe("run_test_1");
  });

  test("prepends new entries (most recent first)", async () => {
    await upsertReportIndexEntry(makeEntry({ runId: "run_1" }));
    await upsertReportIndexEntry(makeEntry({ runId: "run_2" }));
    const index = readIndex();
    expect(index.reports.map((r) => r.runId)).toEqual(["run_2", "run_1"]);
  });

  test("upserts by runId instead of duplicating entries", async () => {
    await upsertReportIndexEntry(makeEntry({ runId: "run_1", durationMs: 1000 }));
    await upsertReportIndexEntry(makeEntry({ runId: "run_1", durationMs: 2000 }));
    const index = readIndex();
    expect(index.reports).toHaveLength(1);
    expect(index.reports[0].durationMs).toBe(2000);
  });

  test("caps the index at 100 entries", async () => {
    for (let i = 0; i < 105; i++) {
      await upsertReportIndexEntry(makeEntry({ runId: `run_${i}` }));
    }
    const index = readIndex();
    expect(index.reports).toHaveLength(100);
    expect(index.reports[0].runId).toBe("run_104");
  });

  test("recreates the index if the existing file is malformed", async () => {
    const indexPath = path.join(tmpDir, "docs", "reports", "index.json");
    fs.writeFileSync(indexPath, "not valid json");
    await upsertReportIndexEntry(makeEntry());
    const index = readIndex();
    expect(index.reports).toHaveLength(1);
  });
});
