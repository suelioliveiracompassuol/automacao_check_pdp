import { test, expect } from "@playwright/test";
import { buildPerfUrl, getPerfSkus } from "../perf/config.js";

test.describe("Configuração de Performance - getPerfSkus", () => {
  test.afterEach(() => {
    delete process.env.PERF_SKUS;
  });

  test("usa PDP Full e PDP Low da automação do site geral por padrão", () => {
    delete process.env.PERF_SKUS;
    const skus = getPerfSkus();
    expect(skus.map((s) => [s.pageType, s.sku])).toEqual([
      ["PDPFull", "NATBRA-108403"],
      ["PDPLow", "NATBRA-56948"],
    ]);
    expect(buildPerfUrl(skus[1])).toBe(
      "https://www.natura.com.br/p/refil-desodorante-corporal-kaiak-masculino-100-ml/NATBRA-56948",
    );
  });

  test("lê PERF_SKUS com pageType opcional e ignora tipo inválido", () => {
    process.env.PERF_SKUS = "NATBRA-1|slug-a|PDPLow, NATBRA-2|slug-b|Outro, NATBRA-3|slug-c";
    const skus = getPerfSkus();
    expect(skus.map((s) => [s.sku, s.slug, s.pageType])).toEqual([
      ["NATBRA-1", "slug-a", "PDPLow"],
      ["NATBRA-2", "slug-b", undefined],
      ["NATBRA-3", "slug-c", undefined],
    ]);
  });
});
