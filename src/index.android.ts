/**
 * Android PDP Feature Monitor - POC Orchestrator
 *
 * Scope (per roadmap Phase 2): 1 feature (add to cart) on 1 SKU/1 device via a device farm.
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
} from "./deviceSetup.js";
import { checkAddToCartAndroid } from "./checks-android/addToCart.js";

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

async function checkPdpAndroid(sku: SkuConfig): Promise<PdpCheckResult> {
  const url = buildPdpUrl(sku);
  const deepLinkUrl = applyDeepLinkHostOverride(url);
  const timestamp = new Date().toISOString();
  const features: CheckResult[] = [];
  const startTime = Date.now();
  let loadTime: number | undefined;
  let error: string | undefined;

  console.log(`\n📱 Checking (Android): ${sku.name} (${sku.sku})`);
  console.log(`   Deep link: ${deepLinkUrl}`);

  const driver = await createAndroidSession();

  try {
    await openPdpDeepLink(driver, deepLinkUrl);
    // Give the app time to resolve the deep link and render the PDP
    await driver.pause(5000);
    loadTime = Date.now() - startTime;

    features.push(await checkAddToCartAndroid(driver));
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
    await closeAndroidSession(driver);
  }

  const success =
    !error &&
    features.every((f) => f.status !== "fail" && f.status !== "error");

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
  };
}

async function main() {
  const startTime = Date.now();
  const runId = `android_${Date.now()}`;
  const outputDir = path.join(
    process.cwd(),
    "docs",
    "reports",
    `run_android_${Date.now()}`,
  );
  fs.mkdirSync(outputDir, { recursive: true });

  const allSkus = await loadSkus();
  // POC scope: 1 SKU — override via ANDROID_SKU, default to the first Natura BR sku
  const targetSku = process.env.ANDROID_SKU
    ? allSkus.find((s) => s.sku === process.env.ANDROID_SKU)
    : allSkus.find((s) => s.vendor === "natura" && s.country === "BR");

  if (!targetSku) {
    throw new Error(
      `SKU não encontrado (ANDROID_SKU=${process.env.ANDROID_SKU ?? "<default natura/BR>"})`,
    );
  }

  const result = await checkPdpAndroid(targetSku);

  const report: MonitoringReport = {
    runId,
    startTime: new Date(startTime).toISOString(),
    endTime: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    summary: {
      total: 1,
      passed: result.success ? 1 : 0,
      failed: result.success ? 0 : 1,
      errors: result.error ? 1 : 0,
    },
    results: [result],
  };

  fs.writeFileSync(
    path.join(outputDir, "report.json"),
    generateJsonReport(report),
  );
  console.log(`\n✅ Relatório salvo em ${outputDir}`);

  if (!result.success) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
