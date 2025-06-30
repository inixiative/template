import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    cssChunking: true,
  },
  transpilePackages: ['@tailwindcss/postcss'],
};

export default nextConfig;
