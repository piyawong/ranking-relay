# Architecture Planning for Relay Ranking Dashboard

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                    │
├─────────────────────────────────────────────────────────┤
│  Server Components  │  Client Components  │  API Routes │
│  - Dashboard pages  │  - Interactive UI   │  - /api/*   │
│  - Static rendering │  - Real-time data  │  - REST API │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                    Data Layer (Prisma)                   │
│  - Type-safe ORM                                        │
│  - Database migrations                                   │
│  - Query optimization                                    │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                  PostgreSQL Database                     │
│  - Blocks table                                         │
│  - Relay details table                                  │
│  - Statistics aggregation                               │
└─────────────────────────────────────────────────────────┘
```

## File Structure

```
ranking-node/
├── app/
│   ├── api/
│   │   ├── relays/
│   │   │   ├── route.ts              # POST endpoint for relay data
│   │   │   └── [blockNumber]/
│   │   │       └── route.ts          # GET specific block data
│   │   ├── rankings/
│   │   │   └── route.ts              # GET rankings with filters
│   │   └── statistics/
│   │       └── route.ts              # GET aggregated statistics
│   ├── dashboard/
│   │   ├── layout.tsx                # Dashboard layout
│   │   ├── page.tsx                  # Main dashboard page
│   │   ├── [blockNumber]/
│   │   │   └── page.tsx             # Block detail page
│   │   └── loading.tsx              # Loading state
│   ├── components/
│   │   ├── ui/                      # shadcn/ui components
│   │   ├── dashboard/
│   │   │   ├── RankingTable.tsx
│   │   │   ├── RelayCard.tsx
│   │   │   ├── PerformanceChart.tsx
│   │   │   ├── BlockSelector.tsx
│   │   │   └── StatisticsPanel.tsx
│   │   └── providers/
│   │       └── QueryProvider.tsx    # React Query provider
│   ├── layout.tsx                   # Root layout
│   ├── page.tsx                     # Landing page
│   └── globals.css                  # Global styles
├── lib/
│   ├── db/
│   │   ├── prisma.ts               # Prisma client singleton
│   │   └── queries/
│   │       ├── blocks.ts           # Block-related queries
│   │       ├── relays.ts           # Relay-related queries
│   │       └── statistics.ts       # Statistics queries
│   ├── utils/
│   │   ├── ranking.ts              # Ranking calculation logic
│   │   ├── validation.ts           # Zod schemas
│   │   └── format.ts               # Data formatting utilities
│   └── types/
│       ├── api.ts                  # API types
│       ├── database.ts             # Database types
│       └── ui.ts                   # UI component types
├── prisma/
│   ├── schema.prisma               # Database schema
│   ├── migrations/                 # Database migrations
│   └── seed.ts                     # Seed data for development
├── tests/
│   ├── api/
│   │   ├── relays.test.ts
│   │   └── rankings.test.ts
│   ├── components/
│   │   └── RankingTable.test.tsx
│   └── utils/
│       └── ranking.test.ts
├── docker/
│   ├── Dockerfile                  # Multi-stage build
│   ├── docker-compose.yml         # Production compose
│   └── docker-compose.dev.yml     # Development compose
├── public/
│   └── [static assets]
├── .env.example                    # Environment template
├── next.config.js                  # Next.js configuration
├── package.json
├── tsconfig.json
└── README.md
```

## Component Architecture

### Server Components (Default)
- Dashboard pages
- Data fetching components
- Static content

### Client Components (Interactive)
- Real-time charts
- Sortable tables
- Filter controls
- Form inputs

## Data Flow

1. **Data Ingestion**:
   ```
   External System → POST /api/relays → Validation → Prisma → PostgreSQL
   ```

2. **Data Display**:
   ```
   Dashboard → React Query → GET /api/rankings → Prisma → PostgreSQL
   ```

3. **Real-time Updates**:
   ```
   Client → React Query (polling) → API → Fresh Data → UI Update
   ```

## Database Schema Design

```prisma
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
  block         Block    @relation(fields: [block_id], references: [id])
  relay_name    String
  latency       Decimal
  loss          Decimal
  arrival_order Int
  ranking_score Decimal
  created_at    DateTime @default(now())

  @@index([block_id])
  @@index([relay_name])
  @@index([ranking_score])
}

model RelayStatistics {
  id                  String   @id @default(uuid())
  relay_name          String   @unique
  total_blocks        Int      @default(0)
  avg_latency         Decimal
  avg_loss            Decimal
  first_arrival_count Int      @default(0)
  last_updated        DateTime @updatedAt

  @@index([relay_name])
}
```

## Technology Decisions

### Frontend Framework: Next.js 14+
- **Reason**: Server components, built-in API routes, excellent TypeScript support
- **Alternative considered**: Remix (rejected due to smaller ecosystem)

### Database: PostgreSQL
- **Reason**: Robust, scalable, excellent Prisma support
- **Alternative considered**: MySQL (rejected due to fewer advanced features)

### ORM: Prisma
- **Reason**: Type safety, excellent DX, migration management
- **Alternative considered**: TypeORM (rejected due to complexity)

### UI Library: shadcn/ui + Tailwind CSS
- **Reason**: Modern, accessible, customizable, no vendor lock-in
- **Alternative considered**: MUI (rejected due to bundle size)

### Charts: Recharts
- **Reason**: React-based, TypeScript support, responsive
- **Alternative considered**: Chart.js (rejected due to less React integration)

### State Management: React Query (TanStack Query)
- **Reason**: Server state management, caching, real-time updates
- **Alternative considered**: SWR (rejected due to smaller feature set)

### Validation: Zod
- **Reason**: TypeScript-first, runtime validation, schema inference
- **Alternative considered**: Yup (rejected due to less TS integration)

## Scaling Considerations

### Horizontal Scaling
- Stateless application design
- Database connection pooling
- Load balancer ready

### Performance Optimization
- Database indexing on frequently queried fields
- React Query caching for API responses
- Virtual scrolling for large data sets
- Lazy loading for charts

### Monitoring & Observability
- Structured logging
- Performance metrics
- Error tracking
- Health check endpoints

## Security Architecture

### API Security
- Input validation with Zod
- Rate limiting middleware
- Request ID tracking
- CORS configuration

### Database Security
- Parameterized queries (via Prisma)
- Connection encryption
- Role-based access
- Regular backups

### Application Security
- Environment variable management
- Content Security Policy headers
- XSS protection
- SQL injection prevention

## Deployment Architecture

### Container Strategy
- Multi-stage Docker builds
- Alpine Linux for smaller images
- Non-root user execution
- Health checks

### Environment Configuration
- Development: docker-compose.dev.yml
- Production: docker-compose.yml
- CI/CD: GitHub Actions

### Service Dependencies
```yaml
webapp:
  depends_on:
    postgres:
      condition: service_healthy
```

## Error Handling Strategy

### API Layer
- Consistent error response format
- Proper HTTP status codes
- Detailed error messages in development
- Generic messages in production

### UI Layer
- Error boundaries for component failures
- Loading states for async operations
- User-friendly error messages
- Retry mechanisms

## Testing Strategy

### Unit Tests
- Business logic (ranking calculations)
- API route handlers
- Utility functions

### Integration Tests
- Database operations
- API endpoints
- Component interactions

### E2E Tests (Future)
- Critical user flows
- Data submission
- Dashboard interactions