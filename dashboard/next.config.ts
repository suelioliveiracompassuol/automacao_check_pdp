import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: process.env.NODE_ENV === "production" ? "/automacao_check_pdp" : "",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
