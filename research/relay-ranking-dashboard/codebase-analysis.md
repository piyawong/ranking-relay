# Codebase Analysis for Relay Ranking Dashboard

## Current Project State
- **Type**: Greenfield project (no existing codebase)
- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Deployment**: Docker + docker-compose

## Conventions to Follow (from INITIAL.md)

### Code Structure Requirements
- **File Length Limit**: Max 500 lines per file
- **Modular Design**: Organize code into clearly separated modules
- **Import Style**: Prefer relative imports within packages

### TypeScript Patterns
```typescript
// Use interfaces for object shapes
interface RelayData {
  block_number: number;
  relay_details: Array<{
    latency: number;
    loss: number;
    name: string;
  }>;
}

// Use types for unions/primitives
type RelayStatus = 'active' | 'inactive' | 'pending';

// Use generics for reusable components
interface ApiResponse<T> {
  data: T;
  message: string;
  success: boolean;
}
```

### API Pattern (Route Handlers)
- Location: `app/api/` directory
- Use Next.js 14+ Route Handlers with `route.ts` files
- Return type-safe responses using `NextResponse`

### Component Patterns
- Atomic design: atoms → molecules → organisms
- Server Components by default (Next.js 14+)
- Client Components only when needed (interactivity)

### Testing Requirements
- Unit tests for all new features
- Test structure mirrors app structure in `/tests`
- Include: expected use case, edge case, failure case

### Documentation Style
- Google-style docstrings for functions
- Inline `# Reason:` comments for complex logic
- Update README.md for new features