import { Block, RelayDetail, RelayStatistics } from '@prisma/client';

// Re-export Prisma types for convenience
export type { Block, RelayDetail, RelayStatistics };

// Extended types with relations
export interface BlockWithDetails extends Block {
  RelayDetail: RelayDetail[];
}

// Type for relay metrics used in calculations
export interface RelayMetrics {
  latency: number;
  loss: number;
}

// Type for ranking calculation input
export interface RankingInput extends RelayMetrics {
  name: string;
}