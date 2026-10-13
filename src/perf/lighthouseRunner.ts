import * as fs from "node:fs";
import * as path from "node:path";
import { chromium } from "@playwright/test";
import { buildConsentCookieHeader } from "../browserSetup.js";
import {
  PERF_USER_AGENT,
  buildPerfUrl,
  type PerfSkuTarget,
} from "./config.js";
import {
  extractMetrics,
  extractLcpElement,
  extractOpportunities,
  isValidRun,
  pickMedianIndex,
  type Lhr,
} from "./extractMetrics.js";
import type { PerfSkuResult, PerfMetrics } from "./types.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runLighthouseOnce(
  url: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  sku: string,
): Promise<{ lhr: Lhr | null; html: string | null; error?: string }> {
  // Imports dinâmicos necessários pois lighthouse e chrome-launcher são ESM-only
  // e o projeto compila para CommonJS.
  const { default: lighthouse } = await import("lighthouse");
  const chromeLauncher = await import("chrome-launcher");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { default: desktopConfig } = (await import("lighthouse/core/config/desktop-config.js")) as any;

  const chromePath = chromium.executablePath();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let chrome: any = null;

  try {
    chrome = await chromeLauncher.launch({
      chromePath,
      chromeFlags: [
        "--headless=new",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
        "--lang=pt-BR",
      ],
    });

    const runLighthousePromise = async () => {
      const runnerResult = await lighthouse(
        url,
        {
          port: chrome.port,
          output: "html",
          logLevel: "error",
          onlyCategories: ["performance"],
          locale: "pt-BR" as "pt",
          extraHeaders: {
            Cookie: buildConsentCookieHeader(url),
            "Accept-Language": "pt-BR,pt;q=0.9",
          },
        },
        {
          ...desktopConfig,
          settings: {
            ...desktopConfig.settings,
            emulatedUserAgent: PERF_USER_AGENT,
            onlyCategories: ["performance"],
          },
        },
      );

      if (!runnerResult) {
        throw new Error("Lighthouse não retornou nenhum resultado");
      }

      const reportHtml = Array.isArray(runnerResult.report)
        ? runnerResult.report[0]
        : (runnerResult.report as string);

      return {
        lhr: runnerResult.lhr as Lhr,
        html: reportHtml || null,
      };
    };

    let timer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error("Timeout de 120s atingido na execução do Lighthouse"));
      }, 120000);
      if (timer.unref) {
        timer.unref();
      }
    });

    try {
      const result = await Promise.race([
        runLighthousePromise(),
        timeoutPromise,
      ]);
      return result;
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      lhr: null,
      html: null,
      error: message,
    };
  } finally {
    if (chrome) {
      try {
        await chrome.kill();
      } catch {
        // Ignora erro ao encerrar processo do Chromium
      }
    }
  }
}

export async function measureSku(
  target: PerfSkuTarget,
  runs: number,
  outDir: string,
  runId: string,
): Promise<PerfSkuResult> {
  const url = buildPerfUrl(target);
  console.log(`\n🔍 Medindo SKU ${target.sku}: ${target.name}`);
  console.log(`   URL: ${url}`);

  const validRuns: { lhr: Lhr; html: string | null; metrics: PerfMetrics }[] = [];
  const errors: string[] = [];

  for (let i = 1; i <= runs; i++) {
    if (i > 1) {
      const pauseMs = Math.floor(Math.random() * 2000) + 2000;
      await sleep(pauseMs);
    }

    const runResult = await runLighthouseOnce(url, target.sku);

    if (runResult.error || !runResult.lhr) {
      const errorMsg = runResult.error || "LHR não gerado";
      errors.push(`Execução ${i}: ${errorMsg}`);
      console.log(`   ⚠️ ${target.sku} execução ${i}/${runs} falhou: ${errorMsg}`);
      continue;
    }

    const validation = isValidRun(runResult.lhr, target.sku);
    if (!validation.valid) {
      const reason = validation.reason || "Execução inválida";
      errors.push(`Execução ${i}: ${reason}`);
      console.log(`   ⚠️ ${target.sku} execução ${i}/${runs} inválida: ${reason}`);
      continue;
    }

    const metrics = extractMetrics(runResult.lhr);
    validRuns.push({
      lhr: runResult.lhr,
      html: runResult.html,
      metrics,
    });

    const lcpDisplay =
      metrics.lcp !== null ? `${(metrics.lcp / 1000).toFixed(2)}s` : "N/A";
    console.log(
      `   ⚡ ${target.sku} execução ${i}/${runs}: score ${metrics.performanceScore ?? "N/A"}, LCP ${lcpDisplay}`,
    );
  }

  if (validRuns.length === 0) {
    return {
      sku: target.sku,
      name: target.name,
      pageType: target.pageType,
      url,
      success: false,
      error: errors.join(" | ") || "Nenhuma execução válida",
      median: null,
      runs: [],
      lcpElement: null,
      opportunities: [],
      reportHtmlPath: null,
      lighthouseVersion: null,
    };
  }

  const scores = validRuns.map((r) => r.metrics.performanceScore ?? 0);
  const medianIndex = pickMedianIndex(scores);
  const medianRun = validRuns[medianIndex];

  const runFolder = path.join(outDir, runId);
  fs.mkdirSync(runFolder, { recursive: true });

  let reportHtmlPath: string | null = null;
  if (medianRun.html) {
    const htmlFileName = `${target.sku}.html`;
    fs.writeFileSync(path.join(runFolder, htmlFileName), medianRun.html, "utf-8");
    reportHtmlPath = `${runId}/${htmlFileName}`;
  }

  return {
    sku: target.sku,
    name: target.name,
    pageType: target.pageType,
    url,
    success: true,
    median: medianRun.metrics,
    runs: validRuns.map((r) => r.metrics),
    lcpElement: extractLcpElement(medianRun.lhr),
    opportunities: extractOpportunities(medianRun.lhr),
    reportHtmlPath,
    lighthouseVersion: medianRun.lhr.lighthouseVersion ?? null,
  };
}
