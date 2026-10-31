# Architecture

<!-- toc:start -->

## Contents

- [Overview](#overview)
- [Request Flow](#request-flow)
- [Data Flow](#data-flow)
  - [Write Path](#write-path)
  - [Read Path](#read-path)
- [Key Patterns](#key-patterns)
  - [Why Hooks Instead of Triggers?](#why-hooks-instead-of-triggers)
  - [Why False Polymorphism?](#why-false-polymorphism)
  - [Why Mutation Lifecycle?](#why-mutation-lifecycle)
  - [Why Scoped Context?](#why-scoped-context)
  - [Why Behaviour Is Rules, Not Code?](#why-behaviour-is-rules-not-code)
- [See Also](#see-also)

<!-- toc:end -->


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
  ├─► jwtAuthMiddleware  # User JWT
  ├─► tokenAuthMiddleware # API token auth
  ├─► spoofMiddleware    # Superadmin impersonation
  │
  ├─► Route middleware   # validatePermission, validateSubmodelPermission, etc.
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

### Why Behaviour Is Rules, Not Code?

Every SaaS hits the same wall: each tenant wants something done a little differently. Who sees which records, who gets notified, which rows a report includes, what a role may do. If each of those is code, every request becomes a ticket, a branch in the code (`if tenant is X`), a test, a review and a deploy.

**The cost of doing it in code:**

- **Complexity grows with every tenant.** Each variation is another case to write, test and keep working while everything around it changes. The code base ends up as the sum of every customer's exceptions.
- **Every change is a support ticket to the engineers.** Only engineers can change behaviour, so a customer who wants something different files a ticket and waits on your backlog. Either you say no, or the request queues behind product work and your engineers spend their time on one tenant's exceptions.
- **Every change is a release.** Even behaviour moved into a config file still ships on deploy, so a one-tenant tweak goes through the whole pipeline and lands for everyone at once.
- **Enforcement drifts.** A case written once for the API gets rewritten for the UI, the SQL query and the background job, and the copies disagree.
- **You only get what was built.** Access and behaviour are limited to the cases someone anticipated. Anything else, like sharing one record with one outside user, is a feature request.

**Levels of configurability.** Between hard-coding and rules there are intermediate levels, and each one breaks at the same place: the first time someone asks a new kind of question.

1. **Hard-coded.** The behaviour is code. Any change is a ticket and a deploy.
2. **Config shipped with the app.** Values move into a file or environment variables. Changing one is still a deploy, and it applies to every tenant at once.
3. **Feature flags and settings.** A tenant switches on the features and picks the choices you built: notify admins or not, share with the organization or not. This works until the tenant wants something that isn't on the list, and then it's back to a ticket.
4. **Parameters.** A tenant fills in values in shapes you designed: a threshold, a list of roles, a date range. More room than a toggle, but the question is still yours; the tenant only supplies its numbers. "Notify the account owner when an overdue invoice is over 10,000 and the customer is in Europe" is a new question, so it's new code.
5. **Rules.** The question itself is data. A tenant composes conditions over its own records with the operators the engine has, so a new question is a new rule, not new code. This is the maximally configurable level and the one this template builds on.

Each level has its limits, and every level below rules leaves manual work behind once its options run out: the request that doesn't fit becomes engineering work, and the lower the level, the more of it there is.

Rules still have edges: a rule can only ask about the fields and relations it can see, with the operators the engine has. Widening those is code, but it's done once, in the engine or the data model, and every tenant gets it, not one tenant's case.

**The approach:** build the engine once and make every case data. Behaviour that varies by tenant, record or person is stored as a rule, not written as a code path. Rules are [json-rules](https://github.com/inixiative/json-rules) conditions and [permissions](https://github.com/inixiative/permissions) action rules, and both are plain JSON. They live in the database, compose like any other data and are authored at runtime, so a tenant sets up how it wants things to work, from the client, without any of it appearing in code. The engine evaluates a tenant's rule exactly as it evaluates the schema's, so adding tenants adds rows, not code, and nothing needs a deploy. One rule also runs in every place it has to: in memory, as a Prisma query, or as SQL, so the API, the UI and the jobs enforce the same thing.

Sharing is the clearest case. Without rules you get only the access the system was built to give; with them, three ways to share ad hoc:

- **A rule on the record.** A model with a `permissionRules` column (`Contact` today; any model can add one) carries its own rule per action, ORed with the schema's. It can share one record with one user, with anyone matching a rule on the acting user or token's own row, or with anyone who can reach a record it relates to.
- **An entitlement on a holder.** A member row, token or integration can be given an action on a resource from an anchor, narrowed by a `where`.
- **A relation.** To share with a whole tenant the record has no relation to, add a row that relates the two and let the schema walk it. That is a model and a schema line, not new engine code.

The guardrails are part of the design:

- Stored rules are positive only: a tenant's rule can widen access, never revoke what the schema grants.
- `validateActionRule` checks a rule before it is saved.
- Who may write a record's rules is an ordinary schema action on that record.
- The app decides what it refuses to persist; the engine doesn't police vocabulary.

See [PERMISSIONS.md](PERMISSIONS.md) for the schema and entitlements.

---

## See Also

- [CONTEXT.md](CONTEXT.md) - Request context details
- [HOOKS.md](HOOKS.md) - Mutation lifecycle hooks
- [DATABASE.md](DATABASE.md) - Prisma patterns
- [AUTH.md](AUTH.md) - Authentication flow
