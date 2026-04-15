import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.ELECTRON_BUILD === "true" ? "standalone" : undefined,
  devIndicators: false,
  productionBrowserSourceMaps: false,
};

export default nextConfig;
