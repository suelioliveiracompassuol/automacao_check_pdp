/**
 * The Android network matchers against REAL session captures (src/tests/fixtures/android, made
 * with `npm run fixtures:android`), checked against what the app SHOWED in the same run (the
 * .screen.json next to each capture). Hand-written examples repeat the code's own assumptions;
 * these break them: a master SKU whose reviews call carries a variation's id was reported as
 * "the app didn't call the reviews API" until a real capture was looked at.
 *
 * New capture → new fixture pair → covered here with no test changes.
 */
import { test, expect } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  extractNetworkEntries,
  findAppReviewsApi,
  findPdpApiErrors,
  findPdpApiImages,
} from "../checks-android/appNetworkFlags.js";

const DIR = path.join(process.cwd(), "src", "tests", "fixtures", "android");

interface ScreenFacts {
  reviewCount?: number;
  headerRating?: number;
  sectionRating?: number;
  imageCount?: number;
}

const fixtures = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith(".har.json"))
  .map((f) => {
    const name = f.replace(/\.har\.json$/, "");
    return {
      name,
      log: JSON.parse(fs.readFileSync(path.join(DIR, f), "utf-8")) as unknown,
      screen: (
        JSON.parse(fs.readFileSync(path.join(DIR, `${name}.screen.json`), "utf-8")) as {
          skus: Record<string, ScreenFacts>;
        }
      ).skus,
    };
  });

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Per SKU whose screen showed reviews: what the matchers read from the network next to what the
 * screen showed (rounded the way the app shows ratings). A field is compared only when the screen
 * recorded it.
 */
function reviewsAgainstScreen(log: unknown, screen: Record<string, ScreenFacts>) {
  const api = findAppReviewsApi(log, Object.keys(screen));
  const observed: Record<string, Record<string, unknown>> = {};
  const expected: Record<string, Record<string, unknown>> = {};
  for (const [sku, facts] of Object.entries(screen)) {
    if (!facts.reviewCount) {
      continue;
    }
    const a = api[sku];
    const rating = (n?: number) => (n === undefined ? undefined : round1(n));
    expected[sku] = { called: true, reviewCount: facts.reviewCount };
    observed[sku] = { called: (a?.calls.length ?? 0) > 0, reviewCount: a?.reviews?.reviewsCount };
    if (facts.sectionRating !== undefined) {
      expected[sku].sectionRating = facts.sectionRating;
      observed[sku].sectionRating = rating(a?.reviews?.aggregatedRating);
    }
    if (facts.headerRating !== undefined) {
      expected[sku].headerRating = facts.headerRating;
      observed[sku].headerRating = rating(a?.product?.rating);
    }
  }
  return { observed, expected };
}

test.describe("Android: matchers de rede contra capturas reais", () => {
  test("há fixtures", () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  for (const { name, log, screen } of fixtures) {
    const skus = Object.keys(screen);

    test.describe(name, () => {
      test("toda chamada de avaliações da sessão é atribuída a algum SKU", () => {
        const api = findAppReviewsApi(log, skus);
        const attributed = new Set(Object.values(api).flatMap((a) => a.calls.map((c) => c.url)));
        const orphans = extractNetworkEntries(log)
          .filter((e) => e.url.includes("/reviews/v2/details"))
          .map((e) => e.url)
          .filter((url) => !attributed.has(url));
        expect(orphans, "chamadas de reviews que nenhum SKU reconheceu").toEqual([]);
      });

      test("a API de avaliações lida bate com o que a tela mostrou", () => {
        const { observed, expected } = reviewsAgainstScreen(log, screen);
        expect(observed).toEqual(expected);
      });

      test("cada SKU tem a API da PDP com imagens e sem erro", () => {
        const images = findPdpApiImages(log, skus);
        expect(findPdpApiErrors(log, skus)).toEqual({});
        for (const sku of skus) {
          expect(images[sku]?.urls.length, `${sku}: imagens da API`).toBeGreaterThan(0);
        }
      });
    });
  }

  test("master com variações: o app abre a 1ª variação e busca as avaliações dela", () => {
    const ar = fixtures.find((f) => f.name === "natura-ar_master-variacoes");
    expect(ar, "fixture natura-ar_master-variacoes").toBeDefined();
    const images = findPdpApiImages(ar!.log, ["NATARG-00068"]);
    expect(images["NATARG-00068"].openedVariation).toBe("NATARG-110181");
    const reviews = findAppReviewsApi(ar!.log, ["NATARG-00068"])["NATARG-00068"];
    expect(reviews.calls.map((c) => new URL(c.url).searchParams.get("productId"))).toEqual(["NATARG-110181"]);
  });
});
