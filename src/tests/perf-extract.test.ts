import { test, expect } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  extractMetrics,
  extractLcpElement,
  extractOpportunities,
  isValidRun,
  pickMedianIndex,
  type Lhr,
} from "../perf/extractMetrics.js";

const sampleLhr: Lhr = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), "src", "tests", "mocks", "lhr-sample.json"),
    "utf-8",
  ),
);

test.describe("Métricas de Performance - extractMetrics", () => {
  test("deve extrair e arredondar valores corretamente a partir do LHR mock", () => {
    const metrics = extractMetrics(sampleLhr);

    expect(metrics.performanceScore).toBe(85);
    expect(metrics.startRender).toBe(2105);
    expect(metrics.lcp).toBe(2450);
    expect(metrics.cls).toBe(0.046);
    expect(metrics.tbt).toBe(180);
    expect(metrics.fcp).toBe(1251);
    expect(metrics.speedIndex).toBe(2200);
    expect(metrics.ttfb).toBe(450);
    expect(metrics.totalByteWeight).toBe(1845600);
    expect(metrics.requestCount).toBe(3);
  });

  test("deve retornar null para todos os campos quando audits estiverem vazios", () => {
    const emptyLhr: Lhr = {
      audits: {},
    };
    const metrics = extractMetrics(emptyLhr);

    expect(metrics.performanceScore).toBeNull();
    expect(metrics.startRender).toBeNull();
    expect(metrics.lcp).toBeNull();
    expect(metrics.cls).toBeNull();
    expect(metrics.tbt).toBeNull();
    expect(metrics.fcp).toBeNull();
    expect(metrics.speedIndex).toBeNull();
    expect(metrics.ttfb).toBeNull();
    expect(metrics.totalByteWeight).toBeNull();
    expect(metrics.requestCount).toBeNull();
  });

  test("deve extrair elemento de LCP corretamente", () => {
    const element = extractLcpElement(sampleLhr);
    expect(element).toEqual({
      nodeLabel: "img.product-image",
      selector: "div.gallery > img",
      snippet: '<img class="product-image" src="kaiak.jpg">',
    });
  });

  test("deve retornar null para elemento de LCP quando audit estiver ausente", () => {
    const emptyLhr: Lhr = { audits: {} };
    expect(extractLcpElement(emptyLhr)).toBeNull();
  });
});

test.describe("Métricas de Performance - extractOpportunities", () => {
  test("deve ordenar oportunidades pelo impacto e ignorar economia de 0 ms", () => {
    const opportunities = extractOpportunities(sampleLhr);

    expect(opportunities).toHaveLength(2);
    expect(opportunities[0]).toEqual({
      id: "unused-javascript",
      title: "Reduzir JavaScript não utilizado",
      savingsMs: 1200,
    });
    expect(opportunities[1]).toEqual({
      id: "render-blocking-resources",
      title: "Eliminar recursos que bloqueiam a renderização",
      savingsMs: 450,
    });
  });
});

test.describe("Métricas de Performance - isValidRun", () => {
  test("deve validar execução bem-sucedida com SKU presente na URL", () => {
    const result = isValidRun(sampleLhr, "NATBRA-108403");
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  test("deve invalidar quando existir runtimeError", () => {
    const errorLhr: Lhr = {
      ...sampleLhr,
      runtimeError: {
        code: "NO_FCP",
        message: "A página não renderizou nenhum conteúdo",
      },
    };
    const result = isValidRun(errorLhr, "NATBRA-108403");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("A página não renderizou nenhum conteúdo");
  });

  test("deve invalidar quando score de performance for nulo ou indefinido", () => {
    const noScoreLhr: Lhr = {
      ...sampleLhr,
      categories: {
        performance: { score: null },
      },
    };
    const result = isValidRun(noScoreLhr, "NATBRA-108403");
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Score de performance ausente ou nulo");
  });

  test("deve invalidar quando URL final exibida não contiver o SKU (ex: redirecionamento)", () => {
    const result = isValidRun(sampleLhr, "NATBRA-70983");
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("URL final exibida não contém o SKU NATBRA-70983");
  });
});

test.describe("Métricas de Performance - pickMedianIndex", () => {
  test("deve retornar o índice da mediana em array ímpar", () => {
    expect(pickMedianIndex([40, 90, 70])).toBe(2);
  });

  test("deve retornar o elemento de baixo (n/2 - 1) em array de tamanho par", () => {
    expect(pickMedianIndex([50, 60])).toBe(0);
  });
});
