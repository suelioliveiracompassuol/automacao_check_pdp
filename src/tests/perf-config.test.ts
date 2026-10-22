import { test, expect } from "@playwright/test";
import * as path from "node:path";
import { buildPerfUrl, getPerfConditions, getPerfOutputDir, getPerfSkus } from "../perf/config.js";

test.describe("Configuração de Performance - getPerfConditions", () => {
  test.afterEach(() => {
    delete process.env.PERF_CONNECTIVITY;
    delete process.env.PERF_VIEWPORT;
    delete process.env.PERF_CONSENT_COOKIE;
  });

  test("usa as condições do WebPageTest por padrão (4G, 1920x1200, sem cookie)", () => {
    expect(getPerfConditions()).toEqual({
      connectivity: { name: "4G", downKbps: 9000, upKbps: 9000, rttMs: 170 },
      viewport: { width: 1920, height: 1200 },
      consentCookie: false,
    });
  });

  test("aceita perfil, conexão custom, tela e cookie por env", () => {
    process.env.PERF_CONNECTIVITY = "Cable";
    expect(getPerfConditions().connectivity.rttMs).toBe(28);

    process.env.PERF_CONNECTIVITY = "custom:8000/2000/40";
    process.env.PERF_VIEWPORT = "1366x768";
    process.env.PERF_CONSENT_COOKIE = "true";
    const conditions = getPerfConditions();
    expect(conditions.connectivity).toMatchObject({ downKbps: 8000, upKbps: 2000, rttMs: 40 });
    expect(conditions.viewport).toEqual({ width: 1366, height: 768 });
    expect(conditions.consentCookie).toBe(true);
  });

  test("volta para 4G com perfil desconhecido", () => {
    process.env.PERF_CONNECTIVITY = "Satelite";
    expect(getPerfConditions().connectivity.name).toBe("4G");
  });
});

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

test.describe("Configuração de Performance - getPerfOutputDir", () => {
  const cwd = path.resolve("/repo");

  test.afterEach(() => {
    delete process.env.PERF_OUTPUT_DIR;
  });

  test("execuções locais vão para reports/perf, fora do docs publicado", () => {
    expect(getPerfOutputDir(cwd)).toBe(path.join(cwd, "reports", "perf"));
  });

  test("o workflow aponta para docs/perf via PERF_OUTPUT_DIR", () => {
    process.env.PERF_OUTPUT_DIR = "docs/perf";
    expect(getPerfOutputDir(cwd)).toBe(path.join(cwd, "docs", "perf"));
  });

  test("ignora PERF_OUTPUT_DIR vazio", () => {
    process.env.PERF_OUTPUT_DIR = "  ";
    expect(getPerfOutputDir(cwd)).toBe(path.join(cwd, "reports", "perf"));
  });
});
