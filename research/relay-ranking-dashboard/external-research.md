# External Research for Relay Ranking Dashboard

## Core Technology Stack

### Next.js 14+ App Router
- **Documentation**: https://nextjs.org/docs/14/app/building-your-application/routing/route-handlers
- **Route Handlers**: Use `route.ts` files in `app/api/` directory
- **Key Features**:
  - Server Components by default
  - Built-in caching with `fetch()`
  - Streaming support for real-time data
  - TypeScript first-class support

### Prisma ORM with PostgreSQL
- **Documentation**: https://www.prisma.io/nextjs
- **Integration Guide**: https://www.prisma.io/docs/guides/nextjs
- **Key Benefits**:
  - Type-safe database queries
  - Automatic migrations
  - Built for serverless (no connection pooling issues)
  - Schema-first approach

### Data Validation with Zod
- **Documentation**: https://zod.dev/
- **Integration**: https://zod.dev/ecosystem
- **Usage Pattern**:
```typescript
import { z } from 'zod';

const RelayDataSchema = z.object({
  block_number: z.number().positive(),
  relay_details: z.array(z.object({
    latency: z.number().min(0),
    loss: z.number().min(0).max(100),
    name: z.string().min(1)
  }))
});
```

### Real-time Updates with TanStack Query
- **Documentation**: https://tanstack.com/query/latest
- **Polling Pattern**: For real-time dashboard updates
```typescript
const { data, isLoading } = useQuery({
  queryKey: ['rankings'],
  queryFn: fetchRankings,
  refetchInterval: 5000, // Poll every 5 seconds
});
```

### Data Visualization with Recharts
- **Documentation**: https://recharts.org/
- **GitHub**: https://github.com/recharts/recharts
- **Benefits**:
  - Built on React components
  - Responsive by default
  - Extensive chart types
  - TypeScript support

### UI Components with shadcn/ui
- **Documentation**: https://ui.shadcn.com/
- **Installation**: Copy-paste component approach
- **Benefits**:
  - Tailwind CSS based
  - Fully customizable
  - Accessible by default
  - TypeScript support

## Docker Best Practices

### Multi-stage Build Pattern
```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
```

### Docker Compose Configuration
```yaml
version: '3.8'
services:
  webapp:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://user:password@postgres:5432/relay_db
    depends_on:
      - postgres

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: relay_db
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## API Design Pattern

### POST /api/relays
```typescript
// Request validation
const bodySchema = z.object({
  block_number: z.number(),
  relay_details: z.array(z.object({
    latency: z.number(),
    loss: z.number(),
    name: z.string()
  }))
});

// Route handler
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = bodySchema.parse(body);

    // Process and store data with Prisma
    const result = await prisma.block.create({
      data: {
        block_number: validated.block_number,
        relay_details: {
          create: validated.relay_details.map((detail, index) => ({
            ...detail,
            arrival_order: index,
            ranking_score: calculateRankingScore(detail, index)
          }))
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 400 });
  }
}
```

## Performance Optimizations

### Database Indexing
```prisma
model RelayDetail {
  @@index([block_id])
  @@index([relay_name])
  @@index([ranking_score])
}
```

### React Query Caching
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});
```

### Virtual Scrolling for Large Lists
- Use `@tanstack/react-virtual` for rendering large ranking tables
- Only render visible rows to improve performance

## Security Considerations

### Input Validation
- Always validate with Zod before processing
- Sanitize user inputs
- Use parameterized queries (Prisma handles this)

### Rate Limiting
- Implement rate limiting on API endpoints
- Use middleware for request throttling

### Environment Variables
- Store sensitive data in `.env.local`
- Never commit `.env` files
- Use strong passwords for database

## Common Pitfalls to Avoid

1. **Connection Pool Exhaustion**: Use Prisma's connection management
2. **N+1 Queries**: Use Prisma's `include` for related data
3. **Large Payload Sizes**: Implement pagination for rankings
4. **Stale Data**: Implement proper cache invalidation
5. **Memory Leaks**: Clean up event listeners and intervals