import type { ImageLoaderProps } from 'next/image';

/**
 * Loader do next/image para imagens do catálogo SFCC, passado no `loader` de cada <Image>
 * (só funciona em client component). O export estático não tem o otimizador do Next, então o
 * redimensionamento fica com o Dynamic Imaging Service da própria loja
 * (`/dw/image/v2/<org>/…?sw=<largura>`), o mesmo que a PDP usa: uma miniatura de 48 px cai
 * de ~70 KB (original) para ~2 KB. Outras imagens voltam como estão; nelas use `unoptimized`.
 */

/** Organização do SFCC no caminho do DIS (é o que a loja usa nas URLs /dw/image/v2/…). */
const SFCC_DIS_ORG = 'BFKR_PRD';
const SFCC_STATIC_PATH = '/on/demandware.static/';

export function sfccImageUrl(src: string, width: number, quality?: number): string | null {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return null;
  }
  if (!url.pathname.startsWith(SFCC_STATIC_PATH)) {
    return null;
  }
  url.pathname = `/dw/image/v2/${SFCC_DIS_ORG}${url.pathname}`;
  url.searchParams.set('sw', String(width));
  url.searchParams.set('q', String(quality ?? 75));
  return url.toString();
}

export default function imageLoader({ src, width, quality }: ImageLoaderProps): string {
  return sfccImageUrl(src, width, quality) ?? src;
}
