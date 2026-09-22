/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.BACKEND_INTERNAL_URL
          ? `${process.env.BACKEND_INTERNAL_URL}/api/:path*`
          : 'http://localhost:3001/api/:path*',
      },
      {
        source: '/health',
        destination: process.env.BACKEND_INTERNAL_URL
          ? `${process.env.BACKEND_INTERNAL_URL}/health`
          : 'http://localhost:3001/health',
      },
    ];
  },
};

module.exports = nextConfig;
