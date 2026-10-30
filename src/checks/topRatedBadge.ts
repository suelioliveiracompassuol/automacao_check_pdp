import { Page } from '@playwright/test';
import { CheckResult } from '../types.js';
import { SELECTORS, TIMING } from './configs/config.js';

interface CapturedTopRatedData {
  isTopRated?: boolean;
  source?: 'api' | 'ssr';
  apiUrl?: string;
}

/**
 * WeakMap stores the captured isTopRated flag per page instance.
 * Keys are garbage-collected when the page is closed.
 */
export const topRatedCache = new WeakMap<Page, CapturedTopRatedData>();

/**
 * Reads isTopRated from the product payload the App Router serialises into the
 * SSR HTML (escaped RSC JSON). The BFF omits the field when the product isn't
 * top rated, so a payload for this SKU without it means false.
 */
export function parseTopRatedFromHtml(html: string, sku: string): boolean | undefined {
  const text = html.replace(/\\"/g, '"');
  const match = text.match(/"isTopRated":(true|false)/);
  if (match) {
    return match[1] === 'true';
  }
  return text.includes(`"productId":"${sku}"`) ? false : undefined;
}

/**
 * Must be called BEFORE page.goto() in the main orchestrator.
 * Reads isTopRated from the SSR product payload and from the BFF product API
 * (/product/:productId) when the page calls it client-side; the API wins.
 */
export function setupTopRatedCapture(page: Page, sku: string): void {
  page.on('response', async (response) => {
    if (
      response.request().resourceType() === 'document' &&
      response.status() === 200
    ) {
      try {
        if (topRatedCache.get(page)?.isTopRated !== undefined) {
          return;
        }
        const isTopRated = parseTopRatedFromHtml(await response.text(), sku);
        if (isTopRated !== undefined && topRatedCache.get(page)?.source !== 'api') {
          topRatedCache.set(page, { isTopRated, source: 'ssr' });
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
      if (json.productId === sku && typeof json.isTopRated === 'boolean') {
        topRatedCache.set(page, { isTopRated: json.isTopRated, source: 'api', apiUrl: url });
      }
    } catch {
      // ignore parse errors (non-JSON responses, aborted requests, etc.)
    }
  });
}

/**
 * The "melhor avaliado" tag must be shown only when the product API returns
 * isTopRated: true. Identified by its rating icon so it works in any locale.
 */
export async function checkTopRatedBadge(page: Page): Promise<CheckResult> {
  const featureKey = 'topRatedBadge';
  const feature = 'Selo "Melhor avaliado"';

  try {
    const captured = topRatedCache.get(page);
    const badge = page.locator(SELECTORS.topRatedBadge.badge).first();
    const details = {
      isTopRated: captured?.isTopRated,
      source: captured?.source,
      apiUrl: captured?.apiUrl,
    };

    if (captured?.isTopRated === true) {
      const isVisible = await badge
        .waitFor({ state: 'visible', timeout: TIMING.topRatedBadgeWait })
        .then(() => true)
        .catch(() => false);
      return isVisible
        ? {
            feature,
            featureKey,
            passed: true,
            status: 'pass',
            message: `Produto com isTopRated: true e o selo "melhor avaliado" está visível (via ${captured.source}).`,
            details,
          }
        : {
            feature,
            featureKey,
            passed: false,
            status: 'fail',
            message: `Produto com isTopRated: true, mas o selo "melhor avaliado" não está visível (via ${captured.source}).`,
            details,
          };
    }

    const isVisible = await badge.isVisible().catch(() => false);

    if (captured?.isTopRated === false) {
      return isVisible
        ? {
            feature,
            featureKey,
            passed: false,
            status: 'fail',
            message: `Produto sem isTopRated: true, mas o selo "melhor avaliado" está sendo exibido (via ${captured.source}).`,
            details,
          }
        : {
            feature,
            featureKey,
            passed: true,
            status: 'pass',
            message: `Produto sem isTopRated: true e o selo "melhor avaliado" corretamente não é exibido (via ${captured.source}).`,
            details,
          };
    }

    if (isVisible) {
      return {
        feature,
        featureKey,
        passed: true,
        status: 'warning',
        message: 'Selo "melhor avaliado" visível, mas os dados do produto não foram capturados para confirmar isTopRated.',
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
  } catch (error) {
    return {
      feature,
      featureKey,
      passed: false,
      status: 'error',
      message:
        error instanceof Error
          ? error.message
          : 'Erro desconhecido ao verificar o selo "melhor avaliado".',
    };
  }
}
