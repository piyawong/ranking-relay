# PRP: Relay Ranking Dashboard System

## Executive Summary

Build a full-stack Next.js 14+ application for displaying and managing relay performance rankings with real-time updates, PostgreSQL database, and Docker deployment.

**Confidence Score: 9/10** - High confidence due to comprehensive research, clear requirements, and well-documented implementation path.

## Context & Requirements

### Project Overview
Create a production-ready dashboard system that:
- Receives relay performance data via HTTP API
- Calculates rankings based on arrival order and performance metrics
- Displays real-time rankings and historical data
- Provides detailed analytics and visualizations
- Deploys with single docker-compose command

### Key Documentation References
- **Next.js Route Handlers**: https://nextjs.org/docs/14/app/building-your-application/routing/route-handlers
- **Prisma with Next.js**: https://www.prisma.io/nextjs
- **TanStack Query**: https://tanstack.com/query/latest
- **Recharts**: https://recharts.org/
- **shadcn/ui**: https://ui.shadcn.com/
- **Zod Validation**: https://zod.dev/

### Research Findings Location
- `research/relay-ranking-dashboard/codebase-analysis.md`
- `research/relay-ranking-dashboard/external-research.md`
- `research/relay-ranking-dashboard/architecture-planning.md`
- `research/relay-ranking-dashboard/user-clarifications.md`

## Implementation Blueprint

### Phase 1: Project Setup and Configuration

```bash
# 1. Initialize Next.js project with TypeScript
npx create-next-app@latest ranking-node --typescript --tailwind --app --src-dir=false --import-alias="@/*"

# 2. Install core dependencies
npm install prisma @prisma/client zod @tanstack/react-query recharts
npm install -D @types/node

# 3. Setup Prisma
npx prisma init --datasource-provider postgresql

# 4. Install shadcn/ui
npx shadcn-ui@latest init
```

### Phase 2: Database Schema Implementation

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Block {
  id           String         @id @default(uuid())
  block_number Int           @unique
  created_at   DateTime      @default(now())
  updated_at   DateTime      @updatedAt
  relay_details RelayDetail[]

  @@index([block_number])
}

model RelayDetail {
  id            String   @id @default(uuid())
  block_id      String
  block         Block    @relation(fields: [block_id], references: [id], onDelete: Cascade)
  relay_name    String
  latency       Decimal  @db.Decimal(10, 2)
  loss          Decimal  @db.Decimal(5, 2)
  arrival_order Int
  ranking_score Decimal  @db.Decimal(10, 2)
  created_at    DateTime @default(now())

  @@index([block_id])
  @@index([relay_name])
  @@index([ranking_score])
}

model RelayStatistics {
  id                  String   @id @default(uuid())
  relay_name          String   @unique
  total_blocks        Int      @default(0)
  avg_latency         Decimal  @db.Decimal(10, 2)
  avg_loss            Decimal  @db.Decimal(5, 2)
  first_arrival_count Int      @default(0)
  last_updated        DateTime @updatedAt

  @@index([relay_name])
}
```

### Phase 3: Core Implementation Tasks

## Implementation Tasks (In Order)

1. **Project Initialization**
   - Create Next.js project with TypeScript
   - Configure ESLint and Prettier
   - Setup git repository

2. **Database Setup**
   - Initialize Prisma with PostgreSQL
   - Create database schema
   - Generate Prisma client
   - Create seed script for development

3. **Docker Configuration**
   - Create multi-stage Dockerfile
   - Setup docker-compose.yml for production
   - Setup docker-compose.dev.yml for development
   - Add health checks

4. **Core Libraries Setup**
   - Create Prisma client singleton (`lib/db/prisma.ts`)
   - Setup Zod validation schemas (`lib/utils/validation.ts`)
   - Create type definitions (`lib/types/`)
   - Setup React Query provider

5. **API Implementation**
   - POST `/api/relays` - Data ingestion endpoint
   - GET `/api/relays/[blockNumber]` - Get specific block data
   - GET `/api/rankings` - Get current rankings
   - GET `/api/statistics` - Get aggregated stats

6. **Utility Functions**
   - Ranking calculation algorithm (`lib/utils/ranking.ts`)
   - Data formatting utilities (`lib/utils/format.ts`)
   - Database query helpers (`lib/db/queries/`)

7. **UI Components**
   - Install shadcn/ui components (Table, Card, Button, etc.)
   - Create RankingTable component
   - Create PerformanceChart component
   - Create RelayCard component
   - Create BlockSelector component

8. **Dashboard Pages**
   - Main dashboard page (`app/dashboard/page.tsx`)
   - Block detail page (`app/dashboard/[blockNumber]/page.tsx`)
   - Dashboard layout with navigation

9. **Real-time Features**
   - Setup React Query for data fetching
   - Implement polling for real-time updates
   - Add loading and error states

10. **Testing**
    - Unit tests for ranking algorithm
    - API endpoint tests
    - Component tests
    - Integration tests

11. **Documentation**
    - Update README.md with setup instructions
    - Add API documentation
    - Environment variables documentation

12. **Performance Optimization**
    - Add database indexes
    - Implement virtual scrolling
    - Setup caching strategies

## Validation Gates

```bash
# TypeScript and Linting
npm run build              # Must compile without errors
npm run lint              # Must pass ESLint checks

# Database
npx prisma validate       # Schema must be valid
npx prisma migrate dev    # Migrations must apply cleanly

# Testing
npm test                  # All tests must pass
npm run test:coverage     # Minimum 70% coverage

# Docker
docker-compose build      # Images must build successfully
docker-compose up -d      # Services must start and pass health checks

# API Testing
curl -X POST http://localhost:3000/api/relays \
  -H "Content-Type: application/json" \
  -d '{
    "block_number": 1000,
    "relay_details": [
      {"name": "relay1", "latency": 10.5, "loss": 0.1},
      {"name": "relay2", "latency": 15.2, "loss": 0.3}
    ]
  }'
# Must return 200 with success response

# UI Testing
npm run dev               # Dashboard must load at http://localhost:3000/dashboard
                         # Rankings must display correctly
                         # Charts must render
```

## Key Implementation Patterns

### API Route Pattern (app/api/relays/route.ts)
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { calculateRankingScore } from '@/lib/utils/ranking';

const RelayDataSchema = z.object({
  block_number: z.number().positive(),
  relay_details: z.array(z.object({
    latency: z.number().min(0),
    loss: z.number().min(0).max(100),
    name: z.string().min(1)
  }))
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = RelayDataSchema.parse(body);

    const block = await prisma.block.create({
      data: {
        block_number: validated.block_number,
        relay_details: {
          create: validated.relay_details.map((detail, index) => ({
            relay_name: detail.name,
            latency: detail.latency,
            loss: detail.loss,
            arrival_order: index,
            ranking_score: calculateRankingScore(detail, index)
          }))
        }
      },
      include: {
        relay_details: true
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Relay data recorded successfully',
      data: {
        block_id: block.id,
        rankings: block.relay_details.map(r => ({
          relay_name: r.relay_name,
          ranking_score: r.ranking_score,
          arrival_order: r.arrival_order
        }))
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Validation error',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
```

### Ranking Calculation (lib/utils/ranking.ts)
```typescript
interface RelayMetrics {
  latency: number;
  loss: number;
}

export function calculateRankingScore(
  metrics: RelayMetrics,
  arrivalOrder: number
): number {
  // Lower score is better
  // Weights: arrival_order (50%), latency (30%), loss (20%)
  const arrivalScore = arrivalOrder * 50;
  const latencyScore = metrics.latency * 0.3;
  const lossScore = metrics.loss * 0.2;

  return parseFloat((arrivalScore + latencyScore + lossScore).toFixed(2));
}
```

### React Query Setup (app/providers/QueryProvider.tsx)
```typescript
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            refetchInterval: 5000, // Poll every 5 seconds for real-time
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

### Docker Configuration (Dockerfile)
```dockerfile
# Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

USER nextjs
EXPOSE 3000
ENV PORT 3000

CMD ["node", "server.js"]
```

### Docker Compose (docker-compose.yml)
```yaml
version: '3.8'

services:
  webapp:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://relay_user:relay_pass@postgres:5432/relay_db
      NODE_ENV: production
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: relay_user
      POSTGRES_PASSWORD: relay_pass
      POSTGRES_DB: relay_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U relay_user -d relay_db"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

## Common Gotchas & Solutions

### Prisma Connection Issues
- **Problem**: Connection pool exhaustion in serverless
- **Solution**: Use Prisma client singleton pattern
```typescript
// lib/db/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

### Next.js Standalone Build
- **Problem**: Missing dependencies in production build
- **Solution**: Use Next.js standalone output
```javascript
// next.config.js
module.exports = {
  output: 'standalone',
  experimental: {
    outputFileTracingIncludes: {
      '/api/**/*': ['./node_modules/**/*.js'],
    },
  },
};
```

### Type Safety with Decimal
- **Problem**: Prisma Decimal type handling
- **Solution**: Convert to number for calculations
```typescript
const latency = Number(relayDetail.latency);
const loss = Number(relayDetail.loss);
```

## Environment Variables

Create `.env.local`:
```env
# Database
DATABASE_URL=postgresql://relay_user:relay_pass@localhost:5432/relay_db

# Next.js
NEXT_PUBLIC_API_URL=http://localhost:3000

# Optional
NODE_ENV=development
```

## Testing Strategy

### Unit Test Example (tests/utils/ranking.test.ts)
```typescript
import { calculateRankingScore } from '@/lib/utils/ranking';

describe('calculateRankingScore', () => {
  it('should calculate correct score for first arrival', () => {
    const score = calculateRankingScore(
      { latency: 10, loss: 0.5 },
      0
    );
    expect(score).toBe(3.1); // (0*50) + (10*0.3) + (0.5*0.2)
  });

  it('should give higher score for later arrivals', () => {
    const firstScore = calculateRankingScore({ latency: 10, loss: 0.5 }, 0);
    const secondScore = calculateRankingScore({ latency: 10, loss: 0.5 }, 1);
    expect(secondScore).toBeGreaterThan(firstScore);
  });
});
```

### API Test Example (tests/api/relays.test.ts)
```typescript
import { POST } from '@/app/api/relays/route';
import { NextRequest } from 'next/server';

describe('POST /api/relays', () => {
  it('should accept valid relay data', async () => {
    const request = new NextRequest('http://localhost:3000/api/relays', {
      method: 'POST',
      body: JSON.stringify({
        block_number: 1000,
        relay_details: [
          { name: 'relay1', latency: 10, loss: 0.1 }
        ]
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
```

## Success Criteria

1. ✅ Docker compose brings up entire stack with one command
2. ✅ API accepts relay data and calculates rankings
3. ✅ Dashboard displays real-time rankings
4. ✅ Charts visualize performance trends
5. ✅ Data persists in PostgreSQL
6. ✅ TypeScript compilation succeeds
7. ✅ All tests pass
8. ✅ Production build completes
9. ✅ Health checks pass
10. ✅ Documentation is complete

## Additional Resources

- **Next.js App Router Examples**: https://github.com/vercel/next.js/tree/canary/examples
- **Prisma Best Practices**: https://www.prisma.io/docs/guides/performance-and-optimization
- **Docker Multi-stage Builds**: https://docs.docker.com/build/building/multi-stage/
- **React Query Patterns**: https://tkdodo.eu/blog/practical-react-query

## Notes for AI Implementation

1. **Start with database setup** - Ensure schema is correct before building features
2. **Implement API before UI** - Backend functionality enables frontend development
3. **Use TypeScript strictly** - Type safety prevents runtime errors
4. **Test incrementally** - Verify each component works before moving on
5. **Follow file structure exactly** - Consistency aids in debugging
6. **Handle errors gracefully** - User experience depends on good error handling
7. **Document as you build** - Comments and README updates during development
8. **Use the research findings** - Reference the research folder for detailed patterns

---

**Implementation Ready**: This PRP provides complete context for one-pass implementation. Follow tasks sequentially, validate at each gate, and reference documentation links for specific syntax.