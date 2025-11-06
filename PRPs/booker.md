name: "Booker - Event Time Slot Booking System PRP"
description: |

## Purpose
Comprehensive PRP for implementing a full-stack event booking system with Next.js frontend, NestJS backend, PostgreSQL database, and Docker deployment. This PRP provides complete context for one-pass implementation success.

## Core Principles
1. **Context is King**: All necessary documentation, examples, and gotchas included
2. **Validation Loops**: Executable tests/lints for iterative refinement
3. **Information Dense**: Keywords and patterns from research
4. **Progressive Success**: Start simple, validate, then enhance
5. **Global rules**: Follow all rules in CLAUDE.md and INITIAL.md

---

## Goal
Build a production-ready event booking system that allows admins to create events with time slots, generate unique booking links, and enables users to book appointments with email confirmations and calendar integration. System must support real-time updates, team assignments, and be deployable via single docker-compose command.

## Why
- **Business Value**: Streamline event booking process, reduce manual coordination
- **User Impact**: Simple booking interface with calendar integration
- **Integration**: Standalone system with email and calendar services
- **Problems Solved**: Manual scheduling conflicts, missed appointments, team coordination

## What
Full-stack application featuring:
- Admin panel for event and team management
- Public booking interface with unique links
- Real-time slot availability updates
- Email confirmations with .ics calendar attachments
- Docker-based deployment

### Success Criteria
- [ ] Admin can create events with customizable time slots
- [ ] Unique booking links are generated per event
- [ ] Users can book slots via public interface
- [ ] Real-time availability updates via WebSocket
- [ ] Email confirmations sent with calendar attachments
- [ ] System deployable with single docker-compose command
- [ ] All tests passing with >80% coverage

## All Needed Context

### Documentation & References
```yaml
# MUST READ - Core Documentation
- url: https://docs.nestjs.com/
  why: NestJS framework fundamentals, modules, dependency injection
  
- url: https://typeorm.io/
  why: Database ORM for entity definitions, migrations, transactions
  
- url: https://nextjs.org/docs/app
  why: Next.js 14 App Router, Server Components, Server Actions
  
- url: https://ui.shadcn.com/
  why: UI component library for calendar and form components
  
- url: https://docs.sendgrid.com/
  why: Email API for sending confirmations with attachments
  
- url: https://www.npmjs.com/package/ics
  why: Generate RFC 5545 compliant .ics calendar files
  
- url: https://react-hook-form.com/
  why: Form handling and validation in React
  
- url: https://tanstack.com/query/latest
  why: Server state management and caching
  
- url: https://github.com/pmndrs/zustand
  why: Client state management for booking flow

- file: research/booker/architecture-planning.md
  why: Complete system architecture and database schema
  
- file: research/booker/external-research.md
  why: Technology-specific implementation details and gotchas
  
- file: INITIAL.md
  why: Original feature requirements and specifications
  
- file: CLAUDE.md
  why: Project conventions and coding standards
```

### Current Codebase Tree
```bash
# Fresh template project - no existing implementation
.
├── CLAUDE.md
├── INITIAL.md
├── PRPs/
│   └── templates/
└── research/
    └── booker/
```

### Desired Codebase Tree with Files
```bash
booker/
├── docker-compose.yml           # Orchestrates all services
├── docker-compose.dev.yml       # Development overrides
├── docker-compose.prod.yml      # Production configuration
├── .env.example                 # Environment template
├── README.md                    # Setup instructions
│
├── backend/                     # NestJS API
│   ├── Dockerfile              # Multi-stage build
│   ├── src/
│   │   ├── main.ts            # Application bootstrap
│   │   ├── app.module.ts      # Root module
│   │   ├── modules/
│   │   │   ├── auth/          # JWT authentication
│   │   │   ├── events/        # Event management
│   │   │   ├── bookings/      # Booking logic
│   │   │   ├── teams/         # Team management
│   │   │   ├── email/         # SendGrid integration
│   │   │   └── websockets/    # Real-time updates
│   │   └── database/
│   │       └── migrations/    # TypeORM migrations
│   └── test/                  # Test suites
│
├── frontend/                   # Next.js UI
│   ├── Dockerfile             # Multi-stage build
│   ├── src/
│   │   ├── app/              # App Router pages
│   │   │   ├── admin/        # Admin dashboard
│   │   │   └── book/[slug]/  # Public booking
│   │   ├── components/       # React components
│   │   └── lib/              # Utilities
│   └── tests/                # Test suites
│
└── database/
    └── init.sql              # Initial schema
```

### Known Gotchas & Library Quirks
```typescript
// CRITICAL: SendGrid .ics attachment configuration
// disposition: 'inline' DOES NOT WORK - must use 'attachment'
const attachment = {
  filename: 'booking.ics',
  content: base64Content,
  disposition: 'attachment', // NOT 'inline'
  type: 'text/calendar'
};

// CRITICAL: TypeORM database URL in Docker
// Must use service name 'postgres' not 'localhost'
DATABASE_URL="postgresql://user:pass@postgres:5432/db" // NOT @localhost

// CRITICAL: Next.js 14 Server Actions are stable
// Can be used for form submissions without API routes
async function createBooking(formData: FormData) {
  'use server';
  // Direct database operations here
}

// CRITICAL: PostgreSQL naming convention
// Use typeorm-naming-strategies package for snake_case
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

// CRITICAL: WebSocket CORS in production
// Must configure allowed origins explicitly
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true
  }
})

// CRITICAL: Real-time slot updates
// Use optimistic locking to prevent double-booking
@Version() // TypeORM versioning
version: number;

// CRITICAL: JWT token configuration
// Short access token (15min) with longer refresh (7d)
access_token_ttl: '15m'
refresh_token_ttl: '7d'

// CRITICAL: bcrypt rounds for production
// Minimum 12 rounds for security
const hashedPassword = await bcrypt.hash(password, 12);

// CRITICAL: React Query stale time for bookings
// 5 second refetch interval for availability
const { data } = useQuery({
  queryKey: ['slots', eventId],
  queryFn: fetchSlots,
  staleTime: 5000,
  refetchInterval: 5000
});
```

## Implementation Blueprint

### Data Models and Structure

```typescript
// backend/src/modules/events/entities/event.entity.ts
@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('text')
  description: string;

  @Column('timestamp')
  startTime: Date;

  @Column('timestamp')
  endTime: Date;

  @Column('int')
  periodMinutes: number;

  @Column({ unique: true })
  uniqueLink: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @ManyToMany(() => Team)
  @JoinTable({ name: 'event_teams' })
  teams: Team[];

  @OneToMany(() => TimeBlock, block => block.event)
  timeBlocks: TimeBlock[];

  @Column({ default: 'active' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// backend/src/modules/bookings/dto/create-booking.dto.ts
export class CreateBookingDto {
  @IsUUID()
  timeBlockId: string;

  @IsUUID()
  teamId: string;

  @IsString()
  @MinLength(2)
  firstName: string;

  @IsString()
  @MinLength(2)
  lastName: string;

  @IsEmail()
  email: string;

  @IsPhoneNumber()
  phone: string;

  @IsString()
  address: string;

  @IsOptional()
  @IsString()
  specialRequests?: string;
}
```

### List of Tasks to Complete (In Order)

```yaml
Task 1: Project Setup and Docker Configuration
CREATE docker-compose.yml:
  - PostgreSQL service with named volume
  - Backend service with hot reload
  - Frontend service with environment config
  - Network configuration for inter-service communication

CREATE .env.example:
  - Database credentials
  - JWT secrets
  - SendGrid API key
  - Frontend/Backend URLs

Task 2: Backend Foundation - NestJS Setup
CREATE backend/package.json:
  - Dependencies: @nestjs/core, @nestjs/typeorm, typeorm, pg
  - Dev dependencies: @types/node, typescript, jest

CREATE backend/src/main.ts:
  - Bootstrap NestJS application
  - Enable CORS with frontend origin
  - Global validation pipe
  - Swagger documentation setup

CREATE backend/src/app.module.ts:
  - Import TypeORM module with PostgreSQL config
  - Import feature modules
  - Configure global providers

Task 3: Database Schema and Migrations
CREATE backend/src/database/migrations/001-initial-schema.ts:
  - Users table with auth fields
  - Events table with time configuration
  - Teams table
  - Time blocks table with availability
  - Bookings table with user details
  - Junction tables and indexes

Task 4: Authentication Module
CREATE backend/src/modules/auth/:
  - JWT strategy with Passport.js
  - Login/refresh endpoints
  - Guards for protected routes
  - Password hashing with bcrypt

Task 5: Events Module
CREATE backend/src/modules/events/:
  - CRUD operations for events
  - Time block generation logic
  - Unique link generation
  - Team assignment endpoints

Task 6: Bookings Module  
CREATE backend/src/modules/bookings/:
  - Booking creation with transaction
  - Availability checking
  - Optimistic locking for conflicts
  - Booking reference generation

Task 7: Email Module with Calendar
CREATE backend/src/modules/email/:
  - SendGrid service integration
  - MJML email templates
  - ICS calendar file generation
  - Attachment configuration

Task 8: WebSocket Module
CREATE backend/src/modules/websockets/:
  - Socket.io gateway
  - Event rooms for real-time updates
  - Slot availability broadcasting

Task 9: Frontend Foundation - Next.js Setup
CREATE frontend/package.json:
  - Dependencies: next, react, typescript
  - UI: @shadcn/ui, tailwindcss
  - State: zustand, @tanstack/react-query
  - Forms: react-hook-form, zod

CREATE frontend/src/app/layout.tsx:
  - Root layout with providers
  - Global styles and fonts
  - Metadata configuration

Task 10: Admin Dashboard
CREATE frontend/src/app/admin/:
  - Authentication flow
  - Event management pages
  - Booking overview tables
  - Team management interface

Task 11: Public Booking Interface
CREATE frontend/src/app/book/[slug]/page.tsx:
  - Fetch event by unique link
  - Calendar grid component
  - Time slot selection
  - Booking form with validation

Task 12: Calendar Components
CREATE frontend/src/components/calendar/:
  - CalendarGrid with shadcn/ui
  - TimeSlotPicker component
  - Availability indicators
  - Real-time updates via WebSocket

Task 13: Booking Components
CREATE frontend/src/components/booking/:
  - Multi-step booking form
  - Team selection dropdown
  - Form validation with zod
  - Success confirmation display

Task 14: API Integration
CREATE frontend/src/lib/api/:
  - Axios/fetch configuration
  - Type-safe API clients
  - Error handling utilities
  - Authentication helpers

Task 15: State Management
CREATE frontend/src/lib/stores/:
  - Zustand store for booking flow
  - React Query configuration
  - WebSocket connection management

Task 16: Testing Implementation
CREATE backend/test/:
  - Unit tests for services
  - E2E tests for booking flow
  - Mock SendGrid service

CREATE frontend/tests/:
  - Component unit tests
  - Form validation tests
  - Booking flow E2E tests

Task 17: Docker Production Setup
CREATE backend/Dockerfile:
  - Multi-stage build with Alpine
  - Non-root user configuration
  - Health check endpoints

CREATE frontend/Dockerfile:
  - Next.js standalone build
  - Static asset optimization
  - Environment variable injection

Task 18: Documentation and Deployment
UPDATE README.md:
  - Setup instructions
  - Environment configuration
  - Docker commands
  - API documentation links
```

### Per-Task Pseudocode

```typescript
// Task 5: Time Block Generation
async function generateTimeBlocks(event: Event): Promise<TimeBlock[]> {
  // PATTERN: Generate all slots based on period
  const blocks: TimeBlock[] = [];
  let currentTime = new Date(event.startTime);
  const endTime = new Date(event.endTime);
  
  while (currentTime < endTime) {
    const blockEnd = new Date(currentTime);
    blockEnd.setMinutes(blockEnd.getMinutes() + event.periodMinutes);
    
    // CRITICAL: Check if block fits within event
    if (blockEnd <= endTime) {
      blocks.push({
        eventId: event.id,
        startTime: new Date(currentTime),
        endTime: blockEnd,
        status: 'available',
        currentBookings: 0
      });
    }
    
    currentTime = blockEnd;
  }
  
  // PATTERN: Bulk insert for performance
  return this.timeBlockRepository.save(blocks);
}

// Task 6: Booking Creation with Conflict Prevention
async function createBooking(dto: CreateBookingDto): Promise<Booking> {
  // PATTERN: Use transaction for consistency
  return this.dataSource.transaction(async manager => {
    // CRITICAL: Lock the time block row
    const timeBlock = await manager.findOne(TimeBlock, {
      where: { id: dto.timeBlockId },
      lock: { mode: 'pessimistic_write' }
    });
    
    // GOTCHA: Check availability within transaction
    if (timeBlock.status !== 'available') {
      throw new ConflictException('Slot no longer available');
    }
    
    // PATTERN: Generate unique reference
    const reference = `BK${Date.now()}${Math.random().toString(36).substr(2, 4)}`.toUpperCase();
    
    // Create booking
    const booking = manager.create(Booking, {
      ...dto,
      bookingReference: reference,
      status: 'confirmed'
    });
    
    // Update time block status
    timeBlock.currentBookings += 1;
    if (timeBlock.currentBookings >= event.maxBookingsPerSlot) {
      timeBlock.status = 'booked';
    }
    
    await manager.save(timeBlock);
    const savedBooking = await manager.save(booking);
    
    // PATTERN: Emit WebSocket event after transaction
    this.websocketGateway.emitSlotUpdate(timeBlock);
    
    // PATTERN: Send email asynchronously
    this.emailQueue.add('send-confirmation', { booking: savedBooking });
    
    return savedBooking;
  });
}

// Task 7: Calendar File Generation
function generateICSFile(booking: Booking, event: Event): string {
  // CRITICAL: Use ics library for RFC compliance
  const { error, value } = ics.createEvent({
    title: event.name,
    description: event.description,
    start: [
      booking.timeBlock.startTime.getFullYear(),
      booking.timeBlock.startTime.getMonth() + 1,
      booking.timeBlock.startTime.getDate(),
      booking.timeBlock.startTime.getHours(),
      booking.timeBlock.startTime.getMinutes()
    ],
    duration: { minutes: event.periodMinutes },
    location: booking.address,
    organizer: { name: 'Booker System', email: 'noreply@booker.com' },
    attendees: [{ name: `${booking.firstName} ${booking.lastName}`, email: booking.email }],
    status: 'CONFIRMED',
    busyStatus: 'BUSY',
    uid: booking.bookingReference,
    sequence: 0
  });
  
  if (error) {
    throw new Error('Failed to generate calendar file');
  }
  
  return value;
}

// Task 12: Real-time Slot Updates (Frontend)
function TimeSlotGrid({ eventId }: { eventId: string }) {
  // PATTERN: React Query for initial data
  const { data: slots, refetch } = useQuery({
    queryKey: ['slots', eventId],
    queryFn: () => api.getAvailableSlots(eventId),
    staleTime: 5000,
    refetchInterval: 5000
  });
  
  // PATTERN: WebSocket for real-time updates
  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_WS_URL);
    
    socket.emit('join-event', { eventId });
    
    socket.on('slot-updated', (update) => {
      // CRITICAL: Optimistic UI update
      queryClient.setQueryData(['slots', eventId], (old) => {
        return old.map(slot => 
          slot.id === update.slotId 
            ? { ...slot, status: update.status }
            : slot
        );
      });
      
      // Refetch to ensure consistency
      refetch();
    });
    
    return () => {
      socket.emit('leave-event', { eventId });
      socket.disconnect();
    };
  }, [eventId]);
  
  // PATTERN: Visual feedback for availability
  return (
    <div className="grid grid-cols-7 gap-2">
      {slots?.map(slot => (
        <button
          key={slot.id}
          disabled={slot.status !== 'available'}
          className={cn(
            'p-4 rounded-lg transition-colors',
            slot.status === 'available' && 'bg-green-100 hover:bg-green-200',
            slot.status === 'booked' && 'bg-gray-100 cursor-not-allowed'
          )}
          onClick={() => selectSlot(slot)}
        >
          {formatTime(slot.startTime)}
        </button>
      ))}
    </div>
  );
}
```

### Integration Points
```yaml
DATABASE:
  - migration: "Run TypeORM migrations on startup"
  - seeding: "Seed test data in development"
  - indexes: "Create indexes for performance"
  
CONFIG:
  - backend/.env:
    DATABASE_URL=postgresql://user:pass@postgres:5432/booker
    JWT_SECRET=your-secret-key
    JWT_REFRESH_SECRET=your-refresh-secret
    SENDGRID_API_KEY=your-sendgrid-key
    
  - frontend/.env.local:
    NEXT_PUBLIC_API_URL=http://localhost:3000
    NEXT_PUBLIC_WS_URL=ws://localhost:3000
  
DOCKER:
  - network: "booker_network for service communication"
  - volumes: "postgres_data for database persistence"
  - health: "Health checks for all services"
```

## Validation Loop

### Level 1: Backend Linting & Type Checking
```bash
# Run these FIRST - fix any errors before proceeding
cd backend
npm run lint                    # ESLint check
npm run format                   # Prettier format
npx tsc --noEmit                # TypeScript checking

# Expected: No errors. If errors, READ and fix.
```

### Level 2: Frontend Linting & Building
```bash
cd frontend
npm run lint                    # ESLint + Prettier
npm run type-check              # TypeScript validation
npm run build                   # Next.js production build

# Expected: Successful build. Fix any errors.
```

### Level 3: Backend Unit Tests
```bash
cd backend
npm run test                    # Jest unit tests
npm run test:cov               # Coverage report

# Expected: >80% coverage, all tests passing
```

### Level 4: Frontend Component Tests
```bash
cd frontend
npm run test                    # Jest + React Testing Library
npm run test:e2e               # Playwright E2E tests

# Expected: All tests passing
```

### Level 5: Docker Integration Test
```bash
# Start all services
docker-compose -f docker-compose.dev.yml up -d

# Wait for services to be ready
sleep 10

# Test health endpoints
curl http://localhost:3000/health
curl http://localhost:3001/health

# Test booking flow
curl -X GET http://localhost:3001/api/events/test-event

# Expected: 200 OK responses
```

### Level 6: Full Booking Flow Test
```bash
# 1. Create admin user (via seed or API)
# 2. Login as admin
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"Test123!"}' \
  | jq -r '.access_token')

# 3. Create event
EVENT_ID=$(curl -X POST http://localhost:3000/api/admin/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Test Event",
    "startTime":"2025-01-15T09:00:00Z",
    "endTime":"2025-01-15T17:00:00Z",
    "periodMinutes":30
  }' | jq -r '.id')

# 4. Get booking link
LINK=$(curl -X GET "http://localhost:3000/api/admin/events/$EVENT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  | jq -r '.uniqueLink')

# 5. Test public booking page
curl -X GET "http://localhost:3001/api/events/$LINK"

# Expected: Event details with available slots
```

## Final Validation Checklist
- [ ] All backend tests pass: `npm run test`
- [ ] All frontend tests pass: `npm run test`
- [ ] No linting errors: `npm run lint`
- [ ] No TypeScript errors: `npm run type-check`
- [ ] Docker services start successfully
- [ ] Can create events as admin
- [ ] Can book slots as user
- [ ] Emails sent with .ics attachments
- [ ] Real-time updates working
- [ ] Database migrations run cleanly
- [ ] API documentation accessible at /api/docs
- [ ] README.md complete with setup instructions

---

## Anti-Patterns to Avoid
- ❌ Don't use 'localhost' in Docker service URLs - use service names
- ❌ Don't skip database transactions for booking creation
- ❌ Don't use synchronous email sending - use queues
- ❌ Don't forget optimistic locking for slot booking
- ❌ Don't hardcode environment variables
- ❌ Don't skip input validation on any endpoint
- ❌ Don't use 'any' types in TypeScript
- ❌ Don't forget to handle WebSocket disconnections
- ❌ Don't expose internal errors to users
- ❌ Don't skip the .env.example file

## Additional Resources
- TypeORM Transactions: https://typeorm.io/transactions
- NestJS WebSockets: https://docs.nestjs.com/websockets/gateways
- Next.js Docker: https://github.com/vercel/next.js/tree/canary/examples/with-docker
- SendGrid Node.js: https://github.com/sendgrid/sendgrid-nodejs
- ICS Format: https://icalendar.org/RFC-Specifications/iCalendar-RFC-5545/

## Implementation Confidence Score: 9/10

This PRP provides comprehensive context including:
- Complete architecture and file structure
- All necessary documentation links
- Known gotchas and workarounds
- Detailed pseudocode for complex logic
- Executable validation gates
- Clear task ordering with dependencies

The only uncertainty is specific business logic nuances that may emerge during implementation, but the foundation is solid for one-pass success.