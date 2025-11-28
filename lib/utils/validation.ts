import { z } from 'zod';

// Relay data validation schema for API input
export const RelayDataSchema = z.object({
  block_number: z.number().int().positive(),
  block_hash: z.string().optional(),
  relay_details: z.array(z.object({
    latency: z.number().min(0),
    loss: z.number().min(0).max(100),
    name: z.string().min(1).max(100),
    arrival_timestamp: z.string().datetime() // ISO 8601 format: "2025-11-10T12:34:56.789Z"
  })).min(1)
});

export type RelayDataInput = z.infer<typeof RelayDataSchema>;

// Relay detail schema
export const RelayDetailSchema = z.object({
  latency: z.number().min(0),
  loss: z.number().min(0).max(100),
  name: z.string().min(1).max(100),
  arrival_timestamp: z.string().datetime()
});

export type RelayDetail = z.infer<typeof RelayDetailSchema>;

// Query parameters schema for rankings
export const RankingQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
  relayName: z.string().optional(),
  blockNumber: z.coerce.number().int().positive().optional()
});

export type RankingQuery = z.infer<typeof RankingQuerySchema>;

// Statistics query schema
export const StatsQuerySchema = z.object({
  relayName: z.string().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional().default(10),
  timeRange: z.enum(['1h', '6h', '24h', '7d', '30d', 'all']).optional().default('all'),
  blockRange: z.coerce.number().int().positive().optional()
});

export type StatsQuery = z.infer<typeof StatsQuerySchema>;