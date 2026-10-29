/**
 * Android PDP Feature Monitor - Orchestrator
 *
 * Scope (per roadmap Phase 2): a handful of features (add to cart, product images, content
 * banners, showcases, remote config)
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
import { loadSkusWithSource } from "./checks/configs/skus/skus.js";
import {
  CheckResult,
  MonitoringReport,
  PdpCheckResult,
  SkuConfig,
  StepScreenshot,
} from "./types.js";
import { StepScreenshotRecorder } from "./checks-android/stepScreenshots.js";
import { waitForPdpLoaded } from "./checks-android/pdpScreen.js";
import { toSafeFileName } from "./utils.js";
import { generateJsonReport } from "./reporter.js";
import { upsertReportIndexEntry } from "./reportIndex.js";
import {
  AndroidSessionPlan,
  parseAndroidConcurrency,
  planAndroidSessions,
} from "./androidConcurrency.js";
import { runWithConcurrency } from "./concurrency.js";
import {
  isOperationSelected,
  parseAndroidOperations,
} from "./checks-android/configs/apps.js";
import {
  createAndroidSession,
  openPdpDeepLink,
  closeAndroidSession,
  resolveAndroidAppPackage,
  SessionStartError,
} from "./deviceSetup.js";
import {
  applyNotifyMeFlag,
  checkAddToCartAndroid,
} from "./checks-android/addToCart.js";
import {
  applyPdpApiImages,
  checkImagesAndroid,
} from "./checks-android/images.js";
import {
  applyPdpApiContentBanners,
  checkContentBannersAndroid,
} from "./checks-android/contentBanners.js";
import {
  checkBrandShowcaseAndroid,
  checkRecommendationShowcaseAndroid,
} from "./checks-android/showcases.js";
import { buildRemoteConfigFlags } from "./checks-android/remoteConfig.js";
import {
  describePdpApiError,
  readAppSessionFlags,
} from "./checks-android/appNetworkFlags.js";
import {
  androidCredentialEnvNames,
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
  const credentials = getAndroidCredentialsFromEnv(sessionSku);
  if (!credentials) {
    const { email } = androidCredentialEnvNames(sessionSku);
    console.log(
      `   ℹ️  Sem conta de teste para ${sessionSku.vendor}-${sessionSku.country} (${email}): sessão anônima`,
    );
    return;
  }
  console.log(
    `   🔐 Fazendo login (${sessionSku.vendor}-${sessionSku.country})...`,
  );
  // Plain launch (no deep link data) so the Account tab is reachable; the session
  // persists on device, so it survives the terminateApp() inside openPdpDeepLink below.
  await driver
    .activateApp(resolveAndroidAppPackage(sessionSku))
    .catch((e) =>
      console.debug("   (debug) activateApp falhou (best-effort):", e),
    );
  const loggedIn = await loginAndroid(driver, credentials);
  console.log(
    loggedIn
      ? "   ✅ Login realizado"
      : "   ⚠️  Não foi possível confirmar o login (seguindo como sessão anônima)",
  );
  if (!loggedIn) {
    try {
      // Isolate sensitive auth debug artifacts outside public docs/ directory to avoid credential/PII leaks
      const authDebugDir = path.join(
        process.cwd(),
        ".tmp",
        "artifacts",
        "auth",
      );
      fs.mkdirSync(authDebugDir, { recursive: true });
      const screenshotPath = path.join(
        authDebugDir,
        `${sessionSku.sku}_login_debug_${Date.now()}.png`,
      );
      await driver.saveScreenshot(screenshotPath);
      console.log(
        `   🔒 Screenshot de debug de autenticação salvo em local seguro: ${screenshotPath}`,
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
  let loadTime: number | undefined;
  let error: string | undefined;
  let pageScreenshot: string | undefined;

  console.log(`\n📱 Checking (Android): ${sku.name} (${sku.sku})`);
  console.log(`   Deep link: ${deepLinkUrl}`);

  const steps = new StepScreenshotRecorder(driver);
  try {
    const navStartTime = Date.now();
    await openPdpDeepLink(driver, deepLinkUrl, sku);
    if (!(await waitForPdpLoaded(driver))) {
      console.log(
        "   ⚠️  PDP não terminou de carregar (esqueleto na tela) — checando assim mesmo",
      );
    }

    // Verify Add to Cart button and capture load time without duplicate waits
    const addToCartResult = await checkAddToCartAndroid(driver, navStartTime);
    loadTime = addToCartResult.loadTime ?? Date.now() - navStartTime;
    features.push(addToCartResult);
    await steps.capture("PDP aberta");

    // Carousel sits at the top of the PDP: checked before the showcase checks scroll down
    features.push(await checkImagesAndroid(driver));
    await steps.capture("Imagens do produto");

    // Scrolls from the top to the bottom of the PDP, where the showcase checks start searching
    features.push(await checkContentBannersAndroid(driver));
    await steps.capture("Banners de conteúdo");

    // Native showcase checks verify native RecyclerView rendering with populated items
    features.push(await checkBrandShowcaseAndroid(driver));
    await steps.capture("Vitrine mais produtos da marca");
    features.push(await checkRecommendationShowcaseAndroid(driver));
    await steps.capture("Vitrine achamos que você vai gostar");
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    console.log(`   ❌ Erro: ${error}`);
    await steps.capture("Erro");
    if (error.includes("unable to resolve Intent")) {
      console.log(
        "   💡 O app instalado não tem intent-filter para esse host. Confirme com o time mobile " +
          "se o build enviado ao device farm é o flavor certo (ex.: naturaBra p/ prod BR), ou " +
          "tente outro host via ANDROID_DEEPLINK_HOST (ex.: dev/hml).",
      );
    }

    // Capture device logcat for native crash / error diagnostics
    try {
      type LogcatEntry = {
        timestamp?: number | string;
        level?: string;
        message?: string;
      };
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
          .map(
            (l) =>
              `[${l.timestamp ?? ""}] [${l.level ?? ""}] ${l.message ?? ""}`,
          )
          .join("\n");

        if (crashLogs.trim().length > 0) {
          const logPath = path.join(
            logsDir,
            `${toSafeFileName(sku.sku)}_error.log`,
          );
          fs.writeFileSync(logPath, crashLogs);
          console.log(`   📋 Logcat de erros salvo em: ${logPath}`);
        }
      }
    } catch {
      // best-effort logcat capture
    }
  }

  const success = isSuccessful(features, error);
  // Final screen only on failure, like the Web monitor (docs/reports is committed by CI)
  if (!success) {
    try {
      const screenshotsDir = path.join(outputDir, "screenshots");
      fs.mkdirSync(screenshotsDir, { recursive: true });
      const screenshotPath = path.join(
        screenshotsDir,
        `${toSafeFileName(sku.sku)}_${Date.now()}.png`,
      );
      await driver.saveScreenshot(screenshotPath);
      pageScreenshot = path.relative(outputDir, screenshotPath);
    } catch (screenshotError) {
      console.log(
        `   ⚠️  Falha ao capturar screenshot: ${screenshotError instanceof Error ? screenshotError.message : String(screenshotError)}`,
      );
    }
  }
  let stepScreenshots: StepScreenshot[] | undefined;
  if (!success) {
    try {
      stepScreenshots = steps.save(outputDir, sku.sku);
    } catch (e) {
      console.log(
        `   ⚠️  Falha ao salvar screenshots das etapas: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

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
    stepScreenshots,
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

function isSuccessful(features: CheckResult[], error?: string): boolean {
  return (
    !error &&
    features.every((f) => f.status !== "fail" && f.status !== "error")
  );
}

/**
 * Commerce flags and Remote Config are read from the closed session's network capture (what
 * the app itself received), so they're attached to every SKU checked in that session. The
 * add-to-cart verdict depends on `wl_notify_me`, so it's completed here and `success` recomputed.
 * A failed PDP API response becomes the SKU's error (see findPdpApiErrors), and the images and
 * content banners the API sent (and the app's downloads of them) complete those verdicts (see
 * applyPdpApiImages, applyPdpApiContentBanners).
 */
async function attachAppSessionFlags(
  sessionId: string,
  results: PdpCheckResult[],
): Promise<void> {
  try {
    const flags = await readAppSessionFlags(
      sessionId,
      results.map((r) => r.sku),
    );
    if (!flags) {
      return;
    }
    for (const r of results) {
      const apiError = flags.pdpApiErrors[r.sku];
      if (apiError && !r.error) {
        // The real cause behind "nothing on screen": counted as an error, not a feature failure
        r.error = describePdpApiError(apiError);
        r.success = false;
        console.log(`   ❌ ${r.sku}: ${r.error}`);
      }
      if (flags.commerce) {
        r.commerceFeatureFlags = flags.commerce;
      }
      if (flags.remoteConfigEntries) {
        r.remoteConfigFlags = buildRemoteConfigFlags(
          flags.remoteConfigEntries,
          r,
        );
        r.features = r.features.map((f) =>
          f.featureKey === "addToCart"
            ? applyNotifyMeFlag(f, r.remoteConfigFlags?.wl_notify_me)
            : f,
        );
        r.success = isSuccessful(r.features, r.error);
      }
      const apiImages = flags.pdpApiImages[r.sku];
      if (apiImages) {
        r.features = r.features.map((f) => applyPdpApiImages(f, apiImages));
        r.success = isSuccessful(r.features, r.error);
      }
      const apiBanners = flags.pdpApiContentBanners[r.sku];
      if (apiBanners) {
        r.features = r.features.map((f) =>
          applyPdpApiContentBanners(f, apiBanners),
        );
        r.success = isSuccessful(r.features, r.error);
      }
    }
    console.log(
      `   ✓ Flags do app capturadas do tráfego da sessão ${sessionId}: ` +
        `commerce ${flags.commerce ? "ok" : "não encontradas"}, ` +
        `Remote Config ${flags.remoteConfigEntries ? "ok" : "não encontrado"}, ` +
        `imagens da API em ${Object.keys(flags.pdpApiImages).length}/${results.length} SKU(s)`,
    );
  } catch (e) {
    console.log(
      `   ⚠️  Flags do app indisponíveis: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

/** Opens one device session (one app, device set to one country), logs in once, then checks every
 * SKU of the plan sequentially before closing it.
 * Each SKU check is isolated: if checkPdpOnDriver throws (outside its own internal error handling,
 * e.g. buildPdpUrl failing), the SKU is recorded as a failure instead of aborting the rest of the
 * session's SKUs. */
async function runSession(
  plan: AndroidSessionPlan,
  outputDir: string,
): Promise<PdpCheckResult[]> {
  const { skus } = plan;
  const driver = await createAndroidSession(plan);
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
  await attachAppSessionFlags(driver.sessionId, results);
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

  const { skus: allSkus, source: skuSource } = await loadSkusWithSource();
  // Which SKUs to check, in priority order:
  //   1. ANDROID_SKUS — comma-separated list, e.g. "NATBRA-70983,NATBRA-76420"
  //   2. ANDROID_SKU — single SKU (kept for backward compat with the original POC)
  //   3. default — every ecommerce SKU of the ANDROID_OPERATIONS (default "natura-BR"); social
  //      commerce duplicates share the same `sku` value as their ecommerce counterpart
  const skusFilter = process.env.ANDROID_SKUS?.trim()
    ? process.env.ANDROID_SKUS.split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : process.env.ANDROID_SKU?.trim()
      ? [process.env.ANDROID_SKU.trim()]
      : null;
  const operations = parseAndroidOperations();

  const targetSkus = allSkus.filter(
    (s) =>
      (s.channel || "ecommerce") === "ecommerce" &&
      (skusFilter
        ? skusFilter.includes(s.sku)
        : isOperationSelected(s, operations)),
  );

  if (targetSkus.length === 0) {
    throw new Error(
      `Nenhum SKU encontrado (filtro=${skusFilter?.join(",") ?? `operações ${operations.join(",")}`})`,
    );
  }

  console.log(`📱 SKUs a verificar (Android): ${targetSkus.length}`);
  targetSkus.forEach((s) =>
    console.log(`   - ${s.sku} (${s.vendor}-${s.country}) ${s.name}`),
  );

  const concurrency = parseAndroidConcurrency(targetSkus.length);
  const { plans, unsupported } = planAndroidSessions(targetSkus, concurrency);
  const results: PdpCheckResult[] = unsupported.map((sku) =>
    buildErrorResult(
      sku,
      `Nenhum app Android cobre ${sku.vendor}-${sku.country}`,
    ),
  );
  console.log(
    `🧵 Sessões: ${plans.length} (${plans.map((p) => `${p.app.key}/${p.country}`).join(", ")}), ` +
      `até ${concurrency} em paralelo (login 1x por sessão, PDPs em sequência dentro dela)`,
  );

  // A session that fails outright (e.g. the app's APK id isn't configured) must not discard the
  // results of the other sessions: its SKUs are recorded as failures so they stay in the report.
  const failSession = (plan: AndroidSessionPlan, i: number, e: unknown) => {
    const error = e instanceof Error ? e.message : String(e);
    console.error(
      `❌ Sessão ${i + 1} (${plan.app.key}/${plan.country}) falhou por completo (SKUs perdidos: ${plan.skus.map((s) => s.sku).join(", ")}):`,
      e,
    );
    return plan.skus.map((sku) => buildErrorResult(sku, error));
  };

  // Sessions the farm didn't open (no device allocated in time, often because the parallel ones
  // hold the devices) are retried once, one at a time, after the others have released theirs.
  const notStarted: number[] = [];
  const sessionResults = await runWithConcurrency(
    plans.map((plan, i) => async () => {
      try {
        return await runSession(plan, outputDir);
      } catch (e) {
        if (e instanceof SessionStartError) {
          console.warn(
            `⏳ Sessão ${i + 1} (${plan.app.key}/${plan.country}) não abriu no device farm (${e.message}) — nova tentativa ao fim das demais`,
          );
          notStarted.push(i);
          return [];
        }
        return failSession(plan, i, e);
      }
    }),
    concurrency,
  );
  results.push(...sessionResults.flat());

  for (const i of notStarted) {
    const plan = plans[i];
    console.log(
      `
🔁 Nova tentativa da sessão ${i + 1} (${plan.app.key}/${plan.country})`,
    );
    try {
      results.push(...(await runSession(plan, outputDir)));
    } catch (e) {
      results.push(...failSession(plan, i, e));
    }
  }

  const report: MonitoringReport = {
    runId,
    startTime: new Date(startTime).toISOString(),
    endTime: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    skuSource,
    summary: {
      total: results.length,
      passed: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success && !r.error).length,
      errors: results.filter((r) => r.error).length,
    },
    results,
  };

  const jsonPath = path.join(outputDir, "report.json");
  fs.writeFileSync(jsonPath, generateJsonReport(report));
  console.log(`\n✅ Relatório salvo em ${jsonPath}`);

  // Register in docs/reports/index.android.json (platform: "android") so the dashboard finds this run
  try {
    await upsertReportIndexEntry({
      runId: report.runId,
      startTime: report.startTime,
      endTime: report.endTime,
      durationMs: report.durationMs,
      summary: report.summary,
      skuSource: report.skuSource,
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
