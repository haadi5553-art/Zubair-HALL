import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NOTE: no custom output mode - `next start` serves the production build
  // directly, which keeps deployment on a local PC simple.
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
