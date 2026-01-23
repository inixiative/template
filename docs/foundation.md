# Inixiative Platform Foundation

This document explains the core architecture, patterns, and conventions used in the Inixiative platform.

## Overview

Inixiative is an industry-agnostic tokenized investment platform. It provides:
- User authentication & KYC
- Pool/project creation with industry templates
- Investment & tokenization (ERC-20)
- Escrow & milestone payouts
- Off-chain governance
- Secondary market trading

**Livestock** is the first vertical (cattle tokenization), but the platform supports any industry.

---

## Project Structure

```
inixiative/
├── apps/
│   ├── api/                 # Hono backend
│   │   ├── src/
│   │   │   ├── config/      # Environment, OTel setup
│   │   │   ├── lib/
│   │   │   │   ├── cache/   # Redis cache utilities
│   │   │   │   ├── clients/ # External service clients (S3, Stripe, Redis)
│   │   │   │   ├── prisma/  # Transaction helpers
│   │   │   │   ├── requestTemplates/  # Route factories
│   │   │   │   └── utils/   # makeController, etc.
│   │   │   ├── middleware/
│   │   │   │   ├── auth/    # JWT verification
│   │   │   │   ├── context/ # Type-safe context helpers
│   │   │   │   └── error/   # Error formatting & responses
│   │   │   ├── modules/     # Feature modules (auth, pools, etc.)
│   │   │   ├── jobs/        # BullMQ queue workers
│   │   │   └── types/       # AppEnv, AppVars
│   │   └── tests/           # Test utilities, factories, mocks
│   │
│   └── web/                 # React frontend (Vite)
│       └── src/
│           ├── hooks/       # useAuth, etc.
│           ├── pages/       # Login, Signup, Dashboard
│           ├── components/  # ProtectedRoute, etc.
│           └── lib/         # API client
│
├── packages/
│   └── db/                  # Prisma schema & client
│       ├── prisma/
│       │   └── schema.prisma
│       └── src/
│           ├── client.ts           # Extended Prisma client
│           ├── typedModelIds.ts    # Phantom types for IDs
│           └── extensions/
│               ├── mutationLifeCycle.ts  # Before/after hooks
│               ├── cacheReference.ts     # Cache key mappings
│               ├── clearCacheHook.ts     # Cache invalidation
│               └── webhookHook.ts        # Webhook delivery
│
└── docs/                    # Documentation
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Bun |
| API Framework | Hono + @hono/zod-openapi |
| Database | PostgreSQL + Prisma |
| Queue | BullMQ + Redis |
| Frontend | React + Vite |
| Auth | JWT (token-based) |
| Blockchain | Arbitrum + Ethereum (EVM) |
| Observability | OpenTelemetry → BetterStack |
| Environment | Doppler |

---

## Core Patterns

### 1. Typed Model IDs

Phantom types prevent accidentally passing a `UserId` where a `PoolId` is expected.

```typescript
import { userId, poolId, type UserId, type PoolId } from '@template/db';

// Correct
const user = await db.user.findUnique({ where: { id: userId('abc-123') } });

// Compile-time error: Type 'PoolId' is not assignable to type 'UserId'
const user = await db.user.findUnique({ where: { id: poolId('xyz-789') } });
```

Location: `packages/db/src/typedModelIds.ts`

### 2. Mutation Lifecycle Hooks

Run code before/after database mutations without polluting business logic.

```typescript
import { registerDbHook, DbAction, HookTiming } from '@template/db';

// Log all user creations
registerDbHook({
  model: 'User',
  action: DbAction.CREATE,
  timing: HookTiming.AFTER,
  handler: async ({ result }) => {
    console.log('User created:', result.id);
  },
});
```

Location: `packages/db/src/extensions/mutationLifeCycle.ts`

### 3. Request Templates (makeController)

Type-safe route handlers with automatic OpenAPI documentation.

```typescript
import { createRoute } from '@hono/zod-openapi';
import { makeController } from '@src/lib/utils/makeController';

const route = createRoute({
  method: 'get',
  path: '/users/{id}',
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { content: { 'application/json': { schema: UserSchema } } } },
});

const handler = makeController(route, async (c, respond) => {
  const user = await db.user.findUnique({ where: { id: c.req.param('id') } });
  return respond[200](user);
});
```

Location: `apps/api/src/lib/utils/makeController.ts`

### 4. Transaction Context

Automatic transaction reuse for nested database operations.

```typescript
import { runWithTransaction } from '@src/lib/prisma/runWithTransaction';

await runWithTransaction(c, async (txn) => {
  const investment = await txn.investment.create({ data: {...} });
  await txn.escrow.update({ where: { poolId }, data: {...} });
  // If either fails, both roll back
});
```

Location: `apps/api/src/lib/prisma/runWithTransaction.ts`

### 5. Type-Safe Context

Strongly-typed wrappers around Hono's context.

```typescript
import { setContextValue, getContextValue } from '@src/middleware/context';

// Set (type-checked)
setContextValue(c, 'user', { id: '123', email: 'test@example.com' });

// Get (returns correct type)
const user = getContextValue(c, 'user'); // { id: string; email: string } | null
```

Location: `apps/api/src/middleware/context/`

### 6. Error Handling

Environment-aware error responses.

```typescript
import { respond500, respond422, formatZodIssues } from '@src/middleware/error';

// Validation error (shows field-level issues)
return respond422(c, formatZodIssues(zodError));

// Server error (hides stack in production)
return respond500(c, error);
```

Location: `apps/api/src/middleware/error/`

### 7. Cache Invalidation

Declarative cache invalidation via mutation hooks.

```typescript
// packages/db/src/extensions/cacheReference.ts
export const cacheReference = {
  User: (record) => [`users:${record.id}`, `users:email:${record.email}`],
  Pool: (record) => [`pools:${record.id}`, `pools:slug:${record.slug}`],
  // ...
};
```

When a model is mutated, the hook automatically clears matching cache keys:

```typescript
// Registration (in app startup)
import { registerClearCacheHook } from '@template/db';
import { clearCacheKey } from '@src/lib/cache';

registerClearCacheHook(clearCacheKey);
```

Location: `packages/db/src/extensions/cacheReference.ts`, `packages/db/src/extensions/clearCacheHook.ts`

### 8. Webhooks

Automatic webhook delivery when models change.

```typescript
// Registration (in app startup)
import { registerWebhookHook } from '@template/db';

registerWebhookHook(async (payload) => {
  // payload: { model, action, resourceId, data, previousData, timestamp }
  await enqueue('deliverWebhook', payload);
});
```

Webhook subscriptions are stored in the database:

```typescript
await db.webhookSubscription.create({
  data: {
    model: 'Investment',
    url: 'https://example.com/webhooks',
    ownerType: 'Pool',
    ownerId: poolId,
    secret: 'webhook-secret-for-hmac',
  },
});
```

Location: `packages/db/src/extensions/webhookHook.ts`, `packages/db/prisma/schema.prisma`

---

## Environment Configuration

### Local Development

Copy `.env.example` to `.env` and fill in values:

```bash
cp .env.example .env
```

### Doppler (Production/Staging)

Environment variables are managed via Doppler. The API reads them directly - no prefixes needed.

```bash
# Run with Doppler
doppler run -- bun run dev

# Or inject into your shell
eval $(doppler secrets download --no-file --format env)
```

### Required Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `REDIS_URL` | Redis connection string | Yes |
| `JWT_SECRET` | Secret for signing JWTs | Yes (use strong key in prod) |
| `CORS_ORIGIN` | Allowed origin for CORS | Yes |

### Optional Integrations

| Variable | Description |
|----------|-------------|
| `SENTRY_DSN` | Sentry error tracking |
| `AWS_*` | S3 for document storage |
| `STRIPE_*` | Fiat payment processing |
| `OTEL_*` | OpenTelemetry/BetterStack |

---

## Integration Clients

Lazy-loaded clients for external services. Only initialize when needed.

```typescript
import { getS3Client, getStripeClient, getRedisClient } from '@src/lib/clients';

// Only loads S3 SDK when this line runs
const s3 = await getS3Client();
```

Location: `apps/api/src/lib/clients/`

---

## File Uploads (Presigned URLs)

Direct-to-S3 uploads using presigned URLs:

```typescript
import { generatePresignedUrl } from '@src/modules/files';

// 1. Client requests presigned URL
const { presignedUrl, fileUrl, maxSize } = await generatePresignedUrl(c, {
  fileName: 'avatar.png',
  contentType: 'image/png',
  folder: 'avatars', // optional
});

// 2. Client uploads directly to S3 (PUT request to presignedUrl)
// 3. Client uses fileUrl (CDN) for display
```

**Supported types:**
- Images: JPEG, PNG, GIF, WebP, SVG (max 10MB, SVG 2MB)
- Video: MP4, WebM (max 100MB)
- Documents: PDF (max 20MB)

**Security:**
- Filename sanitized (no path traversal)
- Content type whitelist
- User ID embedded in S3 key
- 1-hour URL expiration

Location: `apps/api/src/modules/files/`

---

## Observability (OpenTelemetry)

Traces and metrics are sent to BetterStack (or any OTLP-compatible backend).

**Setup:**
1. Set `OTEL_EXPORTER_OTLP_ENDPOINT` (e.g., `https://in-otel.logs.betterstack.com`)
2. Set `OTEL_EXPORTER_OTLP_HEADERS` (e.g., `Authorization=Bearer <token>`)
3. Optionally set `OTEL_SERVICE_NAME` (defaults to `inixiative-api`)

**What's traced:**
- HTTP requests (except `/health`)
- Prisma database queries
- Custom spans you add

**Skipped in:** `local` and `test` environments

Location: `apps/api/src/config/otel.ts`

---

## Job Queue (BullMQ)

Background jobs for long-running tasks.

```typescript
import { enqueue } from '@src/jobs/enqueue';

// Queue a job
await enqueue('sendEmail', { to: 'user@example.com', template: 'welcome' });
```

Workers process jobs in `apps/api/src/jobs/worker.ts`.

---

## Authentication

Token-based JWT authentication.

**Flow:**
1. User signs up/logs in → receives JWT
2. Frontend stores JWT in localStorage
3. Frontend sends `Authorization: Bearer <token>` header
4. `authMiddleware` validates and sets `c.get('user')`

**Endpoints:**
- `POST /auth/signup` - Create account
- `POST /auth/login` - Get token
- `GET /auth/me` - Get current user (requires auth)

Location: `apps/api/src/modules/auth/`

---

## Testing

```bash
# Run all tests
bun test

# Run with coverage
bun test --coverage
```

**Test utilities:**
- `createTestApp()` - Creates isolated app instance
- `factories/` - Generate test data
- `mocks/` - Mock clients (DB, S3, AI)
- `helpers/createFixtureLoader` - Load JSON fixtures

### VCR Pattern (for AI/External APIs)

Queue-based response manager for deterministic tests:

```typescript
import { createMockAnthropicClient } from 'tests/mocks';
import { createFixtureLoader } from 'tests/helpers';

const load = createFixtureLoader(__dirname + '/fixtures');
const { client, vcr } = createMockAnthropicClient();

// Pre-load responses
vcr.set([load('chatResponse1'), load('chatResponse2')]);

// Each call pops the next response
const response1 = await client.messages.create({...}); // chatResponse1
const response2 = await client.messages.create({...}); // chatResponse2
```

**Available mocks:**
- `createMockDb()` - Prisma client
- `createMockS3Client()` - S3 with in-memory storage
- `createMockAnthropicClient()` - Claude API with VCR
- `createMockOpenAIClient()` - GPT + embeddings with VCR

Location: `apps/api/tests/`

---

## Scripts

```bash
# Development
bun run dev              # Start API with hot reload
bun run dev:web          # Start frontend

# Database
bun run db:generate      # Generate Prisma client
bun run db:migrate       # Run migrations
bun run db:studio        # Open Prisma Studio

# Build
bun run build            # Build all packages
bun run typecheck        # Type check without emitting

# Lint
bun run lint             # Run Biome linter
bun run format           # Format code
```

---

## Adding a New Feature

1. **Define the schema** in `packages/db/prisma/schema.prisma`
2. **Add typed IDs** in `packages/db/src/typedModelIds.ts`
3. **Add cache keys** in `packages/db/src/extensions/cacheReference.ts` (if caching needed)
4. **Run migrations**: `bun run db:migrate`
5. **Create module** in `apps/api/src/modules/<feature>/`
   - `routes.ts` - Route definitions
   - `handlers.ts` - Request handlers
   - `services/` - Business logic
6. **Register routes** in `apps/api/src/app.ts`
7. **Add tests** in `apps/api/tests/`
8. **Add webhooks** (optional) - Add model to `WEBHOOK_ENABLED_MODELS` in `webhookHook.ts`

---

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Token-based auth (not sessions) | Simpler, stateless, works well with mobile/API clients |
| PostgreSQL (not MySQL) | Better JSON support, array types, more features |
| Hono (not Express) | Faster, better TypeScript support, built for edge |
| Vite (not Next.js) | Simpler for SPA, no SSR complexity needed |
| Typed model IDs | Prevents ID mix-ups in financial operations |
| Lazy client initialization | Don't pay for what you don't use |

---

## Security Considerations

- **JWT secrets**: Use strong, unique secrets in production
- **CORS**: Restrict to known origins
- **Input validation**: All inputs validated via Zod schemas
- **SQL injection**: Prisma parameterizes all queries
- **Sensitive data**: Never log passwords, tokens, or PII
- **Rate limiting**: TODO - add rate limiting middleware

## Privacy Principles

- **Completed/canceled pools are hidden** - Once a pool moves past interest gathering, it's only visible to participants (investors, operators, staff)
- **Err toward privacy** - When in doubt, restrict access rather than expose
- **Investment data is sensitive** - User investment amounts, holdings, and transactions are private to the user and pool operators
- **KYC data isolation** - KYC status is visible, but underlying documents and verification details are not exposed via API
