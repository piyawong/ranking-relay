/**
 * Utility functions for ranking calculations
 */

interface RelayMetrics {
  latency: number;
  loss: number;
}

/**
 * Calculate ranking score for a relay based on its metrics and arrival order
 * Lower score is better (similar to race positions)
 *
 * @param metrics - The relay's performance metrics (latency and loss)
 * @param arrivalOrder - The order in which the relay arrived (0 = first)
 * @returns The calculated ranking score
 */
export function calculateRankingScore(
  metrics: RelayMetrics,
  arrivalOrder: number
): number {
  // Weights: arrival_order (50%), latency (30%), loss (20%)
  const arrivalScore = arrivalOrder * 50;
  const latencyScore = metrics.latency * 0.3;
  const lossScore = metrics.loss * 0.2;

  return parseFloat((arrivalScore + latencyScore + lossScore).toFixed(2));
}

/**
 * Sort relays by ranking score (lower is better)
 *
 * @param relays - Array of relays with ranking scores
 * @returns Sorted array of relays
 */
export function sortByRanking<T extends { ranking_score: number }>(relays: T[]): T[] {
  return [...relays].sort((a, b) => a.ranking_score - b.ranking_score);
}

/**
 * Calculate percentage improvement/degradation between two scores
 *
 * @param oldScore - Previous ranking score
 * @param newScore - Current ranking score
 * @returns Percentage change (negative means improvement)
 */
export function calculateScoreChange(oldScore: number, newScore: number): number {
  if (oldScore === 0) return 0;
  return parseFloat((((newScore - oldScore) / oldScore) * 100).toFixed(2));
}

/**
 * Determine rank position from an array of scores
 *
 * @param scores - Array of ranking scores
 * @param targetScore - The score to find rank for
 * @returns Rank position (1-based)
 */
export function getRankPosition(scores: number[], targetScore: number): number {
  const sorted = [...scores].sort((a, b) => a - b);
  return sorted.indexOf(targetScore) + 1;
}

/**
 * Calculate average metrics from an array of relay data
 *
 * @param relays - Array of relay metrics
 * @returns Average latency and loss
 */
export function calculateAverageMetrics(
  relays: RelayMetrics[]
): { avgLatency: number; avgLoss: number } {
  if (relays.length === 0) {
    return { avgLatency: 0, avgLoss: 0 };
  }

  const totalLatency = relays.reduce((sum, r) => sum + r.latency, 0);
  const totalLoss = relays.reduce((sum, r) => sum + r.loss, 0);

  return {
    avgLatency: parseFloat((totalLatency / relays.length).toFixed(2)),
    avgLoss: parseFloat((totalLoss / relays.length).toFixed(2))
  };
}