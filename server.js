const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Create HTTP server
  const httpServer = createServer();
  
  // Initialize Socket.io FIRST - before setting up request handler
  // Socket.IO attaches its engine to the server
  const { initializeSocketIO } = require('./lib/socket/server');
  const io = initializeSocketIO(httpServer);
  
  // Now set up the request handler - Socket.IO engine will intercept /api/socket.io requests
  httpServer.on('request', async (req, res) => {
    // Socket.IO engine handles /api/socket.io requests automatically
    // We only handle non-Socket.IO requests here
    if (req.url && req.url.startsWith('/api/socket.io')) {
      // Socket.IO engine should have handled this, but if it didn't, 
      // we need to let it process. Actually, Socket.IO engine processes
      // requests via its own listeners, so we shouldn't reach here.
      // But if we do, it means Socket.IO didn't handle it, so we skip.
      return;
    }
    
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Handle upgrade requests for WebSocket
  httpServer.on('upgrade', (request, socket, head) => {
    if (request.url && request.url.startsWith('/api/socket.io')) {
      io.engine.handleUpgrade(request, socket, head);
    } else {
      socket.destroy();
    }
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.IO server initialized on /api/socket.io`);

    // Start price refresh service to actively update prices every minute
    try {
      console.log('[Server] Loading price refresh service...');
      const { startPriceRefreshService } = require('./lib/services/price-refresh-service.js');
      startPriceRefreshService();
    } catch (err) {
      console.error('[Server] ERROR loading price refresh service:', err);
    }

    // Start price backfill service to ensure RLB prices are always up-to-date
    // This runs every 5 minutes as a safety net for any snapshots without prices
    try {
      console.log('[Server] Loading price backfill service...');
      const { startPriceBackfillService } = require('./lib/services/price-backfill-service.js');
      startPriceBackfillService();
    } catch (err) {
      console.error('[Server] ERROR loading price backfill service:', err);
    }
  });
});
