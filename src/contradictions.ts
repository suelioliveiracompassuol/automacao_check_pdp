/**
 * Cross-checks a SKU's results for verdicts that contradict each other: one check says
 * something never happened while another holds the evidence that it did (e.g. "the app didn't
 * call the reviews API" next to the reviews on screen). Both can't be true, so the failing one is
 * an automation problem (a wrong match, a selector that missed), not a product bug: it becomes
 * "error" (shown as "Erro" in the dashboard, apart from "Falhou") with the reason and the
 * original verdict kept in details.inconclusive.
 *
 * A rule only fires on structured details (flags set by the checks), never on message text.
 */
import type { CheckResult } from "./types.js";

interface ContradictionRule {
  /** featureKey of the result that gets overridden. */
  target: string;
  /** Returns the reason when `target` is contradicted by the other results, else undefined. */
  check: (target: CheckResult, byKey: Map<string, CheckResult>) => string | undefined;
}

const num = (v: unknown) => (typeof v === "number" ? v : undefined);
const apiOf = (r: CheckResult) => (r.details?.api ?? {}) as Record<string, unknown>;

export const CONTRADICTION_RULES: ContradictionRule[] = [
  {
    // Android: reviews API "not called", yet the app showed reviews or a rating
    target: "endpoint_reviews",
    check: (t, byKey) => {
      if (t.status !== "fail" || t.details?.notCalled !== true) {
        return undefined;
      }
      const reviews = byKey.get("reviews");
      const rating = byKey.get("rating");
      const count = num(reviews?.details?.reviewCount);
      if (reviews?.status === "pass" && count !== undefined && count > 0) {
        return `a tela mostrou ${count} avaliação(ões), então o app recebeu as avaliações de alguma chamada que a automação não reconheceu`;
      }
      if (rating?.status === "pass") {
        return "a tela mostrou a nota do produto, então o app recebeu as avaliações de alguma chamada que a automação não reconheceu";
      }
      return undefined;
    },
  },
  {
    // Android: carousel "not found" on screen, yet the app downloaded the API's images
    target: "images",
    check: (t) => {
      const downloaded = num(apiOf(t).downloadedCount) ?? 0;
      return t.status === "fail" && t.details?.hasCarousel === false && downloaded > 0
        ? `o app baixou ${downloaded} imagem(ns) do produto, então o carrossel foi renderizado e a leitura da tela não o encontrou`
        : undefined;
    },
  },
  {
    // Android: banners "not on screen", yet the app downloaded their images (only done when shown)
    target: "contentBanners",
    check: (t) => {
      const downloaded = num(apiOf(t).downloadedCount) ?? 0;
      return t.status === "fail" && t.details?.notOnScreen === true && downloaded > 0
        ? `o app baixou ${downloaded} imagem(ns) dos banners (só faz isso quando eles aparecem), então a leitura da tela não os encontrou`
        : undefined;
    },
  },
];

/** Turns each contradicted failure into an inconclusive "error" (see the module comment). */
export function flagContradictions(
  features: CheckResult[],
  rules: ContradictionRule[] = CONTRADICTION_RULES,
): CheckResult[] {
  const byKey = new Map(features.map((f) => [f.featureKey, f]));
  return features.map((f) => {
    for (const rule of rules) {
      if (rule.target !== f.featureKey) {
        continue;
      }
      const reason = rule.check(f, byKey);
      if (reason) {
        return {
          ...f,
          passed: false,
          status: "error",
          message: `Inconclusivo (verificar a automação): ${reason} · resultado original: ${f.message}`,
          details: {
            ...f.details,
            inconclusive: { reason, originalStatus: f.status, originalMessage: f.message },
          },
        };
      }
    }
    return f;
  });
}
