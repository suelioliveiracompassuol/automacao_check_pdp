/**
 * Android PDP Feature Monitor - Orchestrator
 *
 * Scope (per roadmap Phase 2): a handful of features (add to cart, showcases, remote config)
 * across all Natura BR SKUs by default. Runs N device sessions in parallel (ANDROID_CONCURRENCY);
 * within each session it logs in ONCE, then navigates PDP-to-PDP (deep link + checks) reusing the
 * same driver, instead of opening a fresh device/login per SKU.
 * Opens the native app through an Android App Link deep link (no in-app search needed —
 * see docs decision in repo memory) and runs the ported checker(s).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import "./loadEnv.js";
import { buildPdpUrl } from "./checks/configs/config.js";
import { loadSkus } from "./checks/configs/skus/skus.js";
import {
  CheckResult,
  MonitoringReport,
  PdpCheckResult,
  SkuConfig,
} from "./types.js";
import { generateJsonReport } from "./reporter.js";
import {
  createAndroidSession,
  openPdpDeepLink,
  closeAndroidSession,
  resolveAndroidAppPackage,
} from "./deviceSetup.js";
import { checkAddToCartAndroid } from "./checks-android/addToCart.js";
import {
  checkBrandShowcaseAndroid,
  checkRecommendationShowcaseAndroid,
} from "./checks-android/showcases.js";
import { fetchRemoteConfigFlagsAndroid } from "./checks-android/remoteConfig.js";
import {
  getAndroidCredentialsFromEnv,
  loginAndroid,
} from "./checks-android/login.js";

/**
 * Lets ANDROID_DEEPLINK_HOST override the host of the built PDP URL (keeping slug/sku).
 * Useful to quickly test which host the installed app build actually resolves
 * (e.g. prod www.natura.com.br vs a dev/hml host) without changing config/skus.json.
 */
function applyDeepLinkHostOverride(url: string): string {
  const overrideHost = process.env.ANDROID_DEEPLINK_HOST;
  if (!overrideHost) {
    return url;
  }
  const parsed = new URL(url);
  parsed.host = overrideHost;
  return parsed.toString();
}

/** Logs in once at the start of a device session; the session survives the PDP-to-PDP navigation below. */
async function loginOnceOnDriver(
  driver: WebdriverIO.Browser,
  sessionSku: SkuConfig,
  outputDir: string,
): Promise<void> {
  const credentials = getAndroidCredentialsFromEnv();
  if (!credentials) {
    return;
  }
  console.log("   🔐 Fazendo login...");
  // Plain launch (no deep link data) so the Account tab is reachable; the session
  // persists on device, so it survives the terminateApp() inside openPdpDeepLink below.
  await driver
    .activateApp(resolveAndroidAppPackage(sessionSku))
    .catch(() => {});
  const loggedIn = await loginAndroid(driver, credentials);
  console.log(
    loggedIn
      ? "   ✅ Login realizado"
      : "   ⚠️  Não foi possível confirmar o login (seguindo como sessão anônima)",
  );
  if (!loggedIn) {
    try {
      const screenshotsDir = path.join(outputDir, "screenshots");
      fs.mkdirSync(screenshotsDir, { recursive: true });
      await driver.saveScreenshot(
        path.join(
          screenshotsDir,
          `${sessionSku.sku}_login_debug_${Date.now()}.png`,
        ),
      );
    } catch {
      // best-effort debug artifact only
    }
  }
}

/** Checks a single PDP on an already-open, already-logged-in driver (no session create/close here). */
async function checkPdpOnDriver(
  driver: WebdriverIO.Browser,
  sku: SkuConfig,
  outputDir: string,
): Promise<PdpCheckResult> {
  const url = buildPdpUrl(sku);
  const deepLinkUrl = applyDeepLinkHostOverride(url);
  const timestamp = new Date().toISOString();
  const features: CheckResult[] = [];
  const startTime = Date.now();
  let loadTime: number | undefined;
  let error: string | undefined;
  let pageScreenshot: string | undefined;

  console.log(`\n📱 Checking (Android): ${sku.name} (${sku.sku})`);
  console.log(`   Deep link: ${deepLinkUrl}`);

  // Pure REST call (Firebase Installations + Remote Config fetch) — independent of the
  // device/app session, so it runs concurrently with the Appium-based checks below.
  const remoteConfigPromise = fetchRemoteConfigFlagsAndroid(
    sku,
    resolveAndroidAppPackage(sku),
  ).catch((e) => {
    console.log(
      `   ⚠️  Remote Config fetch falhou: ${e instanceof Error ? e.message : String(e)}`,
    );
    return null;
  });

  try {
    await openPdpDeepLink(driver, deepLinkUrl, sku);
    // Give the app time to resolve the deep link and render the PDP
    await driver.pause(5000);
    loadTime = Date.now() - startTime;

    features.push(await checkAddToCartAndroid(driver));
    // Showcase checks confirm the RecyclerView renders natively AND cross-check the
    // same Einstein content zone/endpoint as the web checker.
    features.push(await checkBrandShowcaseAndroid(driver, sku));
    features.push(await checkRecommendationShowcaseAndroid(driver, sku));
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    console.log(`   ❌ Erro: ${error}`);
    if (error.includes("unable to resolve Intent")) {
      console.log(
        "   💡 O app instalado não tem intent-filter para esse host. Confirme com o time mobile " +
          "se o build enviado ao device farm é o flavor certo (ex.: naturaBra p/ prod BR), ou " +
          "tente outro host via ANDROID_DEEPLINK_HOST (ex.: dev/hml).",
      );
    }
  } finally {
    try {
      const screenshotsDir = path.join(outputDir, "screenshots");
      fs.mkdirSync(screenshotsDir, { recursive: true });
      const screenshotPath = path.join(
        screenshotsDir,
        `${sku.sku.replace(/[^a-zA-Z0-9._-]+/g, "_")}_${Date.now()}.png`,
      );
      await driver.saveScreenshot(screenshotPath);
      pageScreenshot = path.relative(outputDir, screenshotPath);
    } catch (screenshotError) {
      console.log(
        `   ⚠️  Falha ao capturar screenshot: ${screenshotError instanceof Error ? screenshotError.message : String(screenshotError)}`,
      );
    }
  }

  const success =
    !error &&
    features.every((f) => f.status !== "fail" && f.status !== "error");
  const remoteConfigFlags = (await remoteConfigPromise) ?? undefined;

  return {
    sku: sku.sku,
    name: sku.name,
    url,
    vendor: sku.vendor,
    country: sku.country,
    channel: sku.channel,
    platform: "android",
    timestamp,
    success,
    loadTime,
    features,
    error,
    pageScreenshot,
    remoteConfigFlags,
  };
}

/** Opens one device session, logs in once, then checks every SKU in `skus` sequentially before closing it. */
async function runSessionForSkus(
  skus: SkuConfig[],
  outputDir: string,
): Promise<PdpCheckResult[]> {
  const driver = await createAndroidSession();
  const results: PdpCheckResult[] = [];
  try {
    await loginOnceOnDriver(driver, skus[0], outputDir);
    for (const sku of skus) {
      results.push(await checkPdpOnDriver(driver, sku, outputDir));
    }
  } finally {
    await closeAndroidSession(driver);
  }
  return results;
}

/** Splits `items` round-robin across `numChunks` groups, dropping empty groups (e.g. more sessions than SKUs). */
function distributeIntoChunks<T>(items: T[], numChunks: number): T[][] {
  const chunks: T[][] = Array.from({ length: numChunks }, () => []);
  items.forEach((item, i) => chunks[i % numChunks].push(item));
  return chunks.filter((chunk) => chunk.length > 0);
}

/** ANDROID_CONCURRENCY = how many device sessions run in parallel; default 2, hard-capped at 5 (device farm plans usually limit concurrent sessions). */
function parseAndroidConcurrency(maxTasks: number): number {
  const raw = Number.parseInt(process.env.ANDROID_CONCURRENCY ?? "2", 10);
  const bounded = Math.min(Math.max(1, Number.isNaN(raw) ? 2 : raw), 5);
  return Math.min(bounded, maxTasks);
}

async function main() {
  const startTime = Date.now();
  // runId MUST match the output folder name — the dashboard looks up reports by runId.
  const runId = `run_android_${startTime}`;
  const outputDir = path.join(process.cwd(), "docs", "reports", runId);
  fs.mkdirSync(outputDir, { recursive: true });

  const allSkus = await loadSkus();
  // Which SKUs to check, in priority order:
  //   1. ANDROID_SKUS — comma-separated list, e.g. "NATBRA-70983,NATBRA-76420"
  //   2. ANDROID_SKU — single SKU (kept for backward compat with the original POC)
  //   3. default — every Natura BR ecommerce SKU (excludes the social commerce duplicates,
  //      which share the same `sku` value as their ecommerce counterpart)
  const skusFilter = process.env.ANDROID_SKUS?.trim()
    ? process.env.ANDROID_SKUS.split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : process.env.ANDROID_SKU?.trim()
      ? [process.env.ANDROID_SKU.trim()]
      : null;

  const targetSkus = skusFilter
    ? allSkus.filter((s) => skusFilter.includes(s.sku))
    : allSkus.filter(
        (s) =>
          s.vendor === "natura" &&
          s.country === "BR" &&
          (s.channel || "ecommerce") === "ecommerce",
      );

  if (targetSkus.length === 0) {
    throw new Error(
      `Nenhum SKU encontrado (filtro=${skusFilter?.join(",") ?? "<default natura/BR ecommerce>"})`,
    );
  }

  console.log(`📱 SKUs a verificar (Android): ${targetSkus.length}`);
  targetSkus.forEach((s) => console.log(`   - ${s.sku} (${s.name})`));

  const concurrency = parseAndroidConcurrency(targetSkus.length);
  const sessionChunks = distributeIntoChunks(targetSkus, concurrency);
  console.log(
    `🧵 Sessões paralelas: ${sessionChunks.length} (login 1x por sessão, PDPs navegados em sequência dentro dela)`,
  );

  const resultsPerSession = await Promise.all(
    sessionChunks.map((chunk) => runSessionForSkus(chunk, outputDir)),
  );
  const results = resultsPerSession.flat();

  const report: MonitoringReport = {
    runId,
    startTime: new Date(startTime).toISOString(),
    endTime: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    summary: {
      total: results.length,
      passed: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success && !r.error).length,
      errors: results.filter((r) => r.error).length,
    },
    results,
  };

  fs.writeFileSync(
    path.join(outputDir, "report.json"),
    generateJsonReport(report),
  );
  console.log(`\n✅ Relatório salvo em ${outputDir}`);

  // Register in docs/reports/index.json so the dashboard's history/report page can find
  // this run — the Next.js /report/[runId] route reads report.json directly by runId,
  // no report.html needed (android runs are JSON-only, unlike the web orchestrator).
  try {
    const indexJsonPath = path.join(
      process.cwd(),
      "docs",
      "reports",
      "index.json",
    );
    let reportsIndex: { reports: Record<string, unknown>[] } = { reports: [] };
    if (fs.existsSync(indexJsonPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(indexJsonPath, "utf-8"));
        if (data && Array.isArray(data.reports)) {
          reportsIndex = data;
        }
      } catch {
        console.log("Índice de relatórios existente inválido, recriando.");
      }
    }

    reportsIndex.reports.unshift({
      runId: report.runId,
      startTime: report.startTime,
      endTime: report.endTime,
      durationMs: report.durationMs,
      summary: report.summary,
      jsonPath: path.join("reports", runId, "report.json").replace(/\\/g, "/"),
      platform: "android",
    });
    if (reportsIndex.reports.length > 100) {
      reportsIndex.reports = reportsIndex.reports.slice(0, 100);
    }

    fs.writeFileSync(indexJsonPath, JSON.stringify(reportsIndex, null, 2));
    console.log(`✅ Índice de relatórios atualizado: ${indexJsonPath}`);
  } catch (e) {
    console.error("❌ Erro ao atualizar o histórico de relatórios:", e);
  }

  if (results.some((r) => !r.success)) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
