import * as fs from "node:fs";
import * as path from "node:path";
import { chromium } from "@playwright/test";
import { buildConsentCookieHeader } from "../browserSetup.js";
import {
  PERF_USER_AGENT,
  buildPerfUrl,
  type PerfConditions,
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
  conditions: PerfConditions,
): Promise<{ lhr: Lhr | null; error?: string }> {
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

    const { connectivity, viewport, consentCookie } = conditions;
    const extraHeaders: Record<string, string> = { "Accept-Language": "pt-BR,pt;q=0.9" };
    if (consentCookie) {
      extraHeaders.Cookie = buildConsentCookieHeader(url);
    }

    const runLighthousePromise = async () => {
      const runnerResult = await lighthouse(
        url,
        {
          port: chrome.port,
          logLevel: "error",
          onlyCategories: ["performance"],
          locale: "pt-BR" as "pt",
          extraHeaders,
        },
        {
          ...desktopConfig,
          settings: {
            ...desktopConfig.settings,
            emulatedUserAgent: PERF_USER_AGENT,
            onlyCategories: ["performance"],
            // Limitação real da rede (como o WebPageTest) em vez da simulação do Lighthouse:
            // as métricas passam a ser medidas, não estimadas.
            throttlingMethod: "devtools",
            throttling: {
              rttMs: connectivity.rttMs,
              throughputKbps: connectivity.downKbps,
              cpuSlowdownMultiplier: 1,
              // O DevTools limita por requisição e o WPT por pacote; os fatores 3,75 e 0,9
              // são os que o próprio Lighthouse usa para converter um no outro.
              requestLatencyMs: connectivity.rttMs * 3.75,
              downloadThroughputKbps: connectivity.downKbps * 0.9,
              uploadThroughputKbps: connectivity.upKbps * 0.9,
            },
            screenEmulation: {
              mobile: false,
              width: viewport.width,
              height: viewport.height,
              deviceScaleFactor: 1,
              disabled: false,
            },
          },
        },
      );

      if (!runnerResult) {
        throw new Error("Lighthouse não retornou nenhum resultado");
      }

      // O LHR (JSON) é o relatório completo; o HTML do Lighthouse não é gerado.
      return { lhr: runnerResult.lhr as Lhr };
    };

    let timer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error("Timeout de 180s atingido na execução do Lighthouse"));
      }, 180000);
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
  conditions: PerfConditions,
): Promise<PerfSkuResult> {
  const url = buildPerfUrl(target);
  console.log(`\n🔍 Medindo SKU ${target.sku}: ${target.name}`);
  console.log(`   URL: ${url}`);

  const validRuns: { lhr: Lhr; metrics: PerfMetrics }[] = [];
  const errors: string[] = [];

  for (let i = 1; i <= runs; i++) {
    if (i > 1) {
      const pauseMs = Math.floor(Math.random() * 2000) + 2000;
      await sleep(pauseMs);
    }

    const runResult = await runLighthouseOnce(url, conditions);

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
    validRuns.push({ lhr: runResult.lhr, metrics });

    const lcpDisplay =
      metrics.lcp !== null ? `${(metrics.lcp / 1000).toFixed(2)}s` : "N/A";
    console.log(
      `   ⚡ ${target.sku} execução ${i}/${runs}: score ${metrics.performanceScore ?? "N/A"}, Start Render ${metrics.startRender ?? "N/A"} ms, LCP ${lcpDisplay}`,
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
      reportJsonPath: null,
      lighthouseVersion: null,
    };
  }

  const scores = validRuns.map((r) => r.metrics.performanceScore ?? 0);
  const medianIndex = pickMedianIndex(scores);
  const medianRun = validRuns[medianIndex];

  // Relatório completo da execução mediana, para download no dashboard (abre no Lighthouse
  // Viewer). Compacto: ~30% menor que indentado, e o workflow o apaga após 10 dias.
  const runFolder = path.join(outDir, runId);
  fs.mkdirSync(runFolder, { recursive: true });
  const reportFileName = `${target.sku}.json`;
  fs.writeFileSync(path.join(runFolder, reportFileName), JSON.stringify(medianRun.lhr), "utf-8");

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
    reportJsonPath: `${runId}/${reportFileName}`,
    lighthouseVersion: medianRun.lhr.lighthouseVersion ?? null,
  };
}
