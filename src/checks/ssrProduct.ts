/**
 * The PDP's own product data (/pages/v2/product/:productId) as the site rendered it on the
 * server. The natura/avon sites call the product API on the server, so the browser never sees
 * that request; the response is baked into the HTML: React Server Components payload
 * (`self.__next_f.push([1,"..."])` chunks) on App Router pages, `__NEXT_DATA__` on older ones.
 */

type Json = Record<string, unknown>;

/** Concatenated RSC payload of an App Router page ("" when there is none). */
export function extractRscPayload(html: string): string {
  let payload = "";
  for (const m of html.matchAll(
    /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g,
  )) {
    try {
      payload += JSON.parse(m[1]) as string;
    } catch {
      // malformed chunk: skip it
    }
  }
  return payload;
}

/**
 * JSON rows of an RSC payload. Rows are `<id>:<json>\n`, except text rows
 * `<id>:T<hex byte length>,<text>`, whose text may contain newlines and is skipped by length
 * (in UTF-8 bytes). Rows that aren't JSON (module refs, hints) are left out.
 */
export function parseRscRows(payload: string): unknown[] {
  const buf = Buffer.from(payload, "utf-8");
  const rows: unknown[] = [];
  let i = 0;
  while (i < buf.length) {
    const colon = buf.indexOf(0x3a /* : */, i);
    if (colon < 0) {
      break;
    }
    if (buf[colon + 1] === 0x54 /* T */) {
      const comma = buf.indexOf(0x2c /* , */, colon);
      const len = parseInt(buf.subarray(colon + 2, comma).toString(), 16);
      if (comma < 0 || Number.isNaN(len)) {
        break;
      }
      i = comma + 1 + len;
      continue;
    }
    let nl = buf.indexOf(0x0a /* \n */, colon);
    if (nl < 0) {
      nl = buf.length;
    }
    try {
      rows.push(JSON.parse(buf.subarray(colon + 1, nl).toString("utf-8")));
    } catch {
      // not a JSON row
    }
    i = nl + 1;
  }
  return rows;
}

function sameSku(a: string, b: string): boolean {
  return a.trim().toUpperCase() === b.trim().toUpperCase();
}

function collectProducts(value: unknown, sku: string, out: Json[], depth = 0): void {
  if (!value || typeof value !== "object" || depth > 80) {
    return;
  }
  const obj = value as Json;
  if (typeof obj.productId === "string" && sameSku(obj.productId, sku)) {
    out.push(obj);
  }
  for (const child of Object.values(obj)) {
    collectProducts(child, sku, out, depth + 1);
  }
}

/**
 * The product object of `sku` in the page's SSR data. The same productId also shows up in
 * smaller objects (its own entry in `variations`, analytics), so the one with the most fields
 * — the full product API response — wins.
 */
export function findSsrProduct(html: string, sku: string): Json | undefined {
  const roots: unknown[] = parseRscRows(extractRscPayload(html));
  const nextData = /<script id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (nextData) {
    try {
      roots.push(JSON.parse(nextData[1]));
    } catch {
      // malformed __NEXT_DATA__
    }
  }
  const products: Json[] = [];
  for (const root of roots) {
    collectProducts(root, sku, products);
  }
  return products.sort((a, b) => Object.keys(b).length - Object.keys(a).length)[0];
}

/** `rating` of the product API response baked into the page (what the PDP header shows). */
export function findSsrProductRating(html: string, sku: string): number | undefined {
  const rating = findSsrProduct(html, sku)?.rating;
  return typeof rating === "number" && Number.isFinite(rating) ? rating : undefined;
}
