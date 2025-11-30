#!/usr/bin/env node

/**
 * Background Log Monitor Service
 * Monitors bot logs for specific patterns and sends Telegram notifications
 * Run: node scripts/log-monitor.js
 */

const WebSocket = require('ws');
const fs = require('fs');
const http = require('http');

// Configuration
const CONFIG = {
  telegram: {
    botToken: '8531358829:AAGw6SbUuiIc24a9FhaCwMtzIe5A3YJW88E',
    chatIds: [
      '7371826522',   // piyawatpm (P M)
      '2139940142',   // oon
    ],
  },
  reconnectInterval: 100, // 100ms - immediate reconnect
  controlPort: 3099, // HTTP control port
  servicesApiUrl: 'http://185.191.118.179:8765/services',
  statusCheckInterval: 5000, // Check service status every 5 seconds
  // Common patterns for service start/stop detection
  servicePatterns: [
    {
      name: 'Service Started',
      match: 'Started',
      matchRegex: /Started\s+(\S+\.service)/,
      emoji: '🟢',
      type: 'regex',
    },
    {
      name: 'Service Stopping',
      match: 'Stopping',
      matchRegex: /Stopping\s+(\S+\.service)/,
      emoji: '🔴',
      type: 'regex',
    },
  ],
  // Services to monitor for logs
  services: [
    {
      name: 'bot',
      wsUrl: 'ws://185.191.118.179:8765/ws/logs/bot',
      patterns: [
        {
          name: 'Warming Connections',
          match: 'Warming connections after evaluation',
          emoji: '🔥',
          type: 'simple',
        },
        {
          name: 'Onsite Trade Execution',
          match: 'UREQ POST to: https://rollbit.com/private/dex/trade',
          emoji: '💰',
          type: 'multiline',
          contextLines: 1,
          contextTimeout: 200,
        },
      ],
    },
    {
      name: 'el',
      wsUrl: 'ws://185.191.118.179:8765/ws/logs/el',
      patterns: [
        {
          name: 'EL Not Syncing',
          match: 'Not receiving ForkChoices from the consensus client',
          emoji: '🚨',
          type: 'simple',
        },
      ],
    },
    {
      name: 'reb',
      wsUrl: 'ws://185.191.118.179:8765/ws/logs/reb',
      patterns: [],
    },
    {
      name: 'balance-reporter',
      wsUrl: 'ws://185.191.118.179:8765/ws/logs/balance-reporter',
      patterns: [],
    },
    {
      name: 'grandine',
      wsUrl: 'ws://185.191.118.179:8765/ws/logs/grandine',
      patterns: [],
    },
    {
      name: 'cl-2',
      wsUrl: 'ws://185.191.118.179:8765/ws/logs/cl-2',
      patterns: [],
    },
    {
      name: 'gateway',
      wsUrl: 'ws://185.191.118.179:8765/ws/logs/gateway',
      patterns: [
        {
          name: 'RaptorQ Decode Failed',
          match: 'RaptorQ DECODE FAILED',
          emoji: '❌',
          type: 'multiline',
          contextLines: 6,
          contextTimeout: 500,
        },
      ],
    },
  ],
};

// Add common service patterns to all services
for (const service of CONFIG.services) {
  service.patterns = [...service.patterns, ...CONFIG.servicePatterns];
}

// Notification enabled state (global and per-pattern)
let notificationsEnabled = true;
const patternEnabled = new Map(); // pattern name -> enabled state

// Initialize pattern states
for (const service of CONFIG.services) {
  for (const pattern of service.patterns) {
    patternEnabled.set(pattern.name, true);
  }
}
// Warming Connections is off by default (test notification)
patternEnabled.set('Warming Connections', false);
// Add service status change pattern
patternEnabled.set('Service Status Change', true);
// Add trade profit/loss pattern (controlled by relay webapp)
patternEnabled.set('Trade Profit/Loss', true);

// Track last known service status and PID
const lastServiceStatus = new Map(); // service name -> 'running' | 'stopped' | etc
const lastServicePid = new Map(); // service name -> pid (to detect restarts)

// Track last notification time to prevent spam
const lastNotified = new Map();
const NOTIFICATION_COOLDOWN = 10000; // 10 seconds cooldown

// Multiline context buffers per service
const contextBuffers = new Map();

// Strip ANSI escape codes
function stripAnsi(str) {
  return str.replace(/\u001b\[[0-9;]*m/g, '');
}

// Parse timestamp from various formats
function parseTimestamp(ts) {
  if (typeof ts === 'string' && /^\d{16}$/.test(ts)) {
    return new Date(parseInt(ts) / 1000);
  }
  if (typeof ts === 'number') {
    if (ts > 1e15) return new Date(ts / 1000);
    if (ts > 1e12) return new Date(ts);
    return new Date(ts * 1000);
  }
  return new Date(ts || Date.now());
}

// Extract timestamp from log line (e.g., "2025-11-27T23:00:24.356838Z")
function extractLogTimestamp(message) {
  const match = message.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z?)/);
  if (match) {
    return new Date(match[1]);
  }
  return null;
}

// Send Telegram notification to all chat IDs
async function sendTelegram(message) {
  const url = `https://api.telegram.org/bot${CONFIG.telegram.botToken}/sendMessage`;

  for (const chatId of CONFIG.telegram.chatIds) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
        }),
      });
      const data = await response.json();
      if (data.ok) {
        console.log(`[Telegram] Sent to ${chatId}: ${message.substring(0, 50)}...`);
      } else {
        console.error(`[Telegram] Failed for ${chatId}:`, data.description);
      }
    } catch (error) {
      console.error(`[Telegram] Error for ${chatId}:`, error.message);
    }
  }
}

// Check if we should notify (cooldown check + enabled check)
function shouldNotify(patternName, uniqueKey = null) {
  // Check global enable
  if (!notificationsEnabled) return false;
  // Check pattern-level enable
  if (!patternEnabled.get(patternName)) return false;

  const key = uniqueKey || patternName;
  const now = Date.now();
  const last = lastNotified.get(key) || 0;
  if (now - last > NOTIFICATION_COOLDOWN) {
    lastNotified.set(key, now);
    return true;
  }
  return false;
}

// Send multiline notification with collected context
function sendMultilineNotification(pattern, triggerLine, contextLines, timestamp) {
  // Handle Onsite Trade Execution
  if (pattern.name === 'Onsite Trade Execution') {
    // Parse payload from context line: Payload: {"coin":"RLB","quantity":40001.0,"slippage":0.015}
    let coin = 'RLB';
    let quantity = 0;
    let slippage = 0;

    for (const line of contextLines) {
      if (line.includes('Payload:')) {
        try {
          const jsonMatch = line.match(/Payload:\s*(\{.+\})/);
          if (jsonMatch) {
            const payload = JSON.parse(jsonMatch[1]);
            coin = payload.coin || 'RLB';
            quantity = payload.quantity || 0;
            slippage = payload.slippage || 0;
          }
        } catch (e) {
          console.error('[Trade] Failed to parse payload:', e.message);
        }
      }
    }

    // Determine Buy/Sell based on quantity sign
    const isBuy = quantity >= 0;
    const action = isBuy ? '🟢 BUY' : '🔴 SELL';
    const absQuantity = Math.abs(quantity);

    // Use quantity as unique key
    const uniqueKey = `${pattern.name}-${Date.now()}`;
    if (!shouldNotify(pattern.name, uniqueKey)) return;

    const notification =
      `💰 <b>Onsite Trade Execution</b>\n\n` +
      `${action} <code>${coin}</code>\n` +
      `📊 Quantity: <code>${absQuantity.toLocaleString()}</code>\n` +
      `📉 Slippage: <code>${(slippage * 100).toFixed(1)}%</code>\n` +
      `⏰ ${timestamp.toLocaleString()}`;

    sendTelegram(notification);
    return;
  }

  // Handle RaptorQ Decode Failed
  // Parse block number and relay from trigger line
  // Example: "❌ RaptorQ DECODE FAILED for block 13121700 [relay: FAK-HETZ-04]"
  const blockMatch = triggerLine.match(/block\s+(\d+)/i);
  const relayMatch = triggerLine.match(/\[relay:\s*([^\]]+)\]/i);

  const blockNum = blockMatch ? blockMatch[1] : 'Unknown';
  const relayName = relayMatch ? relayMatch[1] : 'Unknown';

  // Use block+relay as unique key to prevent duplicate notifications for same error
  const uniqueKey = `${pattern.name}-${blockNum}-${relayName}`;
  if (!shouldNotify(pattern.name, uniqueKey)) return;

  // Build details from context lines
  let details = '';
  for (const line of contextLines) {
    // Skip separator lines
    if (line.includes('════')) continue;
    // Extract meaningful info
    if (line.includes('Packets received')) {
      const match = line.match(/Packets received:\s*([^\n]+)/);
      if (match) details += `📊 Packets: ${match[1]}\n`;
    } else if (line.includes('Original size')) {
      const match = line.match(/Original size expected:\s*([^\n]+)/);
      if (match) details += `💾 Size: ${match[1]}\n`;
    } else if (line.includes('Error:')) {
      const match = line.match(/Error:\s*([^\n]+)/);
      if (match) details += `⚠️ ${match[1]}\n`;
    }
  }

  const notification =
    `${pattern.emoji} <b>${pattern.name}</b>\n\n` +
    `🔢 Block: <code>${blockNum}</code>\n` +
    `📡 Relay: <code>${relayName}</code>\n` +
    `⏰ ${timestamp.toLocaleString()}\n\n` +
    (details || '');

  sendTelegram(notification);
}

// Process log message for a specific service
function createLogProcessor(serviceConfig) {
  return function processLog(data) {
    try {
      const rawMessage = data.message || data.line || '';
      const cleanMessage = stripAnsi(rawMessage);
      const timestamp = extractLogTimestamp(cleanMessage) || parseTimestamp(data.timestamp);

      // Check for active multiline context collection
      const bufferKey = serviceConfig.name;
      const buffer = contextBuffers.get(bufferKey);

      if (buffer) {
        // We're collecting context lines
        buffer.lines.push(cleanMessage);
        buffer.count++;

        // Check if we've collected enough or hit a terminator
        if (buffer.count >= buffer.pattern.contextLines || cleanMessage.includes('════')) {
          // Send the notification
          clearTimeout(buffer.timeout);
          sendMultilineNotification(buffer.pattern, buffer.triggerLine, buffer.lines, buffer.timestamp);
          contextBuffers.delete(bufferKey);
        }
        return;
      }

      // Check each pattern
      for (const pattern of serviceConfig.patterns) {
        if (cleanMessage.includes(pattern.match)) {
          if (pattern.type === 'multiline') {
            // Start collecting context
            const timeoutId = setTimeout(() => {
              const buf = contextBuffers.get(bufferKey);
              if (buf) {
                sendMultilineNotification(buf.pattern, buf.triggerLine, buf.lines, buf.timestamp);
                contextBuffers.delete(bufferKey);
              }
            }, pattern.contextTimeout);

            contextBuffers.set(bufferKey, {
              pattern,
              triggerLine: cleanMessage,
              lines: [],
              count: 0,
              timestamp,
              timeout: timeoutId,
            });
          } else if (pattern.type === 'regex' && pattern.matchRegex) {
            // Regex pattern - extract info from match
            const regexMatch = cleanMessage.match(pattern.matchRegex);
            if (regexMatch) {
              const serviceName = regexMatch[1] || 'unknown';

              // Use service name as unique key to prevent spam
              const uniqueKey = `${pattern.name}-${serviceName}`;
              if (shouldNotify(pattern.name, uniqueKey)) {
                const notification =
                  `${pattern.emoji} <b>${pattern.name}</b>\n\n` +
                  `📦 Service: <code>${serviceName}</code>\n` +
                  `⏰ ${timestamp.toLocaleString()}`;
                sendTelegram(notification);
              }
            }
          } else {
            // Simple pattern
            if (shouldNotify(pattern.name)) {
              const notification =
                `${pattern.emoji} <b>${pattern.name}</b>\n\n` +
                `⏰ ${timestamp.toLocaleString()}\n` +
                `📝 ${cleanMessage.substring(0, 200)}`;
              sendTelegram(notification);
            }
          }
        }
      }
    } catch (error) {
      console.error(`[Process:${serviceConfig.name}] Error:`, error.message);
    }
  };
}

// Connect to WebSocket for a service
function connectService(serviceConfig) {
  console.log(`[${serviceConfig.name}] Connecting to ${serviceConfig.wsUrl}...`);

  const ws = new WebSocket(serviceConfig.wsUrl);
  const processLog = createLogProcessor(serviceConfig);

  ws.on('open', () => {
    console.log(`[${serviceConfig.name}] Connected! Patterns:`, serviceConfig.patterns.map(p => p.name).join(', '));
  });

  ws.on('message', (data) => {
    try {
      const parsed = JSON.parse(data.toString());
      processLog(parsed);
    } catch {
      processLog({ message: data.toString(), timestamp: Date.now() });
    }
  });

  ws.on('close', () => {
    console.log(`[${serviceConfig.name}] Disconnected. Reconnecting in ${CONFIG.reconnectInterval / 1000}s...`);
    setTimeout(() => connectService(serviceConfig), CONFIG.reconnectInterval);
  });

  ws.on('error', (error) => {
    console.error(`[${serviceConfig.name}] WebSocket error:`, error.message);
  });
}

// Connect to all services
function connectAll() {
  for (const service of CONFIG.services) {
    connectService(service);
  }
}

// Map raw API status to simple status
function mapServiceStatus(raw) {
  if (raw.active || raw.status?.includes('running')) return 'running';
  if (raw.status?.includes('failed') || raw.status?.includes('error')) return 'failed';
  if (raw.status?.includes('stopped') || raw.status?.includes('inactive') || raw.status?.includes('dead')) return 'stopped';
  return 'unknown';
}

// Check all services status
async function checkServicesStatus() {
  try {
    const response = await fetch(CONFIG.servicesApiUrl);
    if (!response.ok) return;

    const services = await response.json();

    for (const service of services) {
      const currentStatus = mapServiceStatus(service);
      const currentPid = service.pid;
      const lastStatus = lastServiceStatus.get(service.name);
      const lastPid = lastServicePid.get(service.name);

      // First run - just record status and PID, don't notify
      if (lastStatus === undefined) {
        lastServiceStatus.set(service.name, currentStatus);
        lastServicePid.set(service.name, currentPid);
        continue;
      }

      // Check for restart (PID changed while still running)
      if (currentStatus === 'running' && lastStatus === 'running' &&
          currentPid && lastPid && currentPid !== lastPid) {
        lastServicePid.set(service.name, currentPid);

        if (notificationsEnabled && patternEnabled.get('Service Status Change')) {
          const notification =
            `🔄 <b>Service RESTARTED</b>\n\n` +
            `📦 Service: <code>${service.name}</code>\n` +
            `🔢 PID: ${lastPid} → ${currentPid}\n` +
            `⏰ ${new Date().toLocaleString()}`;

          sendTelegram(notification);
          console.log(`[Status] ${service.name}: RESTARTED (PID ${lastPid} -> ${currentPid})`);
        }
        continue;
      }

      // Status changed
      if (lastStatus !== currentStatus) {
        lastServiceStatus.set(service.name, currentStatus);
        lastServicePid.set(service.name, currentPid);

        // Check if we should notify
        if (notificationsEnabled && patternEnabled.get('Service Status Change')) {
          const isUp = currentStatus === 'running';
          const emoji = isUp ? '🟢' : '🔴';
          const statusText = isUp ? 'ONLINE' : 'OFFLINE';

          const notification =
            `${emoji} <b>Service ${statusText}</b>\n\n` +
            `📦 Service: <code>${service.name}</code>\n` +
            `📊 Status: ${currentStatus}\n` +
            (currentPid ? `🔢 PID: ${currentPid}\n` : '') +
            `⏰ ${new Date().toLocaleString()}`;

          sendTelegram(notification);
          console.log(`[Status] ${service.name}: ${lastStatus} -> ${currentStatus}`);
        }
      } else {
        // Update PID if changed (for next check)
        lastServicePid.set(service.name, currentPid);
      }
    }
  } catch (error) {
    console.error('[Status] Error checking services:', error.message);
  }
}

// Start service status monitoring
function startStatusMonitoring() {
  // Initial check
  checkServicesStatus();
  // Periodic check
  setInterval(checkServicesStatus, CONFIG.statusCheckInterval);
  console.log(`[Status] Monitoring all services every ${CONFIG.statusCheckInterval / 1000}s`);
}

// Startup
console.log('='.repeat(50));
console.log('Log Monitor Service');
console.log('='.repeat(50));
console.log(`Telegram Chat IDs: ${CONFIG.telegram.chatIds.join(', ')}`);
console.log(`Monitoring services:`);
for (const service of CONFIG.services) {
  console.log(`  - ${service.name}: ${service.patterns.map(p => p.name).join(', ')}`);
}
console.log('='.repeat(50));

// Send startup notification
const patternList = CONFIG.services
  .flatMap(s => s.patterns.map(p => `• ${s.name}: ${p.name}`))
  .join('\n');
sendTelegram(`🟢 <b>Log Monitor Started</b>\n\nMonitoring:\n${patternList}\n• Service Status Changes`);

// Start connections
connectAll();

// Start service status monitoring
startStatusMonitoring();

// HTTP Control Server
const controlServer = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = req.url;

  // GET /status - Get current status with all patterns
  if (req.method === 'GET' && url === '/status') {
    const patterns = [];
    for (const service of CONFIG.services) {
      for (const pattern of service.patterns) {
        patterns.push({
          name: pattern.name,
          service: service.name,
          enabled: patternEnabled.get(pattern.name),
          emoji: pattern.emoji,
        });
      }
    }
    // Add service status change pattern
    patterns.push({
      name: 'Service Status Change',
      service: 'all',
      enabled: patternEnabled.get('Service Status Change'),
      emoji: '🔄',
    });
    // Add trade profit/loss pattern
    patterns.push({
      name: 'Trade Profit/Loss',
      service: 'trades',
      enabled: patternEnabled.get('Trade Profit/Loss'),
      emoji: '💰',
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      enabled: notificationsEnabled,
      patterns,
    }));
    return;
  }

  // POST /enable - Enable all notifications
  if (req.method === 'POST' && url === '/enable') {
    notificationsEnabled = true;
    console.log('[Control] Notifications ENABLED');
    sendTelegram('🟢 <b>Notifications Enabled</b>');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ enabled: true, message: 'Notifications enabled' }));
    return;
  }

  // POST /disable - Disable all notifications
  if (req.method === 'POST' && url === '/disable') {
    notificationsEnabled = false;
    console.log('[Control] Notifications DISABLED');
    sendTelegram('🔴 <b>Notifications Disabled</b>');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ enabled: false, message: 'Notifications disabled' }));
    return;
  }

  // POST /toggle - Toggle all notifications
  if (req.method === 'POST' && url === '/toggle') {
    notificationsEnabled = !notificationsEnabled;
    console.log(`[Control] Notifications ${notificationsEnabled ? 'ENABLED' : 'DISABLED'}`);
    sendTelegram(notificationsEnabled ? '🟢 <b>Notifications Enabled</b>' : '🔴 <b>Notifications Disabled</b>');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ enabled: notificationsEnabled }));
    return;
  }

  // POST /pattern/toggle/:name - Toggle specific pattern
  const patternToggleMatch = url.match(/^\/pattern\/toggle\/(.+)$/);
  if (req.method === 'POST' && patternToggleMatch) {
    const patternName = decodeURIComponent(patternToggleMatch[1]);
    if (patternEnabled.has(patternName)) {
      const newState = !patternEnabled.get(patternName);
      patternEnabled.set(patternName, newState);
      console.log(`[Control] Pattern "${patternName}" ${newState ? 'ENABLED' : 'DISABLED'}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ pattern: patternName, enabled: newState }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Pattern not found' }));
    }
    return;
  }

  // POST /pattern/enable/:name - Enable specific pattern
  const patternEnableMatch = url.match(/^\/pattern\/enable\/(.+)$/);
  if (req.method === 'POST' && patternEnableMatch) {
    const patternName = decodeURIComponent(patternEnableMatch[1]);
    if (patternEnabled.has(patternName)) {
      patternEnabled.set(patternName, true);
      console.log(`[Control] Pattern "${patternName}" ENABLED`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ pattern: patternName, enabled: true }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Pattern not found' }));
    }
    return;
  }

  // POST /pattern/disable/:name - Disable specific pattern
  const patternDisableMatch = url.match(/^\/pattern\/disable\/(.+)$/);
  if (req.method === 'POST' && patternDisableMatch) {
    const patternName = decodeURIComponent(patternDisableMatch[1]);
    if (patternEnabled.has(patternName)) {
      patternEnabled.set(patternName, false);
      console.log(`[Control] Pattern "${patternName}" DISABLED`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ pattern: patternName, enabled: false }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Pattern not found' }));
    }
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

controlServer.listen(CONFIG.controlPort, '0.0.0.0', () => {
  console.log(`[Control] HTTP server listening on port ${CONFIG.controlPort}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Monitor] Shutting down...');
  sendTelegram('🔴 <b>Log Monitor Stopped</b>');
  setTimeout(() => process.exit(0), 1000);
});

process.on('SIGTERM', () => {
  console.log('\n[Monitor] Shutting down...');
  sendTelegram('🔴 <b>Log Monitor Stopped</b>');
  setTimeout(() => process.exit(0), 1000);
});
