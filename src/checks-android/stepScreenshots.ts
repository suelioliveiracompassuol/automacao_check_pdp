import * as fs from "node:fs";
import * as path from "node:path";
import { StepScreenshot } from "../types.js";
import { toSafeFileName } from "../utils.js";

/**
 * Step-by-step screenshots of an Android PDP check (deep link → each checker), so a failure
 * shows the whole path instead of only the final screen.
 *
 * Captures are kept in memory and written only when the SKU failed (docs/reports is committed
 * by CI). Files: screenshots/<SKU>/NN-<slug>.png.
 */
export class StepScreenshotRecorder {
  private readonly captures: { label: string; base64: string }[] = [];

  constructor(private readonly driver: WebdriverIO.Browser) {}

  /** Best effort: a failed capture never fails the check. */
  async capture(label: string): Promise<void> {
    try {
      this.captures.push({ label, base64: await this.driver.takeScreenshot() });
    } catch (e) {
      console.log(
        `   ⚠️  Falha ao capturar screenshot da etapa "${label}": ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  /** Writes the captures under outputDir and returns them in order (paths relative to outputDir). */
  save(outputDir: string, sku: string): StepScreenshot[] {
    if (this.captures.length === 0) {
      return [];
    }
    const dir = path.join(outputDir, "screenshots", toSafeFileName(sku));
    fs.mkdirSync(dir, { recursive: true });
    return this.captures.map(({ label, base64 }, i) => {
      const slug = label
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const filePath = path.join(
        dir,
        `${String(i + 1).padStart(2, "0")}-${slug}.png`,
      );
      fs.writeFileSync(filePath, Buffer.from(base64, "base64"));
      return {
        label,
        path: path.relative(outputDir, filePath).split(path.sep).join("/"),
      };
    });
  }
}
