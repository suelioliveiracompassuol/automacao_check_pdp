/**
 * Captura as respostas do Firebase Remote Config usando Playwright
 */

import { chromium } from "@playwright/test";

const url =
  process.argv[2] ||
  "https://www.naturacosmeticos.com.ar/p/homem-potence-edp-100-ml/NATARG-81950";

interface RemoteConfigResponse {
  url: string;
  status: number;
  requestBody: unknown;
  responseBody: unknown;
  timestamp: string;
}

async function captureRemoteConfig() {
  console.log(`\n🔍 Capturando Firebase Remote Config de: ${url}\n`);

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-http2", // Contorna erro HTTP2_PROTOCOL_ERROR
      "--no-sandbox",
      "--disable-setuid-sandbox",
    ],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  const remoteConfigResponses: RemoteConfigResponse[] = [];

  // Interceptar todas as requisições de rede
  page.on("request", async (request) => {
    const reqUrl = request.url();
    if (
      reqUrl.includes("firebaseremoteconfig") ||
      reqUrl.includes("remoteconfig")
    ) {
      console.log(`📤 Request: ${request.method()} ${reqUrl}`);
      try {
        const postData = request.postData();
        if (postData) {
          console.log("   Body:", JSON.parse(postData));
        }
      } catch {
        // Body não é JSON
      }
    }
  });

  // Interceptar todas as respostas
  page.on("response", async (response) => {
    const respUrl = response.url();

    // Filtrar apenas requisições do Firebase Remote Config
    if (
      respUrl.includes("firebaseremoteconfig") ||
      respUrl.includes("remoteconfig")
    ) {
      console.log(`\n📥 Response: ${response.status()} ${respUrl}`);

      try {
        const body = await response.json();

        remoteConfigResponses.push({
          url: respUrl,
          status: response.status(),
          requestBody: null, // Capturado separadamente
          responseBody: body,
          timestamp: new Date().toISOString(),
        });

        console.log("\n📋 Remote Config Response:");
        console.log(JSON.stringify(body, null, 2));

        // Mostrar flags específicas se existirem
        if (body.entries) {
          console.log("\n🏷️  Feature Flags encontradas:");
          Object.entries(body.entries).forEach(([key, value]) => {
            console.log(`   ${key}: ${JSON.stringify(value)}`);
          });
        }
      } catch {
        console.log("   (resposta não é JSON)");
      }
    }
  });

  try {
    await page.goto(url, {
      timeout: 60000,
      waitUntil: "domcontentloaded", // Menos restritivo que networkidle
    });

    console.log("\n✓ Página carregada");

    // Aguardar mais tempo para capturar requisições do Remote Config
    await page.waitForTimeout(8000);

    console.log(
      `\n📊 Total de respostas Remote Config capturadas: ${remoteConfigResponses.length}`,
    );

    // Salvar em arquivo se houver respostas
    if (remoteConfigResponses.length > 0) {
      const fs = await import("fs");
      const outputPath = `./reports/remote-config-${Date.now()}.json`;
      fs.writeFileSync(
        outputPath,
        JSON.stringify(remoteConfigResponses, null, 2),
      );
      console.log(`\n💾 Salvo em: ${outputPath}`);
    }
  } catch (error) {
    console.error("Erro:", error);
  } finally {
    await browser.close();
  }
}

captureRemoteConfig();
