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
} from "./types.js";
import { StepScreenshotRecorder } from "./checks-android/stepScreenshots.js";
import { waitForPdpLoaded } from "./checks-android/pdpScreen.js";
import { toSafeFileName } from "./utils.js";
import { generateJsonReport } from "./reporter.js";
import { upsertReportIndexEntry } from "./reportIndex.js";
import {
  currentRatingStates,
  gradeRatingDivergence,
  preloadRatingStates,
} from "./ratingDivergence.js";
import { recordRunInFirestore } from "./firestoreHistory.js";
import {
  AndroidSessionGroup,
  parseAndroidConcurrency,
  planAndroidSessionGroups,
} from "./androidConcurrency.js";
import { runWithConcurrency } from "./concurrency.js";
import {
  fetchDeviceFarmCapacity,
  freeSlots,
  parseSlotWaitMs,
  waitForDeviceFarmSlot,
} from "./deviceFarmCapacity.js";
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
import {
  applyAppReviewsApi,
  checkReviewsGroupAndroid,
} from "./checks-android/reviews.js";
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

/** A checked PDP and its screenshots, still in memory (see saveEvidenceOfFailures). */
interface CheckedPdp {
  result: PdpCheckResult;
  evidence?: StepScreenshotRecorder;
}

/** Checks a single PDP on an already-open, already-logged-in driver (no session create/close here). */
async function checkPdpOnDriver(
  driver: WebdriverIO.Browser,
  sku: SkuConfig,
  outputDir: string,
): Promise<CheckedPdp> {
  const url = buildPdpUrl(sku);
  const deepLinkUrl = applyDeepLinkHostOverride(url);
  const timestamp = new Date().toISOString();
  const features: CheckResult[] = [];
  let loadTime: number | undefined;
  let error: string | undefined;

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

    features.push(...(await checkReviewsGroupAndroid(driver)));
    await steps.capture("Avaliações & Nota");
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

  // The final screen is kept in memory with the steps: whether the SKU failed is only known
  // after the session closes (see saveEvidenceOfFailures)
  await steps.captureFinal();

  return {
    result: {
      sku: sku.sku,
      name: sku.name,
      url,
      vendor: sku.vendor,
      country: sku.country,
      channel: sku.channel,
      platform: "android",
      timestamp,
      success: isSuccessful(features, error),
      loadTime,
      features,
      error,
    },
    evidence: steps,
  };
}

/**
 * Writes the final screen and the step screenshots of the SKUs that failed, once their verdicts
 * are final: the app's traffic (read after the session closes) and the rating divergence grace
 * can turn an on-screen failure into a pass, whose screenshots must not be committed.
 */
function saveEvidenceOfFailures(
  checked: CheckedPdp[],
  outputDir: string,
): void {
  for (const { result, evidence } of checked) {
    if (result.success || !evidence) {
      continue;
    }
    try {
      result.stepScreenshots = evidence.save(outputDir, result.sku);
      // The steps already show the path to the failure; the final screen only when there are none
      // (e.g. the deep link failed before the first step)
      if (result.stepScreenshots.length === 0) {
        result.stepScreenshots = undefined;
        result.pageScreenshot = evidence.saveFinal(outputDir, result.sku);
      }
    } catch (e) {
      console.log(
        `   ⚠️  Falha ao salvar screenshots de ${result.sku}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
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
    !error && features.every((f) => f.status !== "fail" && f.status !== "error")
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
      // Reviews API / PDP API rating fields, and Remote Config product_reviews gating
      r.features = applyAppReviewsApi(
        r.features,
        flags.reviewsApi[r.sku],
        r.remoteConfigFlags,
      );
      r.success = isSuccessful(r.features, r.error);
    }
    console.log(
      `   ✓ Flags do app capturadas do tráfego da sessão ${sessionId}: ` +
        `commerce ${flags.commerce ? "ok" : "não encontradas"}, ` +
        `Remote Config ${flags.remoteConfigEntries ? "ok" : "não encontrado"}, ` +
        `imagens da API em ${Object.keys(flags.pdpApiImages).length}/${results.length} SKU(s), ` +
        `avaliações da API em ${Object.values(flags.reviewsApi).filter((a) => a.calls.length > 0).length}/${results.length} SKU(s)`,
    );
  } catch (e) {
    console.log(
      `   ⚠️  Flags do app indisponíveis: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

/**
 * One device session of a group (one app, device set to one country): waits for a free slot on
 * the farm, opens the session, logs in once and checks SKUs taken from the group's queue until
 * it's empty. A session the farm doesn't open throws SessionStartError before taking any SKU, so
 * its share stays with the group's other sessions (or the retry). A SKU check that throws is
 * recorded as a failure and the session moves on; if the login itself fails, only the SKU in hand
 * is lost, the rest stays queued.
 */
async function runSession(
  group: AndroidSessionGroup,
  label: string,
  outputDir: string,
): Promise<PdpCheckResult[]> {
  const { queue } = group;
  await waitForDeviceFarmSlot({
    label,
    maxWaitMs: parseSlotWaitMs(),
    shouldStop: () => queue.size() === 0,
  });
  if (queue.size() === 0) {
    return [];
  }
  const driver = await createAndroidSession(group);
  const checked: CheckedPdp[] = [];
  let sku = queue.take();
  try {
    if (sku) {
      await loginOnceOnDriver(driver, sku);
      for (; sku; sku = queue.take()) {
        try {
          checked.push(await checkPdpOnDriver(driver, sku, outputDir));
        } catch (e) {
          const error = e instanceof Error ? e.message : String(e);
          console.error(
            `   ❌ Falha inesperada em ${sku.sku}, pulando para o próximo SKU da sessão: ${error}`,
          );
          checked.push({ result: buildErrorResult(sku, error) });
        }
      }
    }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`❌ ${label}: a sessão falhou (${error})`);
    if (sku) {
      checked.push({ result: buildErrorResult(sku, error) });
    }
  } finally {
    await closeAndroidSession(driver);
  }
  const results = checked.map((c) => c.result);
  if (results.length === 0) {
    return results;
  }
  await attachAppSessionFlags(driver.sessionId, results);
  // Product rating vs Konfidency: a divergence up to a day old is only a warning (same as Web)
  for (const r of results) {
    r.features = gradeRatingDivergence(r.features, r, "android");
    r.success = isSuccessful(r.features, r.error);
  }
  // Only now are the verdicts final: keep the screenshots of the SKUs that failed
  saveEvidenceOfFailures(checked, outputDir);
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
  // Since when each SKU's rating diverges (Firestore, falling back to docs/reports)
  await preloadRatingStates("android");
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

  // The farm's concurrency is shared with the whole LambdaTest organization: open only the
  // sessions that fit in the free slots (at least one, which waits for a slot)
  const requested = parseAndroidConcurrency(targetSkus.length);
  const capacity = await fetchDeviceFarmCapacity();
  const concurrency = capacity
    ? Math.max(1, Math.min(requested, freeSlots(capacity)))
    : requested;
  if (capacity) {
    console.log(
      `📶 Device farm: ${capacity.running}/${capacity.max} sessões da organização em uso, ${capacity.queued} na fila → ${concurrency} sessão(ões) em paralelo (pedido: ${requested})`,
    );
  }
  const { groups, unsupported } = planAndroidSessionGroups(
    targetSkus,
    concurrency,
  );
  const results: PdpCheckResult[] = unsupported.map((sku) =>
    buildErrorResult(
      sku,
      `Nenhum app Android cobre ${sku.vendor}-${sku.country}`,
    ),
  );
  console.log(
    `🧵 Sessões: ${groups.map((g) => `${g.sessions}× ${g.app.key}/${g.country}`).join(", ")}, ` +
      `até ${concurrency} em paralelo (login 1x por sessão; cada sessão pega o próximo SKU da fila do app + país)`,
  );

  // Why each group's leftover SKUs weren't checked: the farm didn't open a session (retried once
  // below) or the session can't be created at all (e.g. the app's APK id isn't configured)
  const notStarted = new Map<AndroidSessionGroup, string>();
  const cannotStart = new Map<AndroidSessionGroup, string>();
  const runGroupSession = async (group: AndroidSessionGroup, label: string) => {
    try {
      return await runSession(group, label, outputDir);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      if (e instanceof SessionStartError) {
        console.warn(
          `⏳ ${label} não abriu no device farm (${error}); os SKUs dela ficam na fila para as outras sessões`,
        );
        notStarted.set(group, error);
      } else {
        console.error(`❌ ${label} não pôde ser criada:`, e);
        cannotStart.set(group, error);
      }
      return [];
    }
  };

  const sessionResults = await runWithConcurrency(
    groups.flatMap((group) =>
      Array.from(
        { length: group.sessions },
        (_, i) => () =>
          runGroupSession(
            group,
            `Sessão ${i + 1} (${group.app.key}/${group.country})`,
          ),
      ),
    ),
    concurrency,
  );
  results.push(...sessionResults.flat());

  // Groups none of whose sessions opened still have SKUs queued: one more session each, one at a
  // time, after the others released their slots (it also waits for a free slot)
  for (const group of groups) {
    if (group.queue.size() === 0 || cannotStart.has(group)) {
      continue;
    }
    console.log(
      `\n🔁 Nova tentativa: ${group.queue.size()} SKU(s) de ${group.app.key}/${group.country} ainda sem sessão`,
    );
    results.push(
      ...(await runGroupSession(
        group,
        `Sessão extra (${group.app.key}/${group.country})`,
      )),
    );
  }

  // Whatever is still queued was never checked
  for (const group of groups) {
    const reason =
      cannotStart.get(group) ??
      notStarted.get(group) ??
      "Nenhuma sessão do device farm checou este SKU";
    for (let sku = group.queue.take(); sku; sku = group.queue.take()) {
      console.error(`❌ ${sku.sku} não foi checado: ${reason}`);
      results.push(buildErrorResult(sku, reason));
    }
  }
  // Report in the SKUs' order (sessions finish in any order)
  const skuOrder = new Map(targetSkus.map((sku, i) => [sku.sku, i]));
  results.sort(
    (a, b) => (skuOrder.get(a.sku) ?? 0) - (skuOrder.get(b.sku) ?? 0),
  );

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
  const indexEntry = {
    runId: report.runId,
    startTime: report.startTime,
    endTime: report.endTime,
    durationMs: report.durationMs,
    summary: report.summary,
    skuSource: report.skuSource,
    jsonPath: path.join("reports", runId, "report.json").replace(/\\/g, "/"),
    platform: "android" as const,
  };
  try {
    await upsertReportIndexEntry(indexEntry);
    console.log(`✅ Índice de relatórios atualizado`);
  } catch (e) {
    console.error("❌ Erro ao atualizar o histórico de relatórios:", e);
  }

  // Rating states and run summary in Firestore (best effort, see firestoreHistory.ts)
  await recordRunInFirestore(
    report,
    indexEntry,
    "android",
    currentRatingStates(report.results, "android"),
  );

  if (results.some((r) => !r.success)) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
