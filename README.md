# Modern Fullstack Template

A production-ready monorepo template featuring TypeScript, Next.js 15, Elysia, Prisma, and Redis. Built for rapid development with enterprise-grade patterns.

## 🚀 Features

### Frontend (Next.js 15)
- **React 19**: Latest React with Server Components
- **TailwindCSS 4 Beta**: Modern utility-first CSS
- **Better Auth**: Full authentication system with social providers
- **Tanstack Query**: Powerful data fetching and caching
- **Sentry Integration**: Error tracking and monitoring
- **Storybook**: Component development environment
- **Ariakit**: Accessible UI components

### Backend (Elysia + Bun)
- **Elysia Framework**: Fast, type-safe API with excellent DX
- **Prisma ORM**: Type-safe database with migrations
- **Redis Dual Setup**: Separate cache and queue connections
- **OpenAPI/Scalar**: Auto-generated API documentation
- **Smart Middleware**: Resource context, user caching, error boundaries
- **Request Schemas**: Reusable patterns for CRUD operations

### Infrastructure
- **Docker Compose**: Multi-container orchestration
- **Monorepo Structure**: Organized with Bun workspaces
- **Type Safety**: End-to-end TypeScript with inference
- **Environment Validation**: Type-safe configuration
- **Feature Flags**: Conditional service loading

## 📁 Project Structure

```
template/
├── apps/
│   ├── api/                    # Elysia backend
│   │   ├── src/
│   │   │   ├── app/           # Application layer
│   │   │   │   ├── core/      # Core modules
│   │   │   │   │   ├── middleware/
│   │   │   │   │   ├── requestSchemas/
│   │   │   │   │   └── users/
│   │   │   │   ├── openApi.ts
│   │   │   │   └── app.ts
│   │   │   ├── config/        # Configuration
│   │   │   ├── db/           # Database schemas
│   │   │   ├── plugins/      # Elysia plugins
│   │   │   └── shared/       # Shared utilities
│   │   ├── env/              # Environment files
│   │   └── docker/           # Docker configuration
│   └── web/                  # Next.js frontend
│       ├── app/              # App router
│       ├── components/       # React components
│       ├── lib/              # Utilities
│       └── providers/        # React providers
├── packages/                 # Shared packages
├── scripts/                  # Build scripts
└── docker-compose.yml       # Container orchestration
```

## 🚦 Getting Started

### Prerequisites
- Docker and Docker Compose
- Bun runtime (latest version)
- Node.js 20+ (for web app)

### Quick Start

1. **Clone and setup**
   ```bash
   git clone <repository>
   cd template
   cp apps/api/env/.env.local.example apps/api/.env
   ```

2. **Configure environment**
   Update `.env` with your settings:
   ```env
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/api
   REDIS_CACHE_URL=redis://localhost:6379/0
   REDIS_QUEUE_URL=redis://localhost:6379/1
   BETTER_AUTH_SECRET=your-secret-here
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   ```

3. **Start services**
   ```bash
   # Start all services
   docker-compose up

   # In another terminal, setup database
   cd apps/api
   bun run db:push
   ```

4. **Access applications**
   - API: http://localhost:8000
   - API Docs: http://localhost:8000/docs
   - Web App: http://localhost:3000
   - Prisma Studio: `bun run db:studio`

## 🛠️ Development

### API Development

Create a new API endpoint:
```typescript
// apps/api/src/app/core/products/controllers/productsIndex.ts
export const productsIndex = async ({ db, query }) => {
  const products = await db.product.findMany({
    take: query.limit,
    skip: query.offset
  });
  
  return { 
    data: products,
    meta: { total: await db.product.count() }
  };
};
```

Add route with automatic OpenAPI documentation:
```typescript
// apps/api/src/app/core/products/routes/productRoutes.ts
import { resources } from 'src/app/core/requestSchemas';

export const productRoutes = new Elysia({ prefix: '/products' })
  .get('/', productsIndex, resources('product', productSchema, {
    pagination: true,
    tags: ['products']
  }));
```

### Frontend Development

Create typed API client calls:
```typescript
// apps/web/lib/api/products.ts
import { apiClient } from '@/lib/api-client';

export const getProducts = async () => {
  const response = await apiClient.get('/products');
  return response.data;
};
```

### Key Features

#### 🔐 Authentication
- Session-based auth with Better Auth
- Google OAuth pre-configured
- Protected routes with `requireAuth` flag
- User context caching

#### 🗄️ Smart Caching
- Redis caching with TTL
- Automatic user context caching
- Resource-level cache configuration
- Cache invalidation utilities

#### 📖 API Documentation
- Auto-generated from code
- Interactive Scalar UI
- Request/response schemas
- Authentication flows

#### 🧩 Middleware System
- Global error boundaries
- User context injection
- Resource context loading
- Request validation

## 📝 Scripts

### API Scripts
```bash
bun run dev          # Start development server
bun run build        # Build for production
bun run test         # Run tests
bun run db:generate  # Generate Prisma client
bun run db:push      # Push schema changes
bun run db:migrate   # Run migrations
bun run db:studio    # Open Prisma Studio
```

### Web Scripts
```bash
bun run dev          # Start Next.js dev server
bun run build        # Build for production
bun run lint         # Run linting
bun run storybook    # Start Storybook
```

## 🧪 Testing

```bash
# API tests
cd apps/api
bun run test
bun run test:watch

# Web tests
cd apps/web
bun run test
```

## 🚢 Deployment

### Docker Production Build
```bash
docker-compose -f docker-compose.prod.yml up --build
```

### Environment Variables
See `apps/api/env/.env.local.example` for all configuration options.

## 📚 Documentation

- API Documentation: Auto-generated at `/docs`
- Code conventions: See `apps/api/CLAUDE.md`
- Component library: Run Storybook with `bun run storybook`

## 🤝 Contributing

1. Follow established patterns and conventions
2. Use absolute imports from `src/`
3. Add tests for new functionality
4. Update OpenAPI schemas for new endpoints
5. Keep code clean and self-documenting