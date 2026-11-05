import { Page } from "@playwright/test";
import { CheckResult } from "../types.js";
import { sleepMs } from "../utils.js";
import { TIMING } from "./configs/config.js";

/**
 * AI review summary (`aiSummary` of the BFF /reviews/v2/details response, Konfidency).
 *
 * ncf-ssr (`reviews.tsx` → `ReviewAICard`) shows the card inside #reviews when Remote Config
 * `product_reviews.ai_summary` is on and the reviews API returned a non-empty `aiSummary.text`;
 * it keeps the first text it got. The check reads that API response and compares it with the
 * card on the page:
 * - API without summary text → N/A (product has no summary yet)
 * - summary in the API and card shown with the same text → pass
 * - summary in the API but no card, or a card with an empty text → fail
 * - card without the text paragraph (layout changed, text not read) → warning
 * The Remote Config flag itself is handled by the runner (`disabled`).
 */

export interface AiSummary {
  processedDate?: string;
  text?: string;
  topics?: Record<string, string>;
}

export interface CapturedAiSummaryData {
  /** reviews/v2/details calls for the SKU seen so far */
  calls: number;
  /** HTTP status of the first call for the SKU */
  status?: number;
  /** First non-empty aiSummary returned for the SKU (what the card shows) */
  aiSummary?: AiSummary;
  /** Reviews API URL (without paging/sort params), for the report */
  apiUrl?: string;
}

/** Captured data per page; entries go away with the page. */
export const aiSummaryCache = new WeakMap<Page, CapturedAiSummaryData>();

function hasText(summary: AiSummary | undefined): boolean {
  return typeof summary?.text === "string" && summary.text.trim().length > 0;
}

/**
 * Must be called BEFORE page.goto(). Captures the aiSummary of the SKU's /reviews/v2/details
 * responses (calls for other products, e.g. showcase cards, are ignored).
 */
export function setupAiReviewSummaryCapture(page: Page, expectedProductId: string): void {
  page.on("response", async (response) => {
    const url = response.url();
    if (!url.includes("/reviews/v2/details")) {
      return;
    }
    let productId: string | null;
    try {
      productId = new URL(url).searchParams.get("productId");
    } catch {
      return;
    }
    if (productId !== expectedProductId) {
      return;
    }

    const existing = aiSummaryCache.get(page) ?? { calls: 0 };
    const current: CapturedAiSummaryData = {
      ...existing,
      calls: existing.calls + 1,
      status: existing.status ?? response.status(),
      apiUrl:
        existing.apiUrl ??
        `${url.split("/reviews/v2/details")[0]}/reviews/v2/details?productId=${productId}`,
    };
    aiSummaryCache.set(page, current);

    if (hasText(current.aiSummary)) {
      return;
    }
    try {
      const json = (await response.json()) as { aiSummary?: AiSummary };
      if (hasText(json.aiSummary)) {
        const latest = aiSummaryCache.get(page) ?? current;
        if (!hasText(latest.aiSummary)) {
          aiSummaryCache.set(page, { ...latest, aiSummary: json.aiSummary });
        }
      }
    } catch {
      // non-JSON / aborted response
    }
  });
}

const SENTIMENT_LABEL: Record<string, string> = {
  positive: "positivo",
  negative: "negativo",
  neutral: "neutro",
};

/** "cheiro e textura (positivo), preço (positivo)" */
export function formatAiSummaryTopics(topics: AiSummary["topics"]): string {
  return Object.entries(topics ?? {})
    .map(([topic, sentiment]) => `${topic} (${SENTIMENT_LABEL[sentiment] ?? sentiment})`)
    .join(", ");
}

function formatProcessedDate(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

/** Summary of the API data for the report message. */
function describeApiSummary(summary: AiSummary): string {
  const parts: string[] = [];
  const date = formatProcessedDate(summary.processedDate);
  if (date) {
    parts.push(`processado em ${date}`);
  }
  const topics = formatAiSummaryTopics(summary.topics);
  if (topics) {
    parts.push(`tópicos: ${topics}`);
  }
  const meta = parts.length > 0 ? ` (${parts.join("; ")})` : "";
  return `${meta}: "${summary.text?.trim()}"`;
}

const normalize = (s: string) => s.replace(/\s+/g, " ").trim();

async function waitForCapture(page: Page): Promise<CapturedAiSummaryData | undefined> {
  const deadline = Date.now() + TIMING.aiSummaryApiWait;
  while (Date.now() < deadline) {
    const data = aiSummaryCache.get(page);
    if (data && (data.calls > 0 || hasText(data.aiSummary))) {
      // Give the body parse of the first call a moment to land
      await sleepMs(300);
      return aiSummaryCache.get(page);
    }
    await sleepMs(250);
  }
  return aiSummaryCache.get(page);
}

export async function checkAiReviewSummary(page: Page): Promise<CheckResult> {
  const featureKey = "aiReviewSummary";
  const feature = "Resumo de avaliações por IA";

  try {
    const captured = await waitForCapture(page);
    const summary = captured?.aiSummary;
    const apiDetails = {
      apiUrl: captured?.apiUrl,
      apiStatus: captured?.status,
      aiSummary: summary,
    };

    if (!captured || captured.calls === 0) {
      return {
        feature,
        featureKey,
        passed: true,
        status: "warning",
        message: "API de avaliações (reviews/v2/details) do produto não capturada; resumo por IA não verificado",
        details: apiDetails,
      };
    }

    if (!summary || !hasText(summary)) {
      if (captured.status !== undefined && captured.status >= 400) {
        return {
          feature,
          featureKey,
          passed: false,
          status: "fail",
          message: `API de avaliações (reviews/v2/details) respondeu HTTP ${captured.status}; sem resumo por IA`,
          details: apiDetails,
        };
      }
      return {
        feature,
        featureKey,
        passed: true,
        status: "na",
        message: "Produto sem resumo por IA na API de avaliações (aiSummary vazio em reviews/v2/details)",
        details: apiDetails,
      };
    }

    const apiText = normalize(summary.text ?? "");
    const reviews = page.locator("#reviews");
    await reviews.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});

    const cards = reviews.locator(".bg-info-lightest");
    const genAiCard = cards.filter({
      has: page.locator('[data-icon-name*="generativeai"], i[class*="generativeai"]'),
    });
    const card = genAiCard.or(cards).first();
    const visible = await card
      .waitFor({ state: "visible", timeout: TIMING.aiSummaryTimeout })
      .then(() => true)
      .catch(() => false);

    if (!visible) {
      return {
        feature,
        featureKey,
        passed: false,
        status: "fail",
        message: `A API retornou resumo por IA, mas o card não foi exibido em #reviews${describeApiSummary(summary)}`,
        details: apiDetails,
      };
    }

    const paragraph = card.locator("p.text-body-1").first();
    const hasParagraph = (await paragraph.count()) > 0;
    const pageText = hasParagraph
      ? normalize((await paragraph.textContent({ timeout: 2000 }).catch(() => "")) ?? "")
      : "";
    const details = { ...apiDetails, pageText };

    if (!hasParagraph) {
      // Layout changed (no text paragraph in the card): the automation couldn't read the text,
      // which says nothing about the site, so neither pass nor fail
      return {
        feature,
        featureKey,
        passed: true,
        status: "warning",
        message: `Card de resumo por IA exibido, mas o texto não foi lido (p.text-body-1 não encontrado no card; verificar o seletor)${describeApiSummary(summary)}`,
        details: { ...details, textNotRead: true },
      };
    }

    if (!pageText) {
      return {
        feature,
        featureKey,
        passed: false,
        status: "fail",
        message: `A API retornou resumo por IA, mas o card foi exibido sem texto${describeApiSummary(summary)}`,
        details: { ...details, emptyCard: true },
      };
    }

    if (pageText !== apiText) {
      return {
        feature,
        featureKey,
        passed: true,
        status: "warning",
        message: `Card de resumo por IA exibido, mas o texto difere do retornado pela API${describeApiSummary(summary)}`,
        details,
      };
    }

    return {
      feature,
      featureKey,
      passed: true,
      status: "pass",
      message: `Resumo por IA exibido igual ao da API${describeApiSummary(summary)}`,
      details,
    };
  } catch (error) {
    return {
      feature,
      featureKey,
      passed: false,
      status: "error",
      message: `Erro ao verificar resumo IA: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
