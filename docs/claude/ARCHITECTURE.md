# Architecture

## Contents

- [Overview](#overview)
- [Request Flow](#request-flow)
- [Data Flow](#data-flow)
- [Key Patterns](#key-patterns)

---

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                           Clients                                │
│                  (Web, Admin, Mobile, API)                       │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         apps/api                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Middleware │→ │   Routes    │→ │ Controllers │              │
│  │  (auth,     │  │  (OpenAPI)  │  │  (logic)    │              │
│  │   context)  │  └─────────────┘  └──────┬──────┘              │
│  └─────────────┘                          │                      │
│                                           ▼                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Mutation Lifecycle                    │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐     │    │
│  │  │  Rules  │  │Immutable│  │  Cache  │  │Webhooks │     │    │
│  │  │  Hook   │  │ Fields  │  │  Hook   │  │  Hook   │     │    │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │    Jobs     │  │    Redis    │  │  Postgres   │              │
│  │  (BullMQ)   │  │   (cache)   │  │  (Prisma)   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       packages/db                                │
│           Prisma client, extensions, hooks registry              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Request Flow

```
Request
  │
  ├─► prepareRequest     # Initialize context (db, requestId, permix)
  ├─► authMiddleware     # Session auth (BetterAuth)
  ├─► spoofMiddleware    # Superadmin impersonation
  ├─► tokenAuthMiddleware # API token auth
  │
  ├─► Route middleware   # validateUser, validateOrgPermission, etc.
  ├─► Controller         # Business logic
  │     │
  │     └─► db.model.create/update/delete
  │           │
  │           └─► Mutation Lifecycle (automatic)
  │                 ├─► before hooks (rules, immutable fields)
  │                 ├─► Prisma operation
  │                 ├─► after hooks (cache, webhooks)
  │                 └─► onCommit callbacks
  │
  └─► Response (wrapped in { data })
```

---

## Data Flow

### Write Path

```
Controller
  └─► db.user.create({ data })
        │
        ├─► [Transaction auto-started]
        ├─► beforeCreate hooks
        │     ├─► Rules validation
        │     └─► Strip immutable fields
        │
        ├─► Prisma INSERT
        │
        ├─► afterCreate hooks
        │     ├─► Queue cache invalidation (onCommit)
        │     └─► Queue webhook delivery (onCommit)
        │
        └─► [Transaction commits]
              └─► onCommit callbacks fire
                    ├─► Clear cache keys
                    └─► Enqueue sendWebhook job
```

### Read Path

```
Controller
  └─► db.user.findUnique({ where: { id } })
        │
        └─► Prisma SELECT (no hooks, no transaction)
```

---

## Key Patterns

### Why Hooks Instead of Triggers?

- **Visibility**: Hooks are TypeScript, debuggable, testable
- **Flexibility**: Can enqueue jobs, call services, access request context
- **Control**: Skip hooks when needed (use `db.raw`)

### Why False Polymorphism?

- **FK constraints**: Database enforces referential integrity
- **Type-safe queries**: Prisma generates typed includes
- **No magic strings**: No `type` + `id` lookups at runtime

### Why Mutation Lifecycle?

- **Consistency**: All mutations go through same validation
- **Atomicity**: Hooks run in same transaction as mutation
- **Post-commit safety**: Side effects (cache, webhooks) only after commit

### Why Scoped Context?

- **Request isolation**: Each request has its own db client view
- **Logging correlation**: All logs tagged with requestId
- **Transaction propagation**: Nested calls share transaction

---

## See Also

- [CONTEXT.md](CONTEXT.md) - Request context details
- [HOOKS.md](HOOKS.md) - Mutation lifecycle hooks
- [DATABASE.md](DATABASE.md) - Prisma patterns
- [AUTH.md](AUTH.md) - Authentication flow
