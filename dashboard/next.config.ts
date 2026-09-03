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
    // Lint roda via script próprio; no build o Next resolveria o eslint.config.mjs da raiz.
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
