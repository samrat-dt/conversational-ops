import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow importing from outside the web/ directory (../src/)
  experimental: {
    externalDir: true,
  },
  env: {
    // Baked at build time; can be overridden with NEXT_PUBLIC_ vars at runtime
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
  },
};

export default nextConfig;
