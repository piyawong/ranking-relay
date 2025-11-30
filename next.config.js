/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,
  experimental: {
    outputFileTracingIncludes: {
      '/api/**/*': ['./node_modules/**/*.js'],
    },
  },
  // Enable hot reload in Docker
  webpackDevMiddleware: (config) => {
    config.watchOptions = {
      poll: 1000,
      aggregateTimeout: 300,
    };
    return config;
  },
};

module.exports = nextConfig;