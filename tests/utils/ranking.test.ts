import {
  calculateRankingScore,
  sortByRanking,
  calculateScoreChange,
  getRankPosition,
  calculateAverageMetrics,
} from '@/lib/utils/ranking';

describe('calculateRankingScore', () => {
  it('should calculate correct score for first arrival', () => {
    const score = calculateRankingScore(
      { latency: 10, loss: 0.5 },
      0
    );
    // (0*50) + (10*0.3) + (0.5*0.2) = 0 + 3 + 0.1 = 3.1
    expect(score).toBe(3.1);
  });

  it('should give higher score for later arrivals', () => {
    const firstScore = calculateRankingScore({ latency: 10, loss: 0.5 }, 0);
    const secondScore = calculateRankingScore({ latency: 10, loss: 0.5 }, 1);
    expect(secondScore).toBeGreaterThan(firstScore);
  });

  it('should handle edge cases with zero values', () => {
    const score = calculateRankingScore({ latency: 0, loss: 0 }, 0);
    expect(score).toBe(0);
  });

  it('should weight arrival order most heavily', () => {
    const highArrivalScore = calculateRankingScore({ latency: 5, loss: 0.1 }, 10);
    const lowArrivalScore = calculateRankingScore({ latency: 50, loss: 5 }, 0);
    expect(highArrivalScore).toBeGreaterThan(lowArrivalScore);
  });
});

describe('sortByRanking', () => {
  it('should sort relays by ranking score ascending', () => {
    const relays = [
      { ranking_score: 10.5 },
      { ranking_score: 5.2 },
      { ranking_score: 15.8 },
    ];
    const sorted = sortByRanking(relays);
    expect(sorted[0].ranking_score).toBe(5.2);
    expect(sorted[1].ranking_score).toBe(10.5);
    expect(sorted[2].ranking_score).toBe(15.8);
  });

  it('should not modify original array', () => {
    const relays = [{ ranking_score: 10 }, { ranking_score: 5 }];
    const sorted = sortByRanking(relays);
    expect(relays[0].ranking_score).toBe(10);
    expect(sorted[0].ranking_score).toBe(5);
  });

  it('should handle empty array', () => {
    const sorted = sortByRanking([]);
    expect(sorted).toEqual([]);
  });
});

describe('calculateScoreChange', () => {
  it('should calculate positive change when score increases', () => {
    const change = calculateScoreChange(10, 15);
    expect(change).toBe(50); // 50% increase
  });

  it('should calculate negative change when score decreases', () => {
    const change = calculateScoreChange(20, 10);
    expect(change).toBe(-50); // 50% decrease (improvement)
  });

  it('should handle zero old score', () => {
    const change = calculateScoreChange(0, 10);
    expect(change).toBe(0);
  });

  it('should return 0 when no change', () => {
    const change = calculateScoreChange(10, 10);
    expect(change).toBe(0);
  });
});

describe('getRankPosition', () => {
  it('should return correct rank position', () => {
    const scores = [5.5, 10.2, 3.1, 8.7];
    expect(getRankPosition(scores, 3.1)).toBe(1); // Best score
    expect(getRankPosition(scores, 10.2)).toBe(4); // Worst score
  });

  it('should handle score not in array', () => {
    const scores = [5, 10, 15];
    expect(getRankPosition(scores, 20)).toBe(0); // Not found returns 0
  });

  it('should handle empty array', () => {
    expect(getRankPosition([], 5)).toBe(0);
  });
});

describe('calculateAverageMetrics', () => {
  it('should calculate correct averages', () => {
    const relays = [
      { latency: 10, loss: 1 },
      { latency: 20, loss: 2 },
      { latency: 30, loss: 3 },
    ];
    const averages = calculateAverageMetrics(relays);
    expect(averages.avgLatency).toBe(20);
    expect(averages.avgLoss).toBe(2);
  });

  it('should handle single relay', () => {
    const relays = [{ latency: 15.5, loss: 0.5 }];
    const averages = calculateAverageMetrics(relays);
    expect(averages.avgLatency).toBe(15.5);
    expect(averages.avgLoss).toBe(0.5);
  });

  it('should return zeros for empty array', () => {
    const averages = calculateAverageMetrics([]);
    expect(averages.avgLatency).toBe(0);
    expect(averages.avgLoss).toBe(0);
  });

  it('should round to 2 decimal places', () => {
    const relays = [
      { latency: 10.333, loss: 1.111 },
      { latency: 20.444, loss: 2.222 },
    ];
    const averages = calculateAverageMetrics(relays);
    expect(averages.avgLatency).toBe(15.39);
    expect(averages.avgLoss).toBe(1.67);
  });
});