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
import { generateHtmlReport, generateJsonReport } from "./reporter.js";
import { upsertReportIndexEntry } from "./reportIndex.js";
import { distributeIntoChunks, parseAndroidConcurrency } from "./androidConcurrency.js";
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
    .catch((e) => console.debug("   (debug) activateApp falhou (best-effort):", e));
  const loggedIn = await loginAndroid(driver, credentials);
  console.log(
    loggedIn
      ? "   ✅ Login realizado"
      : "   ⚠️  Não foi possível confirmar o login (seguindo como sessão anônima)",
  );
  if (!loggedIn) {
    try {
      // Isolate sensitive auth debug artifacts outside public docs/ directory to avoid credential/PII leaks
      const authDebugDir = path.join(process.cwd(), ".tmp", "artifacts", "auth");
      fs.mkdirSync(authDebugDir, { recursive: true });
      const screenshotPath = path.join(
        authDebugDir,
        `${sessionSku.sku}_login_debug_${Date.now()}.png`,
      );
      await driver.saveScreenshot(screenshotPath);
      console.log(`   🔒 Screenshot de debug de autenticação salvo em local seguro: ${screenshotPath}`);
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
    const navStartTime = Date.now();
    await openPdpDeepLink(driver, deepLinkUrl, sku);

    // Verify Add to Cart button and capture load time without duplicate waits
    const addToCartResult = await checkAddToCartAndroid(driver, navStartTime);
    loadTime = addToCartResult.loadTime ?? Date.now() - navStartTime;
    features.push(addToCartResult);

    // Native showcase checks verify native RecyclerView rendering with populated items
    features.push(await checkBrandShowcaseAndroid(driver));
    features.push(await checkRecommendationShowcaseAndroid(driver));
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

    // Capture device logcat for native crash / error diagnostics
    try {
      type LogcatEntry = { timestamp?: number | string; level?: string; message?: string };
      const rawLogs = await driver.getLogs("logcat").catch((e) => {
        console.debug("   (debug) getLogs(logcat) falhou (best-effort):", e);
        return [];
      });
      const logs = (Array.isArray(rawLogs) ? rawLogs : []) as LogcatEntry[];
      if (logs.length > 0) {
        const logsDir = path.join(outputDir, "logs");
        fs.mkdirSync(logsDir, { recursive: true });
        const crashLogs = logs
          .filter(
            (l) =>
              l.level === "SEVERE" ||
              l.level === "ERROR" ||
              (typeof l.message === "string" &&
                (l.message.includes("FATAL EXCEPTION") ||
                  l.message.includes("AndroidRuntime") ||
                  l.message.includes("ANR in"))),
          )
          .map((l) => `[${l.timestamp ?? ""}] [${l.level ?? ""}] ${l.message ?? ""}`)
          .join("\n");

        if (crashLogs.trim().length > 0) {
          const logPath = path.join(
            logsDir,
            `${sku.sku.replace(/[^a-zA-Z0-9._-]+/g, "_")}_error.log`,
          );
          fs.writeFileSync(logPath, crashLogs);
          console.log(`   📋 Logcat de erros salvo em: ${logPath}`);
        }
      }
    } catch {
      // best-effort logcat capture
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

/** Builds a failed PdpCheckResult for a SKU that never got a real check attempt (e.g. the
 * session/driver itself threw outside checkPdpOnDriver's own error handling). Keeps the SKU
 * visible in the report instead of silently vanishing from the run. */
function buildErrorResult(sku: SkuConfig, error: string): PdpCheckResult {
  return {
    sku: sku.sku,
    name: sku.name,
    url: buildPdpUrl(sku),
    vendor: sku.vendor,
    country: sku.country,
    channel: sku.channel,
    platform: "android",
    timestamp: new Date().toISOString(),
    success: false,
    features: [],
    error,
  };
}

/** Opens one device session, logs in once, then checks every SKU in `skus` sequentially before closing it.
 * Each SKU check is isolated: if checkPdpOnDriver throws (outside its own internal error handling,
 * e.g. buildPdpUrl failing), the SKU is recorded as a failure instead of aborting the rest of the
 * session's SKUs. */
async function runSessionForSkus(
  skus: SkuConfig[],
  outputDir: string,
): Promise<PdpCheckResult[]> {
  const driver = await createAndroidSession();
  const results: PdpCheckResult[] = [];
  try {
    await loginOnceOnDriver(driver, skus[0]);
    for (const sku of skus) {
      try {
        results.push(await checkPdpOnDriver(driver, sku, outputDir));
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        console.error(
          `   ❌ Falha inesperada em ${sku.sku}, pulando para o próximo SKU da sessão: ${error}`,
        );
        results.push(buildErrorResult(sku, error));
      }
    }
  } finally {
    await closeAndroidSession(driver);
  }
  return results;
}

/** Deletes login-failure debug screenshots older than maxAgeDays so .tmp/artifacts/auth/ doesn't
 * grow unbounded across runs. */
function pruneOldAuthDebugScreenshots(maxAgeDays = 7): void {
  const dir = path.join(process.cwd(), ".tmp", "artifacts", "auth");
  if (!fs.existsSync(dir)) {
    return;
  }
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  for (const file of fs.readdirSync(dir)) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).mtimeMs < cutoff) {
      fs.rmSync(filePath);
    }
  }
}

async function main() {
  const startTime = Date.now();
  // runId MUST match the output folder name — the dashboard looks up reports by runId.
  const runId = `run_android_${startTime}`;
  const outputDir = path.join(process.cwd(), "docs", "reports", runId);
  fs.mkdirSync(outputDir, { recursive: true });

  pruneOldAuthDebugScreenshots();

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

  // Promise.allSettled (not Promise.all): one session rejecting outright must not discard the
  // results other sessions already completed. The session's SKUs are instead recorded as
  // failures so they stay visible in the report.
  const sessionOutcomes = await Promise.allSettled(
    sessionChunks.map((chunk) => runSessionForSkus(chunk, outputDir)),
  );
  const results: PdpCheckResult[] = [];
  sessionOutcomes.forEach((outcome, i) => {
    if (outcome.status === "fulfilled") {
      results.push(...outcome.value);
    } else {
      const chunk = sessionChunks[i];
      const error = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
      console.error(
        `❌ Sessão ${i + 1} falhou por completo (SKUs perdidos: ${chunk.map((s) => s.sku).join(", ")}):`,
        outcome.reason,
      );
      results.push(...chunk.map((sku) => buildErrorResult(sku, error)));
    }
  });

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

  const htmlPath = path.join(outputDir, "report.html");
  const jsonPath = path.join(outputDir, "report.json");

  fs.writeFileSync(htmlPath, generateHtmlReport(report));
  fs.writeFileSync(jsonPath, generateJsonReport(report));
  console.log(`\n✅ Relatórios salvos em ${outputDir} (HTML + JSON)`);

  // Register in docs/reports/index.json so dashboard and CI publish steps can find this run
  try {
    await upsertReportIndexEntry({
      runId: report.runId,
      startTime: report.startTime,
      endTime: report.endTime,
      durationMs: report.durationMs,
      summary: report.summary,
      htmlPath: path.join("reports", runId, "report.html").replace(/\\/g, "/"),
      jsonPath: path.join("reports", runId, "report.json").replace(/\\/g, "/"),
      platform: "android",
    });
    console.log(`✅ Índice de relatórios atualizado`);
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
