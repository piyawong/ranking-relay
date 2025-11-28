// API Response Types

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  details?: unknown;
}

export interface RelayDataResponse {
  block_id: string;
  rankings: RankingItem[];
}

export interface RankingItem {
  relay_name: string;
  ranking_score: number;
  arrival_order: number;
}

export interface BlockData {
  id: string;
  block_number: number;
  block_hash?: string;
  origin?: string;
  bloxroute_timestamp?: string;
  created_at: string;
  updated_at: string;
  relay_details: RelayDetailData[];
}

export interface RelayDetailData {
  id: string;
  block_id: string;
  relay_name: string;
  latency: number;
  loss: number;
  arrival_order: number;
  arrival_timestamp: string;
  ranking_score: number;
  created_at: string;
}

export interface RelayStatisticsData {
  id: string;
  relay_name: string;
  total_blocks: number;
  avg_latency: number;
  avg_loss: number;
  first_arrival_count: number;
  last_updated: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}