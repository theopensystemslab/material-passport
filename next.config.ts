import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // enable strict mode to encourage best practices
  reactStrictMode: true,
  experimental: {
    // any turbopack bundler config goes here
    turbo: {}
  }
};

export default nextConfig;
