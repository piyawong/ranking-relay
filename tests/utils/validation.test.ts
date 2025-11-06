import { RelayDataSchema, RankingQuerySchema, StatsQuerySchema } from '@/lib/utils/validation';

describe('RelayDataSchema', () => {
  it('should validate correct relay data', () => {
    const validData = {
      block_number: 1000,
      relay_details: [
        { name: 'relay1', latency: 10.5, loss: 0.5 },
        { name: 'relay2', latency: 15.2, loss: 1.2 },
      ],
    };

    const result = RelayDataSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject negative block number', () => {
    const invalidData = {
      block_number: -1,
      relay_details: [{ name: 'relay1', latency: 10, loss: 0.5 }],
    };

    const result = RelayDataSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject empty relay details array', () => {
    const invalidData = {
      block_number: 1000,
      relay_details: [],
    };

    const result = RelayDataSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject negative latency', () => {
    const invalidData = {
      block_number: 1000,
      relay_details: [{ name: 'relay1', latency: -5, loss: 0.5 }],
    };

    const result = RelayDataSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject loss greater than 100', () => {
    const invalidData = {
      block_number: 1000,
      relay_details: [{ name: 'relay1', latency: 10, loss: 101 }],
    };

    const result = RelayDataSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject empty relay name', () => {
    const invalidData = {
      block_number: 1000,
      relay_details: [{ name: '', latency: 10, loss: 0.5 }],
    };

    const result = RelayDataSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});

describe('RankingQuerySchema', () => {
  it('should provide default values', () => {
    const result = RankingQuerySchema.parse({});
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(0);
    expect(result.relayName).toBeUndefined();
    expect(result.blockNumber).toBeUndefined();
  });

  it('should parse string numbers correctly', () => {
    const result = RankingQuerySchema.parse({
      limit: '50',
      offset: '10',
      blockNumber: '1000',
    });
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(10);
    expect(result.blockNumber).toBe(1000);
  });

  it('should reject limit over 100', () => {
    const result = RankingQuerySchema.safeParse({ limit: 101 });
    expect(result.success).toBe(false);
  });

  it('should reject negative offset', () => {
    const result = RankingQuerySchema.safeParse({ offset: -1 });
    expect(result.success).toBe(false);
  });

  it('should accept optional relay name', () => {
    const result = RankingQuerySchema.parse({ relayName: 'test-relay' });
    expect(result.relayName).toBe('test-relay');
  });
});

describe('StatsQuerySchema', () => {
  it('should provide default limit', () => {
    const result = StatsQuerySchema.parse({});
    expect(result.limit).toBe(10);
  });

  it('should accept relay name filter', () => {
    const result = StatsQuerySchema.parse({ relayName: 'relay-alpha' });
    expect(result.relayName).toBe('relay-alpha');
  });

  it('should coerce string limit to number', () => {
    const result = StatsQuerySchema.parse({ limit: '25' });
    expect(result.limit).toBe(25);
  });

  it('should reject limit over 50', () => {
    const result = StatsQuerySchema.safeParse({ limit: 51 });
    expect(result.success).toBe(false);
  });

  it('should reject negative limit', () => {
    const result = StatsQuerySchema.safeParse({ limit: -1 });
    expect(result.success).toBe(false);
  });
});