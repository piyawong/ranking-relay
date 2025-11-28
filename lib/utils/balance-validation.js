const { z } = require('zod');

// Balance snapshot validation schema
const BalanceSnapshotSchema = z.object({
  ts: z.string().datetime().optional(), // ISO timestamp string
  pid: z.number().int().positive().optional(),
  onchain: z.object({
    rlb: z.number().min(0),
    usdt: z.number().min(0)
  }),
  onsite: z.object({
    rlb: z.number().min(0),
    usd: z.number().min(0)
  })
});

module.exports = { BalanceSnapshotSchema };


