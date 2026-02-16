/**
 * Relay Collector Service Entry Point
 *
 * This service runs as a separate container and:
 * 1. Polls relay nodes every 10 seconds
 * 2. Stores data in the database
 * 3. Broadcasts updates via Socket.IO
 */

import { RelayCollector } from './collector';

// Configuration from environment
const SOCKET_URL = process.env.SOCKET_URL || 'http://localhost:3001';

async function main(): Promise<void> {
  console.log('======================================');
  console.log('  Relay Collector Service Starting');
  console.log('======================================');
  console.log(`Socket URL: ${SOCKET_URL}`);
  console.log(`Database: ${process.env.DATABASE_URL ? 'configured' : 'not configured'}`);

  const collector = new RelayCollector(SOCKET_URL);

  // Handle graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n[Main] Received ${signal}, shutting down...`);
    await collector.stop();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('[Main] Uncaught exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[Main] Unhandled rejection:', reason);
    process.exit(1);
  });

  // Start the collector
  try {
    await collector.start();
    console.log('[Main] Relay collector service is running');
  } catch (error) {
    console.error('[Main] Failed to start collector:', error);
    process.exit(1);
  }
}

main();
