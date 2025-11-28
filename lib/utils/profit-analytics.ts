/**
 * Profit analytics utility functions
 *
 * Calculates various profit metrics based on balance history
 */

interface HistoryPoint {
  timestamp: string;
  total_usd: number;
  total_usd_usdt: number;
  total_rlb: number;
}

type ValueType = 'total_usd' | 'total_usd_usdt' | 'total_rlb';

export interface ProfitAnalytics {
  // Period values
  startValue: number;
  endValue: number;
  profitLoss: number;
  profitLossPercent: number;

  // Time-based metrics
  totalHours: number;
  profitPerHour: number;
  profitPerDay: number;

  // Additional metrics
  maxValue: number;
  minValue: number;
  avgValue: number;
  volatility: number;

  // Timestamps
  startTime: string;
  endTime: string;

  // Data quality
  dataPoints: number;
}

/**
 * Calculate profit analytics for a given time period
 *
 * @param history Array of historical data points
 * @param valueType Which value field to analyze (total_usd, total_usd_usdt, or total_rlb)
 * @returns Profit analytics object with all calculated metrics
 */
export function calculateProfitAnalytics(
  history: HistoryPoint[],
  valueType: ValueType = 'total_usd'
): ProfitAnalytics | null {
  if (!history || history.length === 0) {
    return null;
  }

  // Sort by timestamp to ensure chronological order
  const sortedHistory = [...history].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const firstPoint = sortedHistory[0];
  const lastPoint = sortedHistory[sortedHistory.length - 1];

  const startValue = firstPoint[valueType];
  const endValue = lastPoint[valueType];
  const profitLoss = endValue - startValue;
  const profitLossPercent = startValue > 0 ? (profitLoss / startValue) * 100 : 0;

  // Calculate time span in hours
  const startTime = new Date(firstPoint.timestamp);
  const endTime = new Date(lastPoint.timestamp);
  const totalMilliseconds = endTime.getTime() - startTime.getTime();
  const totalHours = totalMilliseconds / (1000 * 60 * 60);

  // Calculate profit per hour and per day
  const profitPerHour = totalHours > 0 ? profitLoss / totalHours : 0;
  const profitPerDay = profitPerHour * 24;

  // Calculate max, min, and average values
  const values = sortedHistory.map(point => point[valueType]);
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const avgValue = values.reduce((sum, val) => sum + val, 0) / values.length;

  // Calculate volatility (standard deviation)
  const variance = values.reduce((sum, val) => sum + Math.pow(val - avgValue, 2), 0) / values.length;
  const volatility = Math.sqrt(variance);

  return {
    startValue,
    endValue,
    profitLoss,
    profitLossPercent,
    totalHours,
    profitPerHour,
    profitPerDay,
    maxValue,
    minValue,
    avgValue,
    volatility,
    startTime: firstPoint.timestamp,
    endTime: lastPoint.timestamp,
    dataPoints: sortedHistory.length
  };
}

/**
 * Format profit/loss value with color coding
 *
 * @param value Profit or loss value
 * @param includeSign Whether to include + sign for positive values
 * @returns Formatted string
 */
export function formatProfitLoss(value: number, includeSign: boolean = true): string {
  const sign = value >= 0 && includeSign ? '+' : '';
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

/**
 * Get color class for profit/loss display
 *
 * @param value Profit or loss value
 * @returns Tailwind color class
 */
export function getProfitLossColor(value: number): string {
  if (value > 0) return 'text-green-600';
  if (value < 0) return 'text-red-600';
  return 'text-gray-600';
}

/**
 * Format percentage with color coding
 *
 * @param percent Percentage value
 * @param includeSign Whether to include + sign for positive values
 * @returns Formatted string
 */
export function formatPercent(percent: number, includeSign: boolean = true): string {
  const sign = percent >= 0 && includeSign ? '+' : '';
  return `${sign}${percent.toFixed(2)}%`;
}

/**
 * Format duration in human-readable format
 *
 * @param hours Number of hours
 * @returns Formatted string (e.g., "2d 5h", "3h 30m")
 */
export function formatDuration(hours: number): string {
  if (hours < 1) {
    const minutes = Math.floor(hours * 60);
    return `${minutes}m`;
  }

  if (hours < 24) {
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = Math.floor(hours % 24);
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}
