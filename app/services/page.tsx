'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  RefreshCw,
  Play,
  Square,
  RotateCcw,
  Server,
  Terminal,
  Circle,
  Loader2,
  Bell,
  BellOff,
  Link,
  Unlink,
  Settings,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

const API_BASE = 'http://185.191.118.179:8765';
const MONITOR_API = 'http://148.251.66.154:3099';

interface ServiceRaw {
  name: string;
  status: string;
  active: boolean;
  description?: string;
  pid?: number;
  uptime?: string;
  memory?: string;
  cpu?: string;
}

interface Service {
  name: string;
  status: 'running' | 'stopped' | 'failed' | 'unknown';
  description?: string;
  pid?: number;
  uptime?: string;
  memory?: string;
  cpu?: string;
}

interface LogEntry {
  timestamp: string;
  message: string;
  service?: string;
}

// Map raw API status to our status type
function mapStatus(raw: ServiceRaw): Service['status'] {
  if (raw.active || raw.status?.includes('running')) return 'running';
  if (raw.status?.includes('failed') || raw.status?.includes('error')) return 'failed';
  if (raw.status?.includes('stopped') || raw.status?.includes('inactive') || raw.status?.includes('dead')) return 'stopped';
  return 'unknown';
}

// Fetch all services
async function fetchServices(): Promise<Service[]> {
  const response = await fetch(`${API_BASE}/services`);
  if (!response.ok) throw new Error('Failed to fetch services');
  const data: ServiceRaw[] = await response.json();

  // Map raw API response to our Service interface
  return (data || []).map(raw => ({
    name: raw.name,
    status: mapStatus(raw),
    description: raw.description,
    pid: raw.pid,
    uptime: raw.uptime ? formatUptime(raw.uptime) : undefined,
    memory: raw.memory,
    cpu: raw.cpu,
  }));
}

// Format uptime string
function formatUptime(uptime: string): string {
  // If it's a date string like "Thu 2025-11-27 20:50:02 UTC"
  if (uptime.includes('202')) {
    try {
      const date = new Date(uptime);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const days = Math.floor(hours / 24);
      if (days > 0) return `${days}d ${hours % 24}h`;
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      if (hours > 0) return `${hours}h ${minutes}m`;
      return `${minutes}m`;
    } catch {
      return uptime;
    }
  }
  return uptime;
}

// Service action (start/stop/restart)
async function serviceAction(name: string, action: 'start' | 'stop' | 'restart'): Promise<void> {
  const response = await fetch(`${API_BASE}/services/${name}/${action}`, {
    method: 'POST',
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Failed to ${action} service`);
  }
}

// Status badge component
function StatusBadge({ status }: { status: Service['status'] }) {
  const config = {
    running: {
      bg: 'bg-green-100 border-green-500',
      text: 'text-green-700',
      dot: 'text-green-500',
      label: 'Running'
    },
    stopped: {
      bg: 'bg-red-100 border-red-500',
      text: 'text-red-700',
      dot: 'text-red-500',
      label: 'Stopped'
    },
    failed: {
      bg: 'bg-red-100 border-red-600',
      text: 'text-red-800',
      dot: 'text-red-600',
      label: 'Failed'
    },
    unknown: {
      bg: 'bg-yellow-100 border-yellow-500',
      text: 'text-yellow-700',
      dot: 'text-yellow-500',
      label: 'Unknown'
    },
  };

  const { bg, text, dot, label } = config[status] || config.unknown;

  return (
    <Badge className={cn('flex items-center gap-1.5 px-3 py-1 border-2 font-semibold', bg, text)}>
      <Circle className={cn('h-2.5 w-2.5 fill-current', dot)} />
      <span>{label}</span>
    </Badge>
  );
}

// Strip ANSI escape codes from log messages
function stripAnsi(str: string): string {
  return str.replace(/\u001b\[[0-9;]*m/g, '');
}

// Parse timestamp from various formats
function parseTimestamp(ts: string | number): string {
  // If it's a microsecond timestamp (like from journald)
  if (typeof ts === 'string' && /^\d{16}$/.test(ts)) {
    return new Date(parseInt(ts) / 1000).toISOString();
  }
  // If it's a number timestamp
  if (typeof ts === 'number') {
    // Microseconds
    if (ts > 1e15) return new Date(ts / 1000).toISOString();
    // Milliseconds
    if (ts > 1e12) return new Date(ts).toISOString();
    // Seconds
    return new Date(ts * 1000).toISOString();
  }
  return ts || new Date().toISOString();
}

// Max logs to store per service
const MAX_LOGS = 10000;
const DISPLAY_LOGS = 500; // Show last 500 by default

// Inline mini log viewer for each service card
function MiniLogViewer({
  serviceName,
  syncEnabled,
  syncTimestamp,
  onSyncScroll,
  isSyncMaster,
}: {
  serviceName: string;
  syncEnabled: boolean;
  syncTimestamp: number | null;
  onSyncScroll: (timestamp: number) => void;
  isSyncMaster: boolean; // Only the master (bot) can broadcast sync
}) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const isUserScrolling = useRef(false);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const wsUrl = `ws://185.191.118.179:8765/ws/logs/${serviceName}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const rawMessage = data.message || data.line || event.data;
        const cleanMessage = stripAnsi(rawMessage);
        const timestamp = parseTimestamp(data.timestamp);

        setLogs(prev => [...prev.slice(-MAX_LOGS), {
          timestamp,
          message: cleanMessage,
          service: serviceName,
        }]);
      } catch {
        setLogs(prev => [...prev.slice(-MAX_LOGS), {
          timestamp: new Date().toISOString(),
          message: stripAnsi(event.data),
          service: serviceName,
        }]);
      }
    };

    return () => ws.close();
  }, [serviceName]);

  // Auto-scroll when new logs arrive (only if autoScroll is enabled)
  useEffect(() => {
    if (autoScroll && logContainerRef.current && !isUserScrolling.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Sync to timestamp from master (bot) - only followers respond
  useEffect(() => {
    if (syncEnabled && !isSyncMaster && syncTimestamp && logContainerRef.current && !isUserScrolling.current) {
      const container = logContainerRef.current;
      const logLines = container.querySelectorAll('.log-line');

      // Find the log element closest to the sync timestamp
      let targetElement: Element | null = null;
      let minDiff = Infinity;

      logLines.forEach((el) => {
        const ts = parseInt(el.getAttribute('data-timestamp') || '0');
        const diff = Math.abs(ts - syncTimestamp);
        if (diff < minDiff) {
          minDiff = diff;
          targetElement = el;
        }
      });

      // Scroll to that element
      if (targetElement) {
        const elementTop = (targetElement as HTMLElement).offsetTop;
        container.scrollTop = elementTop;
      }
    }
  }, [syncTimestamp, syncEnabled, isSyncMaster]);

  // Handle scroll events
  const handleScroll = () => {
    if (!logContainerRef.current) return;

    const container = logContainerRef.current;
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;

    // Auto-enable/disable based on scroll position
    if (isAtBottom) {
      setAutoScroll(true);
    } else {
      setAutoScroll(false);
    }

    // Mark as user scrolling
    isUserScrolling.current = true;
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      isUserScrolling.current = false;
    }, 150);

    // Only the master (bot) broadcasts sync timestamp
    if (syncEnabled && isSyncMaster) {
      const logLines = Array.from(container.querySelectorAll('.log-line'));
      const containerTop = container.scrollTop;

      // Find the log line at the top of the visible area
      for (let i = 0; i < logLines.length; i++) {
        const el = logLines[i];
        const elementTop = (el as HTMLElement).offsetTop;
        if (elementTop >= containerTop) {
          const ts = parseInt(el.getAttribute('data-timestamp') || '0');
          if (ts) {
            onSyncScroll(ts);
          }
          break;
        }
      }
    }
  };

  const displayedLogs = showAll ? logs : logs.slice(-DISPLAY_LOGS);
  const hiddenCount = logs.length - DISPLAY_LOGS;

  return (
    <div className="mt-3 bg-gray-900 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Terminal className="h-3 w-3 text-green-400" />
          <span className="text-xs text-gray-300">Logs</span>
          <span className="text-[10px] text-gray-500">({logs.length.toLocaleString()} lines)</span>
        </div>
        <div className="flex items-center gap-3">
          {!showAll && hiddenCount > 0 && (
            <button
              onClick={() => setShowAll(true)}
              className="text-[10px] text-blue-400 hover:text-blue-300"
            >
              Load {hiddenCount.toLocaleString()} more
            </button>
          )}
          {showAll && (
            <button
              onClick={() => setShowAll(false)}
              className="text-[10px] text-blue-400 hover:text-blue-300"
            >
              Show less
            </button>
          )}
          <button
            onClick={() => {
              setAutoScroll(true);
              if (logContainerRef.current) {
                logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
              }
            }}
            className={cn(
              "text-[10px] px-1.5 py-0.5 rounded",
              autoScroll ? "bg-green-600 text-white" : "bg-gray-700 text-gray-400 hover:text-gray-300"
            )}
          >
            Auto
          </button>
          <div className="flex items-center gap-1">
            <Circle className={cn(
              "h-1.5 w-1.5 fill-current",
              isConnected ? "text-green-500" : "text-red-500"
            )} />
            <span className="text-[10px] text-gray-500">
              {isConnected ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>
      </div>
      <div
        ref={logContainerRef}
        onScroll={handleScroll}
        className="h-96 overflow-y-auto p-2 font-mono text-xs leading-relaxed"
      >
        {displayedLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-xs">
            {isConnected ? 'Waiting for logs...' : 'Connecting...'}
          </div>
        ) : (
          displayedLogs.map((log, idx) => (
            <div
              key={idx}
              data-timestamp={new Date(log.timestamp).getTime()}
              className="log-line text-gray-300 py-1 hover:bg-gray-800/50 border-b border-gray-800/30"
            >
              <span className="text-gray-500 whitespace-nowrap">{new Date(log.timestamp).toLocaleTimeString()} </span>
              <span className="break-all whitespace-pre-wrap">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Service card component with inline logs
function ServiceCard({
  service,
  onAction,
  isActionLoading,
  syncEnabled,
  syncTimestamp,
  onSyncScroll,
  isSyncMaster,
}: {
  service: Service;
  onAction: (action: 'start' | 'stop' | 'restart') => void;
  isActionLoading: boolean;
  syncEnabled: boolean;
  syncTimestamp: number | null;
  onSyncScroll: (timestamp: number) => void;
  isSyncMaster: boolean;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Server className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">{service.name}</CardTitle>
          </div>
          <StatusBadge status={service.status} />
        </div>
        {service.description && (
          <CardDescription className="text-xs">{service.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {/* Service info */}
        {(service.uptime || service.memory) && (
          <div className="mb-2 flex gap-4 text-xs text-muted-foreground">
            {service.uptime && <span>Uptime: {service.uptime}</span>}
            {service.memory && <span>Memory: {service.memory}</span>}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAction('start')}
            disabled={isActionLoading || service.status === 'running'}
            className="flex-1 h-7 text-xs"
          >
            {isActionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAction('stop')}
            disabled={isActionLoading || service.status === 'stopped'}
            className="flex-1 h-7 text-xs"
          >
            {isActionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Square className="h-3 w-3" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAction('restart')}
            disabled={isActionLoading}
            className="flex-1 h-7 text-xs"
          >
            {isActionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
          </Button>
        </div>

        {/* Inline logs */}
        <MiniLogViewer
          serviceName={service.name}
          syncEnabled={syncEnabled}
          syncTimestamp={syncTimestamp}
          onSyncScroll={onSyncScroll}
          isSyncMaster={isSyncMaster}
        />
      </CardContent>
    </Card>
  );
}

interface NotificationPattern {
  name: string;
  service: string;
  enabled: boolean;
  emoji: string;
}

export default function ServicesPage() {
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    serviceName: string;
    action: 'start' | 'stop' | 'restart';
  }>({ open: false, serviceName: '', action: 'start' });
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean | null>(null);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [patterns, setPatterns] = useState<NotificationPattern[]>([]);
  const [patternLoading, setPatternLoading] = useState<Record<string, boolean>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [syncTimestamp, setSyncTimestamp] = useState<number | null>(null);

  // Fetch notification status on mount
  const fetchNotificationStatus = async () => {
    try {
      const res = await fetch(`${MONITOR_API}/status`);
      const data = await res.json();
      setNotificationsEnabled(data.enabled);
      setPatterns(data.patterns || []);
    } catch {
      setNotificationsEnabled(null);
    }
  };

  useEffect(() => {
    fetchNotificationStatus();
  }, []);

  // Toggle all notifications
  const toggleNotifications = async () => {
    setNotificationLoading(true);
    try {
      const res = await fetch(`${MONITOR_API}/toggle`, { method: 'POST' });
      const data = await res.json();
      setNotificationsEnabled(data.enabled);
    } catch (error) {
      console.error('Failed to toggle notifications:', error);
    } finally {
      setNotificationLoading(false);
    }
  };

  // Toggle individual pattern
  const togglePattern = async (patternName: string) => {
    setPatternLoading(prev => ({ ...prev, [patternName]: true }));
    try {
      const res = await fetch(`${MONITOR_API}/pattern/toggle/${encodeURIComponent(patternName)}`, { method: 'POST' });
      const data = await res.json();
      setPatterns(prev => prev.map(p =>
        p.name === patternName ? { ...p, enabled: data.enabled } : p
      ));
    } catch (error) {
      console.error('Failed to toggle pattern:', error);
    } finally {
      setPatternLoading(prev => ({ ...prev, [patternName]: false }));
    }
  };

  // Fetch services
  const { data: services, isLoading, refetch } = useQuery({
    queryKey: ['services'],
    queryFn: fetchServices,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Service action mutation
  const actionMutation = useMutation({
    mutationFn: ({ name, action }: { name: string; action: 'start' | 'stop' | 'restart' }) =>
      serviceAction(name, action),
    onMutate: ({ name }) => {
      setActionLoading(prev => ({ ...prev, [name]: true }));
    },
    onSettled: (_, __, { name }) => {
      setActionLoading(prev => ({ ...prev, [name]: false }));
      // Refetch services after action
      setTimeout(() => refetch(), 1000);
    },
    onError: (error) => {
      alert(`Error: ${error instanceof Error ? error.message : 'Action failed'}`);
    },
  });

  const handleAction = (name: string, action: 'start' | 'stop' | 'restart') => {
    setConfirmDialog({ open: true, serviceName: name, action });
  };

  const confirmAction = () => {
    actionMutation.mutate({ name: confirmDialog.serviceName, action: confirmDialog.action });
    setConfirmDialog({ open: false, serviceName: '', action: 'start' });
  };

  // Count services by status
  const statusCounts = services?.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  // Sort services: bot and el first, then others
  const sortedServices = services?.slice().sort((a, b) => {
    const priority: Record<string, number> = { bot: 0, el: 1 };
    const aPriority = priority[a.name] ?? 99;
    const bPriority = priority[b.name] ?? 99;
    return aPriority - bPriority;
  });

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Service Management</h1>
          <p className="text-muted-foreground">
            Monitor and control production services
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Status summary */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-green-600 font-medium">
              {statusCounts.running || 0} running
            </span>
            <span className="text-gray-400">|</span>
            <span className="text-gray-600 font-medium">
              {statusCounts.stopped || 0} stopped
            </span>
            {statusCounts.failed > 0 && (
              <>
                <span className="text-gray-400">|</span>
                <span className="text-red-600 font-medium">
                  {statusCounts.failed} failed
                </span>
              </>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Refresh
          </Button>
          <Button
            variant={notificationsEnabled ? 'default' : 'outline'}
            size="sm"
            onClick={toggleNotifications}
            disabled={notificationLoading || notificationsEnabled === null}
            className={cn(
              notificationsEnabled && 'bg-green-600 hover:bg-green-700',
              notificationsEnabled === false && 'text-gray-500'
            )}
          >
            {notificationLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : notificationsEnabled ? (
              <Bell className="h-4 w-4 mr-2" />
            ) : (
              <BellOff className="h-4 w-4 mr-2" />
            )}
            {notificationsEnabled === null ? 'Loading...' : notificationsEnabled ? 'Notifications ON' : 'Notifications OFF'}
          </Button>
          <Button
            variant={syncEnabled ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSyncEnabled(!syncEnabled)}
            className={cn(
              syncEnabled && 'bg-blue-600 hover:bg-blue-700',
              !syncEnabled && 'text-gray-500'
            )}
          >
            {syncEnabled ? (
              <Link className="h-4 w-4 mr-2" />
            ) : (
              <Unlink className="h-4 w-4 mr-2" />
            )}
            {syncEnabled ? 'Sync ON' : 'Sync OFF'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Notification Settings Modal */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification Settings
            </DialogTitle>
            <DialogDescription>
              Configure which notifications you want to receive
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-2">
            {/* Global toggle */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="font-medium">All Notifications</span>
              </div>
              <Switch
                checked={notificationsEnabled || false}
                onCheckedChange={toggleNotifications}
                disabled={notificationLoading || notificationsEnabled === null}
              />
            </div>

            {/* Divider */}
            <div className="border-t pt-4">
              <p className="text-sm text-muted-foreground mb-3">Individual Patterns</p>
            </div>

            {/* Pattern toggles */}
            {patterns.map((pattern) => (
              <div
                key={pattern.name}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border",
                  pattern.enabled ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span>{pattern.emoji}</span>
                    <span className="font-medium truncate">{pattern.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">Service: {pattern.service}</span>
                </div>
                <Switch
                  checked={pattern.enabled}
                  onCheckedChange={() => togglePattern(pattern.name)}
                  disabled={patternLoading[pattern.name] || !notificationsEnabled}
                  className="flex-shrink-0 ml-2"
                />
              </div>
            ))}

            {patterns.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No notification patterns configured
              </p>
            )}
          </div>
          <DialogFooter className="flex-shrink-0">
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Services Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !services || services.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No services found. Make sure the service API is running.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Bot and EL side by side at top */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {sortedServices?.filter(s => s.name === 'bot' || s.name === 'el').map((service) => (
              <ServiceCard
                key={service.name}
                service={service}
                onAction={(action) => handleAction(service.name, action)}
                isActionLoading={actionLoading[service.name] || false}
                syncEnabled={syncEnabled}
                syncTimestamp={syncTimestamp}
                onSyncScroll={setSyncTimestamp}
                isSyncMaster={service.name === 'bot'}
              />
            ))}
          </div>
          {/* Other services below */}
          <div className="grid grid-cols-1 gap-4">
            {sortedServices?.filter(s => s.name !== 'bot' && s.name !== 'el').map((service) => (
              <ServiceCard
                key={service.name}
                service={service}
                onAction={(action) => handleAction(service.name, action)}
                isActionLoading={actionLoading[service.name] || false}
                syncEnabled={syncEnabled}
                syncTimestamp={syncTimestamp}
                onSyncScroll={setSyncTimestamp}
                isSyncMaster={false}
              />
            ))}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog.action.charAt(0).toUpperCase() + confirmDialog.action.slice(1)} Service
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to <strong>{confirmDialog.action}</strong> the <strong>{confirmDialog.serviceName}</strong> service?
              {confirmDialog.action === 'stop' && (
                <span className="block mt-2 text-yellow-600">This will stop the service and may affect running operations.</span>
              )}
              {confirmDialog.action === 'restart' && (
                <span className="block mt-2 text-yellow-600">This will briefly interrupt the service.</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(prev => ({ ...prev, open: false }))}>
              Cancel
            </Button>
            <Button
              onClick={confirmAction}
              className={cn(
                confirmDialog.action === 'stop' && 'bg-red-600 hover:bg-red-700 text-white',
                confirmDialog.action === 'restart' && 'bg-yellow-600 hover:bg-yellow-700 text-white',
                confirmDialog.action === 'start' && 'bg-green-600 hover:bg-green-700 text-white'
              )}
            >
              {confirmDialog.action.charAt(0).toUpperCase() + confirmDialog.action.slice(1)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
