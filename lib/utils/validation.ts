import { z } from 'zod';

// Relay data validation schema for API input
export const RelayDataSchema = z.object({
  block_number: z.number().int().positive(),
  relay_details: z.array(z.object({
    latency: z.number().min(0),
    loss: z.number().min(0).max(100),
    name: z.string().min(1).max(100)
  })).min(1)
});

export type RelayDataInput = z.infer<typeof RelayDataSchema>;

// Relay detail schema
export const RelayDetailSchema = z.object({
  latency: z.number().min(0),
  loss: z.number().min(0).max(100),
  name: z.string().min(1).max(100)
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
  limit: z.coerce.number().int().positive().max(50).optional().default(10)
});

export type StatsQuery = z.infer<typeof StatsQuerySchema>;