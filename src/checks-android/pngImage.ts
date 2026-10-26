import { inflateSync } from "node:zlib";

/** Decoded 8-bit RGB/RGBA pixels, row-major. */
export interface DecodedPng {
  width: number;
  height: number;
  /** 3 (RGB) or 4 (RGBA). */
  channels: number;
  data: Buffer;
}

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/**
 * Minimal PNG decoder for Appium screenshots (8-bit RGB/RGBA, not interlaced), so the Android
 * checks can look at pixels without an image library. Throws on any other format.
 */
export function decodePng(png: Buffer): DecodedPng {
  if (!png.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("não é um PNG");
  }
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat: Buffer[] = [];
  for (let pos = 8; pos + 8 <= png.length;) {
    const length = png.readUInt32BE(pos);
    const type = png.toString("ascii", pos + 4, pos + 8);
    const chunk = png.subarray(pos + 8, pos + 8 + length);
    if (type === "IHDR") {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      const [bitDepth, colorType, , , interlace] = chunk.subarray(8, 13);
      channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
      if (bitDepth !== 8 || channels === 0 || interlace !== 0) {
        throw new Error(
          `PNG não suportado (bitDepth=${bitDepth}, colorType=${colorType}, interlace=${interlace})`,
        );
      }
    } else if (type === "IDAT") {
      idat.push(chunk);
    } else if (type === "IEND") {
      break;
    }
    pos += 12 + length;
  }
  if (!width || !height) {
    throw new Error("PNG sem IHDR");
  }

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const data = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? data[out + x - channels] : 0;
      const b = y > 0 ? data[out - stride + x] : 0;
      const c = x >= channels && y > 0 ? data[out - stride + x - channels] : 0;
      const predictor =
        filter === 1
          ? a
          : filter === 2
            ? b
            : filter === 3
              ? (a + b) >> 1
              : filter === 4
                ? paeth(a, b, c)
                : 0;
      data[out + x] = (line[x] + predictor) & 0xff;
    }
  }
  return { width, height, channels, data };
}

/** A pixel counts as content when any channel differs this much from the background color. */
const CONTENT_CHANNEL_DIFF = 24;
/** Only every Nth pixel in each direction is sampled — plenty for a ~1000px wide image. */
const SAMPLE_STEP = 4;

/**
 * Share (0..1) of the sampled pixels inside `crop` (fractions of the image) that differ from the
 * dominant color. A product photo, even on a white background, scores well above 1%; an image
 * that never loaded leaves the area a flat color and scores ~0.
 */
export function contentRatio(
  img: DecodedPng,
  crop = { left: 0, top: 0, width: 1, height: 1 },
): number {
  const x0 = Math.floor(img.width * crop.left);
  const x1 = Math.floor(img.width * (crop.left + crop.width));
  const y0 = Math.floor(img.height * crop.top);
  const y1 = Math.floor(img.height * (crop.top + crop.height));
  const pixelAt = (x: number, y: number) => {
    const i = (y * img.width + x) * img.channels;
    return [img.data[i], img.data[i + 1], img.data[i + 2]];
  };

  // Dominant color: most frequent 4-bit-per-channel bucket
  const buckets = new Map<number, number>();
  for (let y = y0; y < y1; y += SAMPLE_STEP) {
    for (let x = x0; x < x1; x += SAMPLE_STEP) {
      const [r, g, b] = pixelAt(x, y);
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
  }
  let dominant = 0;
  let best = -1;
  for (const [key, count] of buckets) {
    if (count > best) {
      [dominant, best] = [key, count];
    }
  }
  const background = [
    ((dominant >> 8) << 4) + 8,
    (((dominant >> 4) & 0xf) << 4) + 8,
    ((dominant & 0xf) << 4) + 8,
  ];

  let total = 0;
  let content = 0;
  for (let y = y0; y < y1; y += SAMPLE_STEP) {
    for (let x = x0; x < x1; x += SAMPLE_STEP) {
      total++;
      const px = pixelAt(x, y);
      if (
        px.some((v, i) => Math.abs(v - background[i]) > CONTENT_CHANNEL_DIFF)
      ) {
        content++;
      }
    }
  }
  return total === 0 ? 0 : content / total;
}
