/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,
  // Moved from experimental in Next.js 16
  outputFileTracingIncludes: {
    '/api/**/*': ['./node_modules/**/*.js'],
  },
};

module.exports = nextConfig;