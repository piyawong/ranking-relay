/**
 * Utility functions for formatting data
 */

/**
 * Format a number to a fixed number of decimal places
 *
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted number string
 */
export function formatNumber(value: number, decimals: number = 2): string {
  return value.toFixed(decimals);
}

/**
 * Format latency value with units
 *
 * @param latency - Latency value in milliseconds
 * @returns Formatted latency string with units
 */
export function formatLatency(latency: number): string {
  if (latency < 1) {
    return `${(latency * 1000).toFixed(0)}μs`;
  }
  if (latency < 1000) {
    return `${latency.toFixed(1)}ms`;
  }
  return `${(latency / 1000).toFixed(2)}s`;
}

/**
 * Format packet loss percentage
 *
 * @param loss - Packet loss value (0-100)
 * @returns Formatted loss percentage string
 */
export function formatLoss(loss: number): string {
  return `${loss.toFixed(1)}%`;
}

/**
 * Format timestamp to readable date/time
 *
 * @param timestamp - ISO timestamp string
 * @param includeTime - Whether to include time (default: true)
 * @returns Formatted date/time string
 */
export function formatTimestamp(timestamp: string | Date, includeTime: boolean = true): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;

  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };

  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.second = '2-digit';
  }

  return date.toLocaleString('en-US', options);
}

/**
 * Format relative time (e.g., "5 minutes ago")
 *
 * @param timestamp - ISO timestamp string
 * @returns Relative time string
 */
export function formatRelativeTime(timestamp: string | Date): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return 'just now';
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else {
    return formatTimestamp(date, false);
  }
}

/**
 * Format rank position (1st, 2nd, 3rd, etc.)
 *
 * @param position - Rank position number
 * @returns Formatted rank string with ordinal suffix
 */
export function formatRank(position: number): string {
  const suffix = ['th', 'st', 'nd', 'rd'];
  const v = position % 100;
  return position + (suffix[(v - 20) % 10] || suffix[v] || suffix[0]);
}

/**
 * Truncate relay name if too long
 *
 * @param name - Relay name
 * @param maxLength - Maximum length (default: 20)
 * @returns Truncated name with ellipsis if needed
 */
export function truncateRelayName(name: string, maxLength: number = 20): string {
  if (name.length <= maxLength) return name;
  return name.substring(0, maxLength - 3) + '...';
}

/**
 * Format block number with commas for thousands
 *
 * @param blockNumber - Block number
 * @returns Formatted block number string
 */
export function formatBlockNumber(blockNumber: number): string {
  return blockNumber.toLocaleString('en-US');
}

/**
 * Convert Decimal (from Prisma) to number
 *
 * @param decimal - Decimal value from Prisma
 * @returns Number value
 */
export function decimalToNumber(decimal: { toString(): string } | number | string): number {
  return typeof decimal === 'object' ? parseFloat(decimal.toString()) : Number(decimal);
}