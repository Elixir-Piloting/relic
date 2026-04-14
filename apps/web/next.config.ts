import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // For Electron, we may want to output standalone
  output: process.env.ELECTRON_BUILD === "true" ? "standalone" : undefined,
};

export default nextConfig;
