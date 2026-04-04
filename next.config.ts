import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // File reads from wiki path happen server-side only
  serverExternalPackages: ['gray-matter'],
};

export default nextConfig;
