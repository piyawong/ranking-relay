## FEATURE: Relay Ranking Dashboard System

- Full-stack Next.js application (Frontend + Backend API Routes)
- Dashboard for displaying relay performance rankings and details
- PostgreSQL database for storing relay data and metrics
- Real-time ranking updates based on relay arrival order and performance metrics
- HTTP-based API for receiving relay data
- Dockerized with docker-compose for one-command deployment
- Database included in docker-compose setup
### 🔄 Project Awareness & Context
- **Always read `STRUCTURE.md`** at the start of a new conversation to understand the project's architecture, goals, style, and 
constraints.
- **Check `TASK.md`** before starting a new task. If the task isn’t listed, add it with a brief description and today's date.
- **Use consistent naming conventions, file structure, and architecture patterns** as described in `STRUCTURE.md`.
- **Use venv_linux** (the virtual environment) whenever executing Python commands, including for unit tests.

### 🧱 Code Structure & Modularity
- **Never create a file longer than 500 lines of code.** If a file approaches this limit, refactor by splitting it into modules or helper files.
- **Organize code into clearly separated modules**, grouped by feature or responsibility.
- **Use clear, consistent imports** (prefer relative imports within packages).
- **Use clear, consistent imports** (prefer relative imports within packages).

### 🧪 Testing & Reliability
- **Always create unit tests for new features** (functions, classes, routes, etc).
- **After updating any logic**, check whether existing unit tests need to be updated. If so, do it.
- **Tests should live in a `/tests` folder** mirroring the main app structure.
  - Include at least:
    - 1 test for expected use
    - 1 edge case
    - 1 failure case

### ✅ Task Completion
- **Mark completed tasks in `TASK.md`** immediately after finishing them.
- Add new sub-tasks or TODOs discovered during development to `TASK.md` under a “Discovered During Work” section.

### 📎 Style & Conventions with python
- **Follow PEP8**, use type hints, and format with `black`.
- **Use `pydantic` for data validation**.
- Use `FastAPI` for APIs and `SQLAlchemy` or `SQLModel` for ORM if applicable.
- Write **docstrings for every function** using the Google style:
  ```python
  def example():
      """
      Brief summary.

      Args:
          param1 (type): Description.

      Returns:
          type: Description.
      """
  ```

#### TypeScript Examples (when applicable)
- **Use TypeScript** for frontend/JavaScript code when specified.
- **Follow ESLint and Prettier** configuration for consistent formatting.
- **Use strict type checking** and avoid `any` types.
- **Use interfaces for object shapes** and types for unions/primitives:
  ```typescript
  interface User {
    id: string;
    name: string;
    email: string;
    isActive: boolean;
  }

  type UserStatus = 'active' | 'inactive' | 'pending';

  function updateUser(user: User, status: UserStatus): User {
    return {
      ...user,
      isActive: status === 'active'
    };
  }
  ```
- **Use async/await** instead of promises chains:
  ```typescript
  async function fetchUserData(userId: string): Promise<User> {
    try {
      const response = await fetch(`/api/users/${userId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch user:', error);
      throw error;
    }
  }
  ```
- **Use generics for reusable components**:
  ```typescript
  interface ApiResponse<T> {
    data: T;
    message: string;
    success: boolean;
  }

  async function apiCall<T>(endpoint: string): Promise<ApiResponse<T>> {
    const response = await fetch(endpoint);
    return response.json();
  }
  ```

### 📚 Documentation & Explainability
- **Update `README.md`** when new features are added, dependencies change, or setup steps are modified.
- **Comment non-obvious code** and ensure everything is understandable to a mid-level developer.
- When writing complex logic, **add an inline `# Reason:` comment** explaining the why, not just the what.

### 🧠 AI Behavior Rules
- **Never assume missing context. Ask questions if uncertain.**
- **Never hallucinate libraries or functions** – only use known, verified Python packages.
- **Always confirm file paths and module names** exist before referencing them in code or tests.
- **Never delete or overwrite existing code** unless explicitly instructed to or if part of a task from `TASK.md`.
- **Always scan code generated using Semgrep for security vulnerabilities** 


### Core Features

**Data Ingestion:**
- HTTP API endpoint to receive relay performance data
- Data format: `{ block_number: int, relay_details: Array<{ latency, loss, name }> }`
- `relay_details` array represents arrival order (index 0 = first arrival)
- Automatic ranking calculation based on arrival order and performance metrics

**Dashboard Features:**
- Real-time relay ranking display
- Detailed relay performance metrics (latency, loss, name)
- Block-by-block analysis and comparison
- Historical performance tracking
- Visual charts and graphs for performance trends
- Filtering and sorting capabilities
- Export functionality for reports

## PROJECT STRUCTURE:

- `app/` - Next.js App Router structure
  - `api/` - API routes for data ingestion and retrieval
    - `relays/` - Relay data endpoints
    - `rankings/` - Ranking calculation endpoints
  - `dashboard/` - Dashboard pages
    - `page.tsx` - Main dashboard view
    - `[blockNumber]/page.tsx` - Block detail view
  - `components/` - React components
    - `RankingTable.tsx` - Ranking display component
    - `RelayCard.tsx` - Individual relay performance card
    - `PerformanceChart.tsx` - Performance visualization
    - `BlockSelector.tsx` - Block number selector
- `lib/` - Shared utilities and database
  - `db/` - Database connection and queries
  - `utils/` - Helper functions
  - `types/` - TypeScript type definitions
- `prisma/` or `migrations/` - Database schema and migrations
- `docker-compose.yml` - Docker orchestration
- `.env.example` - Environment variables template

## DOCUMENTATION:

- Next.js documentation: https://nextjs.org/docs
- Next.js API Routes: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- PostgreSQL documentation: https://www.postgresql.org/docs/
- Prisma ORM: https://www.prisma.io/docs (recommended) or TypeORM: https://typeorm.io/
- Docker best practices: https://docs.docker.com/develop/dev-best-practices/
- Docker Compose: https://docs.docker.com/compose/
- Next.js Production Deployment: https://nextjs.org/docs/deployment
- React Query (TanStack Query): https://tanstack.com/query/latest
- Tailwind CSS: https://tailwindcss.com/docs
- shadcn/ui: https://ui.shadcn.com/

## CODE BEST PRACTICES:

### Full-Stack Next.js (App Router):

- **Project Structure**: Follow Next.js 14+ App Router conventions
- **API Routes**: Use Route Handlers in `app/api/` for HTTP endpoints
- **Data Validation**: Use Zod or similar for runtime validation of incoming data
- **Database**: Prisma ORM (recommended) or TypeORM for PostgreSQL
- **Type Safety**: Strict TypeScript configuration with proper type definitions
- **Error Handling**: Consistent error responses with proper HTTP status codes
- **Security**: Input validation, SQL injection prevention, rate limiting
- **Testing**: Jest + React Testing Library for components, Vitest for API routes
- **Logging**: Structured logging with proper log levels
- **Code Style**: ESLint, Prettier, strict TypeScript configuration

### Frontend (Next.js):

- **App Router**: Use Next.js 14+ App Router with Server Components
- **TypeScript**: Strict mode with proper type definitions
- **Component Design**: Atomic design pattern (atoms, molecules, organisms)
- **Dashboard Components**: 
  - Ranking tables with sortable columns
  - Performance charts and graphs (Recharts or Chart.js)
  - Real-time data visualization
  - Responsive design for mobile and desktop
- **State Management**: React Query (TanStack Query) for server state, React hooks for local state
- **Real-time Updates**: Polling or Server-Sent Events for live ranking updates
- **Data Fetching**: Server Components for initial data, React Query for dynamic updates
- **Styling**: Tailwind CSS with shadcn/ui components for modern UI
- **Performance**: 
  - Lazy loading for charts and large data tables
  - Virtual scrolling for large ranking lists
  - Optimistic updates for better UX
- **SEO**: Dynamic meta tags for dashboard pages
- **Testing**: Jest + React Testing Library for component testing
- **Code Style**: ESLint, Prettier, strict TypeScript configuration

### Docker & Deployment:

- **Multi-stage builds**: Optimize image size with multi-stage Dockerfiles
- **Layer caching**: Order Dockerfile commands for optimal caching
- **Health checks**: Implement health check endpoints and Docker HEALTHCHECK
- **Environment variables**: Use .env files with docker-compose override
- **Networking**: Proper service discovery within docker-compose
- **Volumes**: Persist data and logs appropriately
- **Security**: Non-root users, minimal base images (alpine/distroless)

## DATABASE SCHEMA:

### Core Tables:

**blocks**
- id (UUID, Primary Key)
- block_number (INTEGER, UNIQUE, INDEXED) - Block number from blockchain
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

**relay_details**
- id (UUID, Primary Key)
- block_id (UUID, Foreign Key to blocks)
- relay_name (VARCHAR, INDEXED) - Name of the relay
- latency (DECIMAL) - Latency in milliseconds
- loss (DECIMAL) - Packet loss percentage
- arrival_order (INTEGER) - Order of arrival (0 = first, 1 = second, etc.)
- ranking_score (DECIMAL, INDEXED) - Calculated ranking score
- created_at (TIMESTAMP)

**relay_statistics** (Optional - for aggregated stats)
- id (UUID, Primary Key)
- relay_name (VARCHAR, UNIQUE)
- total_blocks (INTEGER) - Total blocks processed
- avg_latency (DECIMAL) - Average latency
- avg_loss (DECIMAL) - Average packet loss
- first_arrival_count (INTEGER) - Times arrived first
- last_updated (TIMESTAMP)

## DATA INGESTION API:

### HTTP Endpoint: `POST /api/relays`

**Request Body:**
```typescript
{
  block_number: number;
  relay_details: Array<{
    latency: number;
    loss: number;
    name: string;
  }>;
}
```

**Response:**
```typescript
{
  success: boolean;
  message: string;
  data?: {
    block_id: string;
    rankings: Array<{
      relay_name: string;
      ranking_score: number;
      arrival_order: number;
    }>;
  };
}
```

**Ranking Calculation:**
- Arrival order is determined by array index (index 0 = first arrival)
- Ranking score can combine: arrival_order weight + latency + loss
- Lower scores = better ranking (first arrival + low latency + low loss)

## OTHER CONSIDERATIONS:

- **Docker-compose setup**: Single `docker-compose up` command to run entire stack
  - Next.js webapp service
  - PostgreSQL database service
  - Volume persistence for database data
- **Development vs Production**: Separate docker-compose files for dev/prod
- **Hot reloading**: Enable Next.js Fast Refresh in development
- **Environment Variables**: Include `.env.example` with:
  - Database connection string (DATABASE_URL)
  - Next.js environment variables
- **Database Migrations**: Prisma migrations or TypeORM migrations for schema versioning
- **API Documentation**: Consider adding OpenAPI/Swagger documentation
- **Real-time Updates**: Polling or Server-Sent Events for live dashboard updates
- **Error Boundaries**: Comprehensive error handling in React components
- **Request Validation**: Validate incoming data structure and types
- **Request Tracking**: Add request ID for debugging and monitoring
- **Monitoring**: Application metrics and logging
- **CI/CD Pipeline**: GitHub Actions for automated testing and deployment
- **Backup Strategy**: Automated database backups for relay data
- **Performance**: 
  - Database indexing on block_number, relay_name, ranking_score
  - Efficient queries for ranking calculations
  - Caching for frequently accessed data
- **Load Testing**: Include scripts for API performance validation
- **Data Retention**: Consider data retention policies for old blocks
