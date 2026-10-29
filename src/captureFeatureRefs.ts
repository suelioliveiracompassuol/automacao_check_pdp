/**
 * Captures the dashboard's reference images (see featureRefs.ts): opens one SKU per operation
 * group and screenshots just the element each check looks for.
 *
 * Env: REFS_GROUPS (e.g. `natura-br,minha-loja-avon`), SKU_FILTER, REFS_OVERWRITE=true to replace
 * existing images (default keeps them, so manual screenshots are never overwritten), HEADLESS=false.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { Browser, chromium, firefox, Page } from "@playwright/test";
import { buildPdpUrl, getDomain, TIMING } from "./checks/configs/config.js";
import { loadSkus } from "./checks/configs/skus/skus.js";
import {
  dismissCookieBanner,
  scrollAndLoadContent,
} from "./checks/featureRunner.js";
import { createStandardContext } from "./browserSetup.js";
import {
  FEATURE_REF_TARGETS,
  FeatureRefTarget,
  refGroupOf,
} from "./featureRefs.js";
import { FeatureKey, SkuConfig } from "./types.js";

const OUTPUT_DIR = path.join(
  process.cwd(),
  "dashboard",
  "public",
  "feature-refs",
);
/** Groups captured from a single operation; Natura LATAM is captured from Colombia. */
const GROUP_SOURCE_COUNTRY: Record<string, string> = { "natura-latam": "CO" };
/** Late client-only components (coupons, gift module) take up to ~30 s to show. */
const ELEMENT_TIMEOUT = TIMING.couponsTimeout;
const PADDING = 8;
const SCROLL_MARGIN = 40;

/**
 * Hides the sticky header and floating widgets so they don't cover the crops. Only high z-index
 * layers: the gallery column is sticky and its main image layer is fixed, both below that.
 */
async function hideOverlays(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const el of Array.from(
      document.querySelectorAll<HTMLElement>("body *"),
    )) {
      const style = getComputedStyle(el);
      const zIndex = Number(style.zIndex) || 0;
      if (
        (style.position === "fixed" || style.position === "sticky") &&
        zIndex >= 30
      ) {
        el.style.visibility = "hidden";
      }
    }
  });
}

function parseList(value: string | undefined): Set<string> | null {
  const items = value
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return items?.length ? new Set(items) : null;
}

function pickSkus(skus: SkuConfig[]): Map<string, SkuConfig> {
  const groupsFilter = parseList(process.env.REFS_GROUPS);
  const skuFilter = parseList(process.env.SKU_FILTER);
  const picked = new Map<string, SkuConfig>();
  for (const sku of skus) {
    if (skuFilter && !skuFilter.has(sku.sku)) {
      continue;
    }
    const group = refGroupOf(sku);
    const sourceCountry = GROUP_SOURCE_COUNTRY[group];
    if (
      picked.has(group) ||
      (groupsFilter && !groupsFilter.has(group)) ||
      (sourceCountry && !skuFilter && sku.country !== sourceCountry)
    ) {
      continue;
    }
    picked.set(group, sku);
  }
  return picked;
}

async function captureElement(
  page: Page,
  target: FeatureRefTarget,
  file: string,
): Promise<boolean> {
  const element = target.locate(page).filter({ visible: true }).first();
  const visible = await element
    .waitFor({ state: "visible", timeout: ELEMENT_TIMEOUT })
    .then(() => true)
    .catch(() => false);
  if (!visible) {
    return false;
  }

  // Again per capture: widgets can mount late
  await hideOverlays(page);
  await element.evaluate((el, offset) => {
    el.scrollIntoView({ block: "start" });
    window.scrollBy(0, -offset);
  }, SCROLL_MARGIN);
  // Let lazy images in the crop settle after the scroll
  // eslint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(500);
  const box = await element.boundingBox();
  if (!box) {
    return false;
  }
  const padding = target.padding ?? PADDING;
  const viewport = page.viewportSize()!;
  const x = Math.max(0, box.x - padding);
  const y = Math.max(0, box.y - padding);
  await page.screenshot({
    path: file,
    clip: {
      x,
      y,
      width: Math.min(box.width + padding * 2, viewport.width - x),
      height: Math.min(
        box.height + padding * 2,
        target.maxHeight ?? Infinity,
        viewport.height - y,
      ),
    },
  });
  return true;
}

async function captureGroup(
  browser: Browser,
  group: string,
  sku: SkuConfig,
): Promise<void> {
  const url = buildPdpUrl(sku);
  const features = (
    getDomain(sku.vendor, sku.country, sku.channel)?.availableFeatures ?? []
  ).filter((key): key is FeatureKey => key in FEATURE_REF_TARGETS);
  const dir = path.join(OUTPUT_DIR, group);
  const overwrite = process.env.REFS_OVERWRITE === "true";
  const pending = features.filter(
    (key) => overwrite || !fs.existsSync(path.join(dir, `${key}.png`)),
  );

  console.log(`\n📸 ${group} — ${sku.sku} (${url})`);
  if (pending.length === 0) {
    console.log(
      "   ⏭️  Todas as imagens já existem (REFS_OVERWRITE=true para substituir)",
    );
    return;
  }
  fs.mkdirSync(dir, { recursive: true });

  const context = await createStandardContext(browser, url);
  const page = await context.newPage();
  // Taller viewport so tall sections (showcases, carousel) fit in a single crop
  await page.setViewportSize({ width: 1280, height: 900 });
  try {
    const response = await page.goto(url, {
      timeout: TIMING.navigationTimeout,
      waitUntil: "domcontentloaded",
    });
    if (!response || response.status() >= 400) {
      console.log(
        `   ❌ HTTP ${response?.status() ?? "?"} — tire os prints manualmente em ${dir}`,
      );
      return;
    }
    await dismissCookieBanner(page, "   ");
    await scrollAndLoadContent(page);

    for (const key of pending) {
      const ok = await captureElement(
        page,
        FEATURE_REF_TARGETS[key]!,
        path.join(dir, `${key}.png`),
      ).catch(() => false);
      console.log(
        ok
          ? `   ✅ ${key}`
          : `   ⚠️  ${key}: elemento não encontrado nesta PDP`,
      );
    }
  } catch (error) {
    console.log(
      `   ❌ ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    await context.close();
  }
}

async function main(): Promise<void> {
  const groups = pickSkus(await loadSkus());
  const headless = process.env.HEADLESS !== "false";
  const browserChromium = await chromium.launch({
    headless,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
  });
  // Same rule as the monitor: Firefox for Natura LATAM (HTTP2 issues with headless Chromium)
  const browserFirefox = await firefox.launch({ headless }).catch(() => null);
  try {
    for (const [group, sku] of groups) {
      const useFirefox =
        browserFirefox !== null &&
        sku.vendor === "natura" &&
        sku.country !== "BR" &&
        (sku.channel || "ecommerce") === "ecommerce";
      await captureGroup(
        useFirefox ? browserFirefox : browserChromium,
        group,
        sku,
      );
    }
  } finally {
    await browserChromium.close();
    await browserFirefox?.close();
  }
  console.log(`\nImagens em ${OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
