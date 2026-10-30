import { Locator, Page } from '@playwright/test';
import { CheckResult } from '../types.js';
import { SELECTORS, TIMING } from './configs/config.js';

export interface MinStockBadge {
  type?: string;
  text?: string;
}

/** Badge fields as returned by the BFF product API. */
export interface ProductBadgeData {
  /** Product-level flag of the main product. */
  isTopRated: boolean;
  /**
   * minStockBadge per productId: the main product and each of its variations
   * (the badge shown is the one of the variation on screen). Undefined when the
   * BFF omitted it.
   */
  minStockByProductId: Record<string, MinStockBadge | undefined>;
}

interface CapturedBadgeData extends ProductBadgeData {
  sku: string;
  source: 'api' | 'ssr';
  apiUrl?: string;
}

/**
 * WeakMap stores the captured badge fields per page instance.
 * Keys are garbage-collected when the page is closed.
 */
export const productBadgesCache = new WeakMap<Page, CapturedBadgeData>();

function toMinStockBadge(value: unknown): MinStockBadge | undefined {
  return value && typeof value === 'object' ? (value as MinStockBadge) : undefined;
}

/**
 * Reads the badge fields from the payload the App Router serialises into the
 * SSR HTML (escaped RSC JSON). Each product object (main product, its
 * variations, nested showcase products) is read as the slice from its
 * `"productId"` up to the next product's productId, keeping the first
 * occurrence of each id. The BFF omits isTopRated/minStockBadge when they don't
 * apply.
 */
export function parseProductBadgesFromHtml(
  html: string,
  sku: string,
): ProductBadgeData | undefined {
  const text = html.replace(/\\"/g, '"');
  const start = text.indexOf(`"productId":"${sku}"`);
  if (start < 0) {
    return undefined;
  }

  const slices = new Map<string, string>();
  const productIdRe = /"productId":"([^"]+)"/g;
  productIdRe.lastIndex = start;
  let current = productIdRe.exec(text);
  while (current) {
    let next = productIdRe.exec(text);
    // Repeated ids of the same object (e.g. productId + nested references) stay in one slice
    while (next && next[1] === current[1]) {
      next = productIdRe.exec(text);
    }
    if (!slices.has(current[1])) {
      slices.set(current[1], text.slice(current.index, next ? next.index : text.length));
    }
    current = next;
  }

  const minStockByProductId: Record<string, MinStockBadge | undefined> = {};
  for (const [productId, slice] of slices) {
    const match = slice.match(/"minStockBadge":(\{[^{}]*\})/);
    let badge: MinStockBadge | undefined;
    if (match) {
      try {
        badge = JSON.parse(match[1]) as MinStockBadge;
      } catch {
        // ignore malformed badge object
      }
    }
    minStockByProductId[productId] = badge;
  }

  return {
    isTopRated: /"isTopRated":true/.test(slices.get(sku) ?? ''),
    minStockByProductId,
  };
}

/** Same data from the BFF product API JSON (/pages/v2/product/:productId). */
export function parseProductBadgesFromApi(
  json: Record<string, unknown>,
): ProductBadgeData {
  const minStockByProductId: Record<string, MinStockBadge | undefined> = {
    [String(json.productId)]: toMinStockBadge(json.minStockBadge),
  };
  if (Array.isArray(json.variations)) {
    for (const variation of json.variations as Record<string, unknown>[]) {
      if (typeof variation?.productId === 'string') {
        minStockByProductId[variation.productId] = toMinStockBadge(variation.minStockBadge);
      }
    }
  }
  return { isTopRated: json.isTopRated === true, minStockByProductId };
}

/**
 * Must be called BEFORE page.goto() in the main orchestrator.
 * Reads the badge fields from the SSR product payload and from the BFF product
 * API (/product/:productId) when the page calls it client-side; the API wins.
 */
export function setupProductBadgesCapture(page: Page, sku: string): void {
  page.on('response', async (response) => {
    if (
      response.request().resourceType() === 'document' &&
      response.status() === 200
    ) {
      try {
        if (productBadgesCache.has(page)) {
          return;
        }
        const data = parseProductBadgesFromHtml(await response.text(), sku);
        if (data && !productBadgesCache.has(page)) {
          productBadgesCache.set(page, { ...data, sku, source: 'ssr' });
        }
      } catch {
        // ignore response body read errors
      }
      return;
    }

    const url = response.url();
    if (!url.includes('/product/')) {
      return;
    }

    try {
      const json = (await response.json()) as Record<string, unknown>;
      if (json.productId === sku) {
        productBadgesCache.set(page, {
          ...parseProductBadgesFromApi(json),
          sku,
          source: 'api',
          apiUrl: url,
        });
      }
    } catch {
      // ignore parse errors (non-JSON responses, aborted requests, etc.)
    }
  });
}

/**
 * Product code shown on the main product card ("cod. NATARG-110181"): the
 * selected variation for products with variations, otherwise the SKU itself.
 * Only codes present in the captured payload are accepted.
 */
async function getDisplayedProductId(
  page: Page,
  captured: CapturedBadgeData,
): Promise<string> {
  const text = await page
    .locator(SELECTORS.productBadges.mainProductCard)
    .first()
    .innerText({ timeout: 5000 })
    .catch(() => '');
  const prefix = captured.sku.slice(0, captured.sku.lastIndexOf('-') + 1);
  if (prefix) {
    const codeRe = new RegExp(`\\b${prefix}\\d+\\b`, 'g');
    for (const [code] of text.matchAll(codeRe)) {
      if (code in captured.minStockByProductId) {
        return code;
      }
    }
  }
  return captured.sku;
}

/**
 * Shared rule: the badge must be visible when the API says it applies, and
 * absent otherwise. `expected` is undefined when the product data wasn't captured.
 */
async function checkBadge(opts: {
  feature: string;
  featureKey: string;
  label: string;
  apiField: string;
  expected: boolean | undefined;
  source?: string;
  badge: Locator;
  details: Record<string, unknown>;
}): Promise<CheckResult> {
  const { feature, featureKey, label, apiField, source, details } = opts;
  const badge = opts.badge.first();

  if (opts.expected === true) {
    const isVisible = await badge
      .waitFor({ state: 'visible', timeout: TIMING.productBadgeWait })
      .then(() => true)
      .catch(() => false);
    return isVisible
      ? {
          feature,
          featureKey,
          passed: true,
          status: 'pass',
          message: `API do produto retorna ${apiField} e o selo "${label}" está visível (via ${source}).`,
          details,
        }
      : {
          feature,
          featureKey,
          passed: false,
          status: 'fail',
          message: `API do produto retorna ${apiField}, mas o selo "${label}" não está visível (via ${source}).`,
          details,
        };
  }

  const isVisible = await badge.isVisible().catch(() => false);

  if (opts.expected === false) {
    return isVisible
      ? {
          feature,
          featureKey,
          passed: false,
          status: 'fail',
          message: `API do produto não retorna ${apiField}, mas o selo "${label}" está sendo exibido (via ${source}).`,
          details,
        }
      : {
          feature,
          featureKey,
          passed: true,
          status: 'pass',
          message: `API do produto não retorna ${apiField} e o selo "${label}" corretamente não é exibido (via ${source}).`,
          details,
        };
  }

  if (isVisible) {
    return {
      feature,
      featureKey,
      passed: true,
      status: 'warning',
      message: `Selo "${label}" visível, mas os dados do produto não foram capturados para confirmar ${apiField}.`,
      details,
    };
  }

  return {
    feature,
    featureKey,
    passed: true,
    status: 'na',
    message: 'Dados do produto não capturados e selo não exibido — verificação não se aplica.',
    details,
  };
}

function errorResult(feature: string, featureKey: string, label: string, error: unknown): CheckResult {
  return {
    feature,
    featureKey,
    passed: false,
    status: 'error',
    message:
      error instanceof Error
        ? error.message
        : `Erro desconhecido ao verificar o selo "${label}".`,
  };
}

/**
 * The "melhor avaliado" tag must be shown only when the product API returns
 * isTopRated: true. Identified by its rating icon so it works in any locale.
 */
export async function checkTopRatedBadge(page: Page): Promise<CheckResult> {
  const feature = 'Selo "Melhor avaliado"';
  const featureKey = 'topRatedBadge';
  const label = 'melhor avaliado';
  try {
    const captured = productBadgesCache.get(page);
    return await checkBadge({
      feature,
      featureKey,
      label,
      apiField: 'isTopRated: true',
      expected: captured?.isTopRated,
      source: captured?.source,
      badge: page.locator(SELECTORS.productBadges.topRated),
      details: {
        isTopRated: captured?.isTopRated,
        source: captured?.source,
        apiUrl: captured?.apiUrl,
      },
    });
  } catch (error) {
    return errorResult(feature, featureKey, label, error);
  }
}

/**
 * The "últimas unidades" tag must be shown only when the product API returns a
 * minStockBadge of type minStockAlert for the product on screen (the selected
 * variation, for products with variations). Located by its clock icon or, when
 * the API sent one, by its text (the tag's aria-label).
 */
export async function checkMinStockBadge(page: Page): Promise<CheckResult> {
  const feature = 'Selo "Últimas unidades"';
  const featureKey = 'minStockBadge';
  const label = 'últimas unidades';
  try {
    const captured = productBadgesCache.get(page);
    const displayedProductId = captured
      ? await getDisplayedProductId(page, captured)
      : undefined;
    const minStockBadge = displayedProductId
      ? captured?.minStockByProductId[displayedProductId]
      : undefined;

    const byIcon = page.locator(SELECTORS.productBadges.minStock);
    const badge = minStockBadge?.text
      ? byIcon.or(
          page
            .locator(SELECTORS.productBadges.anyMainProductTag)
            .and(page.getByRole('listitem', { name: minStockBadge.text, exact: true })),
        )
      : byIcon;

    return await checkBadge({
      feature,
      featureKey,
      label,
      apiField: `minStockBadge do tipo minStockAlert para ${displayedProductId}`,
      expected: captured ? minStockBadge?.type === 'minStockAlert' : undefined,
      source: captured?.source,
      badge,
      details: {
        displayedProductId,
        minStockBadge,
        source: captured?.source,
        apiUrl: captured?.apiUrl,
      },
    });
  } catch (error) {
    return errorResult(feature, featureKey, label, error);
  }
}
