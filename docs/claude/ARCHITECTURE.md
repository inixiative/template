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

Every SaaS hits the same wall: each tenant wants something done a little differently. Who sees which records, who gets notified, which rows a report includes, who a record is shared with. If each of those is code, every request becomes a ticket, a branch in the code (`if tenant is X`), a test, a review and a deploy.

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

Rules still have edges: a rule can only ask about what its lens exposes (for a permission rule, the hydrated record and the actor), with the operators the engine has. Widening those is code, but it's done once, in the engine or the data model, and every tenant gets it, not one tenant's case.

**The approach:** build the engine once and make every case data. The schema is code, written once. A tenant's rules are rows: [json-rules](https://github.com/inixiative/json-rules) conditions and [permissions](https://github.com/inixiative/permissions) action rules, both plain JSON. They live in the database, compose like any other data and are authored at runtime through the API, so a client can offer a rule editor (rules-builder renders one from the same lens) without any of it appearing in code. The engine evaluates a tenant's rule exactly as it evaluates the schema's, so adding tenants adds rows, not code, and changing a rule needs no deploy.

What makes this hold up:

- **One rule language.** Permission conditions, entitlement `where`s, segment conditions and email conditions are the same json-rules AST, so a tenant learns one language and the API validates all of them the same way.
- **One rule, several targets.** A json-rules condition runs in memory, compiles to a Prisma query or compiles to SQL, so a segment is checked on one row and listed in one query by the same rule. A permission rule runs in memory on the hydrated record.
- **Live records, no sync.** Rules read your own records as they are. There is no separate authorization store to keep in sync.
- **Self-describing.** Each rule field's info route says what the rule may read, so a client editor needs no hard-coding.

Sharing is the clearest case. Without rules you get only the access the system was built to give; with them, three ways to share ad hoc:

- **A rule on the record.** A model with a `permissionRules` column (`Contact` today, for `read`; the model picks which actions take one) carries its own `ActionRule`, ORed with the schema's. It can share one record with one user, with anyone matching a rule on the acting user or token's own row, or with anyone who can reach a record it relates to.
- **An entitlement on a holder.** A member row, token or integration can be given an action on a resource from an anchor, narrowed by a `where`, and re-checked against whoever granted it each time it is used.
- **A relation.** To share with a whole tenant the record has no relation to, add a row that relates the two and let the schema walk it. That is a developer change, made once: a model and a schema line, not new engine code.

The guardrails are part of the design:

- A record's rule is ORed with the schema's, so it can widen access but never revoke what the schema grants.
- Permission rules and entitlement `where`s are positive: a rule that could pass on a missing value is refused (422).
- The API checks a permission rule with `validateActionRule` before it is saved.
- Writing a contact's rules takes `manage` on that contact, like any other field.

**Now and next.** Serialization is the first half and it's here: rules are rows, stored per tenant, validated before they're saved, changed without a deploy, and tenants share ad hoc by writing one. The second half is reflection: compiling the same permission rules to a Prisma query and to SQL ([INFRA-026](../../tickets/INFRA-026-compile-permissions-to-query.md), planned for `@inixiative/permissions` 1.0, not started). It's mostly a mapping, not an invention: permission rules are positive, so the things a query can't express (negation, missing values, aggregates) are already refused. With both in place, the rules tenants have already written answer questions nothing can answer today:

- **"Which records can I read?" in one query**, paged and sorted, instead of fetching everything and checking each: collections filtered by what you can read ([AUTH-008](../../tickets/AUTH-008-permission-filtered-collections.md)).
- **"Who can see this?"**, for recipients ([COMM-005](../../tickets/COMM-005-rebac-targeting-to-prisma.md)) and audits.
- **A permissions builder** that previews a rule against real data at scale ([FEAT-008](../../tickets/FEAT-008-permissions-builder.md)).

None of these needs a rule per case. They're new answers from the rules that already exist.

See [PERMISSIONS.md](PERMISSIONS.md) for the schema and entitlements.

---

## See Also

- [CONTEXT.md](CONTEXT.md) - Request context details
- [HOOKS.md](HOOKS.md) - Mutation lifecycle hooks
- [DATABASE.md](DATABASE.md) - Prisma patterns
- [AUTH.md](AUTH.md) - Authentication flow
