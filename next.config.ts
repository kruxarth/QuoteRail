import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ['postgres', 'drizzle-orm'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [{ key: 'Origin-Agent-Cluster', value: '?1' }],
      },
    ];
  },
};

export default nextConfig;
