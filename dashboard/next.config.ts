import path from 'node:path';
import type { NextConfig } from 'next';

const isStaticExport = process.env.STATIC_EXPORT === 'true';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const nextConfig: NextConfig = {
  ...(isStaticExport && { output: 'export', trailingSlash: true }),
  ...(basePath && { basePath, assetPrefix: basePath }),
  // O repo tem lockfile na raiz e no dashboard; sem isso o Next infere a raiz errada.
  outputFileTracingRoot: path.resolve(__dirname),
  eslint: {
    // Lint roda via `npm run lint` (eslint.config.mjs do dashboard); não repetimos no build.
    ignoreDuringBuilds: true,
  },
  // Sem loader global nem `unoptimized` global: o export estático não tem o otimizador do Next,
  // então cada <Image> passa `loader` (imagens do SFCC, ver src/lib/image-loader.ts) ou
  // `unoptimized`. `images.unoptimized: true` aqui anularia o loader; `loader: 'custom'` com
  // `loaderFile` não é aplicado pelo `next dev --turbopack` do Next 15 e quebra as demais imagens.
  // Um <Image> sem nenhum dos dois falha no `build:static`, de propósito.
};

export default nextConfig;
