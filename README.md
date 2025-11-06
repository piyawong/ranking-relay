# Relay Ranking Dashboard

A real-time performance monitoring and ranking dashboard for relay networks built with Next.js 14, TypeScript, PostgreSQL, and Docker.

## Features

- **Real-time Dashboard**: Live updates of relay performance metrics with 5-second polling intervals
- **Performance Rankings**: Automatic ranking calculation based on arrival order, latency, and packet loss
- **Historical Data**: Track and visualize relay performance over time
- **RESTful API**: HTTP endpoints for data ingestion and retrieval
- **Docker Deployment**: One-command deployment with docker-compose
- **Responsive UI**: Modern, mobile-friendly interface built with Tailwind CSS and shadcn/ui

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, React Query, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL 15
- **Deployment**: Docker, Docker Compose
- **UI Components**: shadcn/ui, Recharts
- **Validation**: Zod

## Quick Start

### Prerequisites

- Node.js 20+ (for local development)
- Docker and Docker Compose (for containerized deployment)
- PostgreSQL (for local development without Docker)

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ranking-node
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Update `.env` with your database credentials.

4. **Start PostgreSQL** (using Docker)
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

5. **Run database migrations**
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

6. **Seed the database** (optional, for demo data)
   ```bash
   npm run db:seed
   ```

7. **Start the development server**
   ```bash
   npm run dev
   ```

   Visit [http://localhost:3000](http://localhost:3000)

### Docker Deployment

1. **Build and start all services**

   **Option 1: Using Debian-based image (Recommended for production)**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

   **Option 2: Using Alpine-based image**
   ```bash
   docker-compose up -d
   ```

   This will:
   - Build the Next.js application
   - Start PostgreSQL database
   - Run database migrations
   - Start the web application

   **Note**: If you encounter Prisma compatibility issues, use the Debian-based Dockerfile (`docker-compose.prod.yml`) which has better compatibility with Prisma's binary dependencies.

2. **Access the application**
   - Dashboard: [http://localhost:3000/dashboard](http://localhost:3000/dashboard)
   - API Health: [http://localhost:3000/api/health](http://localhost:3000/api/health)

## API Documentation

### POST /api/relays
Submit relay performance data for a block.

**Request Body:**
```json
{
  "block_number": 1000,
  "relay_details": [
    {
      "name": "relay-alpha",
      "latency": 12.5,
      "loss": 0.3
    },
    {
      "name": "relay-beta",
      "latency": 15.2,
      "loss": 0.5
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Relay data recorded successfully",
  "data": {
    "block_id": "uuid",
    "rankings": [
      {
        "relay_name": "relay-alpha",
        "ranking_score": 3.85,
        "arrival_order": 0
      }
    ]
  }
}
```

### GET /api/relays/[blockNumber]
Get data for a specific block.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "block_number": 1000,
    "created_at": "2024-01-01T00:00:00Z",
    "relay_details": [...]
  }
}
```

### GET /api/rankings
Get current rankings with optional filters.

**Query Parameters:**
- `limit` (number): Maximum results to return (default: 20)
- `offset` (number): Pagination offset (default: 0)
- `relayName` (string): Filter by relay name
- `blockNumber` (number): Filter by block number

### GET /api/statistics
Get aggregated relay statistics.

**Query Parameters:**
- `relayName` (string): Get stats for specific relay
- `limit` (number): Maximum results (default: 10)

### GET /api/health
Health check endpoint for monitoring.

## Database Schema

The application uses three main tables:

- **Block**: Stores block information
- **RelayDetail**: Stores individual relay performance data
- **RelayStatistics**: Stores aggregated statistics per relay

## Ranking Algorithm

Rankings are calculated using a weighted scoring system:
- **Arrival Order**: 50% weight
- **Latency**: 30% weight
- **Packet Loss**: 20% weight

Lower scores indicate better performance (similar to race positions).

## Project Structure

```
ranking-node/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── dashboard/         # Dashboard pages
│   └── components/        # React components
├── lib/                   # Shared utilities
│   ├── db/               # Database queries
│   ├── types/            # TypeScript types
│   └── utils/            # Helper functions
├── prisma/               # Database schema and migrations
├── docker/               # Docker configuration
└── tests/                # Test files
```

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm test            # Run tests
npm run db:migrate  # Run database migrations
npm run db:seed     # Seed database with sample data
```

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/relay_db

# Next.js
NEXT_PUBLIC_API_URL=http://localhost:3000

# Environment
NODE_ENV=development
```

## Testing

Run the test suite:
```bash
npm test
npm run test:coverage
```

## Performance Considerations

- Database indexes on frequently queried fields
- React Query caching for API responses
- Virtual scrolling for large datasets (planned)
- Optimistic updates for better UX
- Connection pooling via Prisma

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## Troubleshooting

### Prisma Engine Compatibility Error

If you see errors like `Error loading shared library libssl.so.1.1`, this is a Prisma compatibility issue with Alpine Linux.

**Solutions:**

1. **Use the Debian-based Dockerfile (Recommended)**:
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

2. **Regenerate Prisma Client with correct binaries**:
   ```bash
   npx prisma generate
   ```

3. **For local development**, ensure PostgreSQL is running:
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

### Database Connection Issues

If the application can't connect to the database:

1. Ensure PostgreSQL is running:
   ```bash
   docker ps | grep postgres
   ```

2. Check database credentials in `.env`:
   ```
   DATABASE_URL=postgresql://relay_user:relay_pass@localhost:5432/relay_db
   ```

3. Run migrations:
   ```bash
   npx prisma migrate dev
   ```

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.