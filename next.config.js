/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    outputFileTracingIncludes: {
      '/api/**/*': ['./node_modules/**/*.js'],
    },
  },
  // Disable standalone mode when using custom server
  // output: undefined,
};

module.exports = nextConfig;