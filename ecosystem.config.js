/**
 * PM2 Ecosystem Configuration
 *
 * Usage:
 *   pm2 start ecosystem.config.js                    # Start all services
 *   pm2 start ecosystem.config.js --only trade-processor  # Start specific service
 *   pm2 stop all                                     # Stop all services
 *   pm2 logs trade-processor                         # View logs
 *   pm2 monit                                        # Monitor all services
 */

module.exports = {
  apps: [
    {
      name: 'trade-processor',
      script: './node_modules/.bin/tsx',
      args: 'scripts/trade-processor.ts',
      cwd: '/root/Desktop/ranking-relay',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        NEXT_PUBLIC_API_URL: 'http://localhost:3000',
      },
      // Restart settings
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s',
      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/root/Desktop/ranking-relay/logs/trade-processor-error.log',
      out_file: '/root/Desktop/ranking-relay/logs/trade-processor-out.log',
      merge_logs: true,
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 3000,
    },
    // Add more background services here as needed
    // {
    //   name: 'another-service',
    //   script: 'npx',
    //   args: 'tsx scripts/another-service.ts',
    //   ...
    // },
  ],
};
