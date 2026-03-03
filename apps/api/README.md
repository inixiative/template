# API Template

A production-ready API template built with Elysia, Prisma, and Redis, featuring automatic OpenAPI documentation, authentication, and caching.

## Features

### Core Infrastructure
- **Elysia Framework**: Fast, type-safe web framework with excellent DX
- **Docker Compose**: Multi-container setup for API, PostgreSQL, and Redis
- **Environment Configuration**: Type-safe env validation with configurable flags
- **Modular Plugin Architecture**: Conditional loading of features based on environment

### Database & ORM
- **Prisma ORM**: Type-safe database access with migrations
- **PostgreSQL**: Primary database with native array support
- **Multi-file Schema**: Organized schema split across multiple files
- **Auto-generated Types**: Full TypeScript support from database schema

### Authentication & Security
- **Better-Auth Integration**: Session-based authentication with multiple providers
- **User Context Middleware**: Automatic user loading with Redis caching
- **Protected Routes**: Simple `requireAuth` flag for route protection
- **Google OAuth**: Pre-configured social authentication

### API Documentation
- **OpenAPI/Swagger**: Automatic API documentation generation
- **Scalar UI**: Beautiful, interactive API documentation at `/docs`
- **Request Schema Templates**: Reusable patterns for CRUD operations
- **Type Generation**: Automatic Elysia schemas from Prisma models

### Caching & Performance
- **Redis Integration**: Dual Redis connections for cache and queues
- **Smart Caching**: Automatic user context caching with TTL
- **Cache Utilities**: Pattern-based cache clearing and management
- **BullMQ Integration**: Production-ready job queue with worker processing

### Observability & Monitoring
- **OpenTelemetry**: Full tracing and metrics support
- **Job Telemetry**: Automatic job processing metrics and spans
- **HTTP Telemetry**: Request/response tracking with durations
- **Custom Metrics**: Business logic metrics support
- **Queue Dashboard**: Bull Board UI at `/api/admin/queues`

### Developer Experience
- **Absolute Imports**: Clean imports from `src/`
- **Consistent Patterns**: `resourceAction` naming for controllers
- **Error Handling**: Global error boundary middleware
- **Hot Reloading**: Development with watch mode
- **Type Safety**: End-to-end TypeScript with inference

## Project Structure

```
src/
├── app/
│   ├── index.ts           # Application entry point
│   ├── app.ts             # Main app configuration
│   ├── openapi.ts         # OpenAPI/Scalar documentation
│   ├── apiRoutes.ts       # API route aggregation
│   ├── core/
│   │   ├── middleware/    # Global middleware
│   │   │   ├── errorBoundary.ts
│   │   │   ├── userContext.ts
│   │   │   └── telemetry.ts      # HTTP telemetry
│   │   ├── requestSchemas/  # Reusable OpenAPI schemas
│   │   │   ├── create.ts
│   │   │   ├── resource.ts
│   │   │   ├── resources.ts
│   │   │   ├── update.ts
│   │   │   ├── delete.ts
│   │   │   └── pagination.ts
│   │   ├── schemas/       # Type generation utilities
│   │   │   ├── prismaToElysia.ts
│   │   │   └── jsonTypes/
│   │   └── users/         # User module
│   │       ├── routes/
│   │       ├── controllers/
│   │       └── schemas/
│   └── admin/            # Admin module
│       ├── adminRoutes.ts
│       └── queue/
│           ├── routes/
│           └── controllers/
├── base.ts                # Base Elysia instance
├── config/               # Configuration
│   ├── envSchema.ts      # Environment validation
│   └── loadEnv.ts        # Env loading logic
├── db/
│   └── prisma/          # Database schema
├── plugins/             # Elysia plugins
│   ├── auth.ts          # Better-auth integration
│   ├── db.ts            # Prisma client
│   ├── redis.ts         # Redis connections
│   ├── queue.ts         # BullMQ queue setup
│   └── telemetry.ts     # OpenTelemetry setup
├── telemetry/           # Telemetry configuration
│   └── index.ts         # OTEL SDK and metrics
├── worker/              # Background job processing
│   ├── index.ts         # Worker entry point
│   ├── worker.ts        # Worker Elysia instance
│   └── processJob.ts    # Job handlers
└── shared/
    └── cache/           # Caching utilities

```

## Getting Started

### Prerequisites
- Docker and Docker Compose
- Bun runtime

### Setup

1. Clone the repository
2. Copy `.env.example` to `.env` and configure
3. Start the services:

```bash
# Start all services
docker-compose up

# Or run specific services
bun run start         # Start API and Worker
bun run db:push      # Push database schema
bun run db:migrate   # Run migrations
bun run db:studio    # Open Prisma Studio
```

### Environment Variables

Key environment variables (see `.env.example`):

```env
# Environment
ENVIRONMENT=local
PORT=8000

# Database
DATABASE_URL=postgresql://...

# Redis
REDIS_CACHE_URL=redis://redis:6379/0
REDIS_QUEUE_URL=redis://redis:6379/1

# Auth
BETTER_AUTH_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Feature Flags
OTEL_ENABLED=false
```

## Usage Examples

### Creating a New Route

```typescript
// src/app/core/products/routes/productRoutes.ts
import { Elysia } from 'elysia';
import { resource, resources, create } from 'src/app/core/requestSchemas';
import { prismaModelToElysiaSchema } from 'src/app/core/schemas/prismaToElysia';

const productSchema = prismaModelToElysiaSchema('Product');

export const productRoutes = new Elysia({ name: 'productRoutes', prefix: '/products' })
  .get('/', productsIndex, resources('product', productSchema, { 
    pagination: true,
    tags: ['products'] 
  }))
  .get('/:id', productsShow, resource('product', productSchema, { 
    tags: ['products'] 
  }))
  .post('/', productsCreate, create('product', productSchema, { 
    requireAuth: true,
    tags: ['products'] 
  }));
```

### Adding a Protected Route

```typescript
.get('/profile', profileController, resource('user', userSchema, {
  noId: true,
  requireAuth: true,  // Automatically requires authentication
  tags: ['users']
}))
```

### Using Cache

```typescript
import { cache } from 'src/shared/cache';

const data = await cache(
  redis.cache,
  `product:${id}`,
  async () => {
    return await db.product.findUnique({ where: { id } });
  },
  3600 // TTL in seconds
);
```

### Adding Background Jobs

```typescript
// Queue a job
await addJob('email', {
  to: 'user@example.com',
  subject: 'Welcome!',
  template: 'welcome'
});

// Define job handler in worker/processJob.ts
const jobHandlers: Record<string, (payload: any) => Promise<void>> = {
  email: async (payload) => {
    await sendEmail(payload);
  }
};
```

### Adding Custom Metrics

```typescript
// In your controller
const { metrics } = context;

metrics.customMetric?.add(1, {
  action: 'user_signup',
  provider: 'google'
});
```

### Custom JSON Types

```typescript
// src/app/core/schemas/jsonTypes/product.ts
export const productJsonTypes = {
  metadata: t.Object({
    sku: t.String(),
    weight: t.Number(),
    dimensions: t.Object({
      width: t.Number(),
      height: t.Number(),
      depth: t.Number()
    })
  })
};
```

## Testing

```bash
# Run tests
bun run test

# Watch mode
bun run test:watch
```

## API Documentation

Once running, visit:
- API Documentation: http://localhost:8000/docs
- Health Check: http://localhost:8000/health
- Queue Dashboard: http://localhost:8000/api/admin/queues

## Scripts

- `bun run docker:bun` - Run bun commands in Docker
- `bun run setup` - Initial project setup
- `bun run reset` - Reset the project
- `bun run db:generate` - Generate Prisma client
- `bun run db:push` - Push schema to database
- `bun run db:migrate` - Run migrations
- `bun run db:studio` - Open Prisma Studio

## Contributing

1. Follow the established patterns for consistency
2. Use absolute imports from `src/`
3. Add appropriate TypeScript types
4. Include OpenAPI documentation for new routes
5. Write tests for new functionality

## License

[Your License]
