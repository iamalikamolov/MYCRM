import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Lets the dev server also be opened at 127.0.0.1 (a separate browser storage from localhost).
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
