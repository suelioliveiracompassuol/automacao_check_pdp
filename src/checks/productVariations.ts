import { Page } from '@playwright/test';
import { CheckResult } from '../types.js';
import { SELECTORS } from './configs/config.js';

interface CapturedVariationsData {
  variationsCount?: number;
  apiUrl?: string;
}

/**
 * WeakMap stores captured variations data per page instance.
 * Keys are garbage-collected when the page is closed.
 */
export const variationsCache = new WeakMap<Page, CapturedVariationsData>();

/**
 * Recursively searches a __NEXT_DATA__ object for an object that has both
 * a string `productId` field and an array `variations` field (matching the
 * shape of the /pages/v2/product/ API response baked into SSR HTML).
 */
function findVariationsInNextData(obj: unknown, depth = 0): number | undefined {
  if (depth > 10 || obj === null || typeof obj !== 'object') {
    return undefined;
  }
  const record = obj as Record<string, unknown>;
  if (typeof record.productId === 'string' && Array.isArray(record.variations)) {
    return record.variations.length;
  }
  for (const value of Object.values(record)) {
    const found = findVariationsInNextData(value, depth + 1);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

/**
 * Must be called BEFORE page.goto() in the main orchestrator.
 * Intercepts the BFF product API response (/pages/v2/product/:sku) and stores
 * the number of variations for later use by checkProductVariations.
 *
 * Also parses __NEXT_DATA__ from the SSR HTML as a fallback for domains where
 * the API is not called client-side.
 */
export function setupProductVariationsCapture(page: Page): void {
  page.on('response', async (response) => {
    const url = response.url();

    if (
      response.request().resourceType() === 'document' &&
      response.status() === 200
    ) {
      try {
        const html = await response.text();
        const existing = variationsCache.get(page) ?? {};
        if (existing.variationsCount !== undefined) {
          return;
        }
        const nextDataMatch = html.match(
          /<script id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
        );
        if (nextDataMatch) {
          try {
            const nextData = JSON.parse(nextDataMatch[1]) as Record<string, unknown>;
            const variationsCount = findVariationsInNextData(nextData);
            if (variationsCount !== undefined) {
              variationsCache.set(page, { ...existing, variationsCount });
            }
          } catch {
            // ignore malformed __NEXT_DATA__
          }
        }
      } catch {
        // ignore response body read errors
      }
      return;
    }

    if (!url.includes('/pages/v2/product/')) {
      return;
    }

    try {
      const json = (await response.json()) as Record<string, unknown>;
      const existing = variationsCache.get(page) ?? {};

      if (typeof json.productId === 'string' && Array.isArray(json.variations)) {
        variationsCache.set(page, {
          ...existing,
          variationsCount: json.variations.length,
          apiUrl: url,
        });
      }
    } catch {
      // ignore parse errors (non-JSON responses, aborted requests, etc.)
    }
  });
}

export async function checkProductVariations(page: Page): Promise<CheckResult> {
  const featureKey = 'productVariations';
  const feature = 'Seletor de Variações do Produto';

  try {
    const captured = variationsCache.get(page);
    const colorOptionLocator = page.locator(SELECTORS.productVariations.selector);
    const domCount = await colorOptionLocator.count();

    const variationsCount = captured?.variationsCount ?? domCount;
    const source = captured?.variationsCount !== undefined ? 'api' : 'dom';

    if (variationsCount <= 1) {
      return {
        feature,
        featureKey,
        passed: true,
        status: 'na',
        message: `Produto sem múltiplas variações (${variationsCount} variação detectada via ${source}) — seletor de variações não se aplica.`,
        details: {
          variationsCount,
          source,
          apiUrl: captured?.apiUrl,
        },
      };
    }

    const isVisible = await colorOptionLocator
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (isVisible) {
      return {
        feature,
        featureKey,
        passed: true,
        status: 'pass',
        message: `Seletor de variações visível na página (${variationsCount} variações detectadas via ${source}).`,
        details: {
          variationsCount,
          source,
          apiUrl: captured?.apiUrl,
        },
      };
    }

    return {
      feature,
      featureKey,
      passed: false,
      status: 'fail',
      message: `${variationsCount} variações detectadas via ${source}, mas o seletor de variações não está visível na página.`,
      details: {
        variationsCount,
        source,
        apiUrl: captured?.apiUrl,
      },
    };
  } catch (error) {
    return {
      feature,
      featureKey,
      passed: false,
      status: 'error',
      message:
        error instanceof Error
          ? error.message
          : 'Erro desconhecido ao verificar variações do produto.',
    };
  }
}
