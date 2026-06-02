import { Page } from "@playwright/test";
import { CheckResult } from "../types.js";

/**
 * Check for untranslated i18n keys visible on the page.
 *
 * Detects patterns like "product.reviews.recommendation", "pdp.shipping.title", etc.
 * These are translation keys that should have been resolved but are showing as raw text.
 */
export async function checkI18nKeys(page: Page): Promise<CheckResult> {
  const featureKey = "i18nKeys";
  const feature = "Chaves de tradução (i18n)";

  try {
    const result = await page.evaluate(() => {
      // Pattern: word.word.word (at least 2 dots, typical i18n key format)
      // e.g. "product.reviews.recommendation", "pdp.shipping.free"
      const i18nPattern = /\b[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*){2,}\b/g;

      // Known false positives to exclude
      const excludePatterns = [
        /^www\./,
        /\.com\b/,
        /\.br\b/,
        /\.ar\b/,
        /\.cl\b/,
        /\.co\b/,
        /\.mx\b/,
        /\.pe\b/,
        /\.png$/,
        /\.jpg$/,
        /\.svg$/,
        /\.webp$/,
        /\.js$/,
        /\.css$/,
        /\.html$/,
        /\.json$/,
        /\.woff/,
        /^https?\./,
        /^font\./,
        /^animation\./,
        /^transition\./,
        /^border\./,
        /^background\./,
      ];

      const found: { key: string; context: string }[] = [];
      const seen = new Set<string>();

      // Walk all visible text nodes
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        (node) => {
          const el = node.parentElement;
          if (!el) {
            return NodeFilter.FILTER_REJECT;
          }
          // Skip script, style, and hidden elements
          const tag = el.tagName;
          if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") {
            return NodeFilter.FILTER_REJECT;
          }
          // Skip invisible elements
          const style = window.getComputedStyle(el);
          if (style.display === "none" || style.visibility === "hidden") {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      );

      let node: Node | null;
      while ((node = walker.nextNode())) {
        const text = node.textContent?.trim() || "";
        if (text.length < 5 || text.length > 200) {
          continue;
        }

        const matches = text.match(i18nPattern);
        if (!matches) {
          continue;
        }

        for (const m of matches) {
          if (seen.has(m)) {
            continue;
          }
          if (excludePatterns.some((p) => p.test(m))) {
            continue;
          }

          seen.add(m);
          // Get surrounding context (parent element text, truncated)
          const parentText =
            node.parentElement?.textContent?.trim().substring(0, 80) || "";
          found.push({ key: m, context: parentText });
        }
      }

      // Also check for keys in visible element attributes (alt, title, placeholder, aria-label)
      const attrElements = document.querySelectorAll(
        "[alt], [title], [placeholder], [aria-label]",
      );
      for (const el of Array.from(attrElements)) {
        if (!(el instanceof HTMLElement)) {
          continue;
        }
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") {
          continue;
        }

        for (const attr of ["alt", "title", "placeholder", "aria-label"]) {
          const val = el.getAttribute(attr);
          if (!val) {
            continue;
          }
          const matches = val.match(i18nPattern);
          if (!matches) {
            continue;
          }
          for (const m of matches) {
            if (seen.has(m)) {
              continue;
            }
            if (excludePatterns.some((p) => p.test(m))) {
              continue;
            }
            seen.add(m);
            found.push({
              key: m,
              context: `[${attr}] ${val.substring(0, 60)}`,
            });
          }
        }
      }

      return found;
    });

    if (result.length === 0) {
      return {
        feature,
        featureKey,
        passed: true,
        status: "pass",
        message: "Nenhuma chave de tradução exposta na página",
      };
    }

    const keyList = result
      .slice(0, 5)
      .map((r) => r.key)
      .join(", ");
    const extra = result.length > 5 ? ` (+${result.length - 5} mais)` : "";

    return {
      feature,
      featureKey,
      passed: false,
      status: "fail",
      message: `${result.length} chave(s) de tradução não resolvida(s): ${keyList}${extra}`,
      details: { keys: result.slice(0, 10) },
    };
  } catch (error) {
    return {
      feature,
      featureKey,
      passed: false,
      status: "error",
      message: `Erro ao verificar i18n: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
