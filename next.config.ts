import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ['postgres', 'drizzle-orm'],
};

export default nextConfig;
