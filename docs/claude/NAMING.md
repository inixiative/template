# Naming Conventions

<!-- toc:start -->

## Contents

- [Terminology](#terminology)
  - [Verbs](#verbs)
  - [A name never](#a-name-never)
  - [Field vocabulary](#field-vocabulary)
- [Backend](#backend)
  - [Files](#files)
  - [Functions](#functions)
  - [Variables](#variables)
  - [Underscore Prefix](#underscore-prefix)
  - [Imports](#imports)
  - [Constants Pattern: `keyof typeof`](#constants-pattern-keyof-typeof)
  - [Zod Enum from Const Object](#zod-enum-from-const-object)
- [Frontend](#frontend)
  - [Components](#components)
  - [Styles](#styles)
- [Database](#database)
  - [Prisma Schema](#prisma-schema)
  - [Polymorphic Sides](#polymorphic-sides)
  - [Entitlement: source, target and the library's anchor](#entitlement-source-target-and-the-librarys-anchor)
  - [IDs](#ids)
- [Files & Directories](#files--directories)
  - [Backend Structure](#backend-structure)
  - [Frontend Structure](#frontend-structure)

<!-- toc:end -->


---

## Terminology

A name says exactly what the thing is, so someone reading it for the first time, outside this team,
knows what a call does without opening it. Long names that read like a sentence are fine
(`actorOperatesOwnerUserOrManagesOwnerTenant`); shortcuts, metaphors and mechanism words are not. When
the vocabulary drifts (seven verbs for "read", one word for two ideas), every reader pays for it, so
each word below has one meaning and every name uses it.

### Verbs

| Word | Means | Example |
|------|-------|---------|
| `fetch` | Reads with I/O: database, cache, Redis, HTTP | `fetchCachedRecordWithTargetEntitlements`, `fetchThroughCache` |
| no verb | A pure in-memory lookup, or a plain value built from inputs | `encryptedColumnNamesForKey`, `sensitiveFieldsOf`, `lensFromFieldTypes` |
| `…OrThrow` | Throws when nothing is there | `openTransactionForPrismaQueryOrThrow` |
| `make` | Returns a function, handler or stateful handle | `makeController`, `makeJob`, `makeLock` |
| `create` | Writes a record, or builds an adapter client | `createInquiry`, `createResendClient` |
| `register` | Adds something to a registry (a side effect) | `registerFactory`, `registerTestTracker` |
| `define` | Declares a typed definition and returns it; registers nothing | `defineStream` |
| `validate` | Throws when the input is wrong; never returns a problem | `validateWhereIsNotEmpty` |
| `aToB` | Converts one shape to another | `stripeToUser` |
| `read` | Route and controller names only | `organizationRead`, `readRoute` |
| `resolve` | Picks one value from several sources by precedence | |
| `tokenize` | Splits text into the tokens of a grammar | `tokenizeBatchInterpolation` |
| `escape` | Rewrites text so a grammar reads all of it as literal | `escapeBatchInterpolation` |
| `decode` | Reverses an encoding | `decodePercentEncodedBatchReferences` |
| `get` | Never in our names; only where a library defines it | `getByRole`, Hono's `c.get` |

A boolean is a question (`isUsableLoopBindingName`). A function that does two things says both
(`recomputeAndStoreMissingComponentSlugs`). Code lives in `util`, never `helper`; backend
business logic is `services`; `handlers` are jobs and frontend event handlers. Zustand slices keep
`create…Slice` (`ZUSTAND.md`).

### A name never

- describes the mechanism instead of the meaning (`materialized` for a dual polymorphism id);
- uses a metaphor only its author reads (`settle`, `shadow`, `trip`, `sweep`);
- says something the code does not do (a clientIp that returns a rate-limit bucket address, now `clientRateLimitBucketAddress`);
- is a bare verb, a bare noun or a past participle (`collect`, `registry`, `built`);
- abbreviates a model or concept (Ref for Relationship, `orgId`). `Nav` is accepted.

### Field vocabulary

| Word | Means | Registry or function |
|------|-------|----------------------|
| sensitive | The value never leaves the system | `SENSITIVE_FIELDS` (passwords, key hashes, every encrypted column) |
| mask | Hide a value but keep that it changed (audit, logs) | `maskSensitiveFields`, `MASKED_VALUE` |
| omit | Drop a field from what goes out | `omitRegisteredFields`, `omitSensitiveFieldsFromLens` |
| redact | Erase a person, and nothing else | `redactUser`, `meRedact` |
| internal | Never leaves, for privilege rather than secrecy | `INTERNAL_FIELDS` (`User.platformRole`) |
| no-op | A change not worth recording or firing | `NOOP_FIELDS` |

A webhook excludes no-op, sensitive and internal fields (`WEBHOOK_EXCLUDED_FIELDS`). Side names for
polymorphic slots and back-relations are under [Polymorphic Sides](#polymorphic-sides).

---

## Backend

### Files

| Type | Convention | Example |
|------|------------|---------|
| Route handler | `<model><Action><Submodel?>`.ts | `userCreate.ts`, `organizationReadManySpaces.ts` |
| Hook | `<model><Timing><Purpose>.ts` | `userAfterCreate.ts` |
| Job | `<verb><Noun>.ts` | `sendWebhook.ts`, `processInquiry.ts` |
| Middleware | `<purpose>Middleware.ts` | `jwtAuthMiddleware.ts` |
| Utility | `<verb><Noun>.ts` or `<noun>.ts` | `makeController.ts`, `fetchThroughCache.ts` |

**ReadMany subresources use plural form:**
- `meReadManyOrganizations.ts` (not `meReadManyOrganization.ts`)
- `organizationReadManySpaces.ts` (not `organizationReadManySpace.ts`)
- Single operations remain singular: `organizationCreateSpace.ts`

### Functions

| Type | Convention | Example |
|------|------------|---------|
| Route handler | `<model><Action>` | `userCreate`, `organizationReadMany` |
| Boolean getter | `is<Condition>` | `isAuthenticated`, `isSuperadmin` |
| Builder of a function or handler | `make<Thing>` | `makeError`, `makeJob`, `makeController` |

The verb rules are in [Terminology](#terminology).

### Variables

| Type | Convention | Example |
|------|------------|---------|
| Context values | camelCase | `user`, `organization`, `permix` |
| Primitive constants | SCREAMING_SNAKE | `DEFAULT_PAGE_SIZE`, `MAX_RETRIES` |
| Object constants (enums/registries) | PascalCase | `Modules`, `JobType`, `BatchStatus` |
| Derived helpers (Zod enums, etc) | camelCase | `batchStatusEnum`, `moduleKeys` |

### Underscore Prefix

Two distinct meanings — **don't mix them**:

| Prefix | Meaning | Example |
|--------|---------|---------|
| `_name` | **Unused** variable/parameter | `(_input, key) => …`, `const { x: _drop, ...rest } = obj` |
| `__name` | **Private / internal** — not for outside use | `private __body`, `__send()` |

**Why both?** TypeScript's `private` keyword only works on class members. For module-level helpers, object literal keys, and other plain-data internals, there is no language-level private. The double-underscore convention covers those cases. Single underscore is reserved for the universal "ignored" meaning (matches `argsIgnorePattern: "^_"`).

**Apply consistently:**
- Class private methods/fields: `private __methodName()`, `private __field` (the keyword *and* the prefix reinforce intent).
- Object-literal helpers a consumer shouldn't reach into: `{ __cache: …, lookup() { … } }`.
- Unused destructured fields: `const { legacy: _legacy, ...rest }`.
- Unused callback params: `(_event, payload) => …`.

**Don't use `#name` (hard-private)** unless you need runtime privacy enforcement specifically — it's class-only and doesn't unify with the broader `__name` convention.

### Imports

| Context | Alias | Example |
|---------|-------|---------|
| Within an app | `#/` | `import { contextResource } from '#/lib/context/contextResource'` |
| Shared packages | `@template/` | `import { db } from '@template/db'` |
| Within a shared package | `@template/` | `import { log } from '@template/shared/logger'` |
| Top-level barrel exports | Relative | `export { foo } from './foo'` |

```typescript
// apps/api/src/modules/user/routes/userCreate.ts
import { db } from '@template/db';                    // Shared package
import { log } from '@template/shared/logger';        // Shared package
import { contextResource } from '#/lib/context/contextResource';    // Internal to app

// packages/shared/src/logger/index.ts (top-level barrel)
export { log } from './logger';                       // Relative OK here
export { withLogScope } from './scope';

// packages/shared/src/logger/logger.ts (NOT a barrel)
import { currentLogScopes } from '@template/shared/logger/scope';  // Use alias, not relative
```

**Why `@template/` inside shared packages?** Ensures imports work the same whether you're inside or outside the package. Avoids confusing mixed conventions.

**Why relative only for top-level barrels?** Top-level `index.ts` files are the public API that makes exports accessible outside the package. They just re-export from siblings. Actual code files use aliases for consistency.

**Avoid barrel files otherwise.** Import directly from the source file, not through intermediate barrels. Direct imports are clearer and tree-shake better.

### Constants Pattern: `keyof typeof`

Use `keyof typeof` to derive types from const objects for single source of truth.

```typescript
// ✅ Good - Type derived from object
export const BatchStatus = {
  success: 'success',
  partialSuccess: 'partialSuccess',
  failed: 'failed',
} as const;

export type BatchStatus = keyof typeof BatchStatus;
// Type: 'success' | 'partialSuccess' | 'failed'

// ❌ Bad - Manual duplication
type BatchStatus = 'success' | 'partialSuccess' | 'failed';
const BatchStatus = { success: 'success', ... };
```

**Benefits:**
- Add new value in one place
- Types automatically update
- Impossible to desync
- Works with Zod schemas

### Zod Enum from Const Object

Convert const object to Zod enum tuple format:

```typescript
const BatchStatus = { success: 'success', failed: 'failed' } as const;

// Create Zod enum helper
export const batchStatusEnum = Object.keys(BatchStatus) as [
  keyof typeof BatchStatus,
  ...Array<keyof typeof BatchStatus>
];

// Use in schema
const schema = z.object({
  status: z.enum(batchStatusEnum) // Type-safe, synced with BatchStatus
});
```

**Why needed:** Zod's `z.enum()` requires tuple type `[string, ...string[]]`, not plain array.

**Real example:** See `apps/api/src/modules/batch/constants.ts`

---

## Frontend

TODO: Document frontend conventions

### Components

| Type | Convention | Example |
|------|------------|---------|
| Component | PascalCase | `UserProfile.tsx` |
| Hook | `use<Name>` | `useAuth.ts` |
| Context | `<Name>Context` | `AuthContext.tsx` |

### Styles

TODO: Tailwind conventions

---

## Database

### Prisma Schema

| Type | Convention | Example |
|------|------------|---------|
| Model | PascalCase singular | `User`, `Organization` |
| Field | camelCase | `firstName`, `organizationId` |
| Enum | PascalCase | `Role`, `PlatformRole` |
| Relation | camelCase, descriptive | `organization`, `members`, `createdBy` |

### Polymorphic Sides

A polymorphic slot is named for the role the row plays, as `<side>Model` + typed FKs.

| Side | Meaning | Example |
|------|---------|---------|
| `owner` | Tenancy only — who the row belongs to | `Contact.ownerModel` |
| `source` / `target` | The two ends of a directed edge | `Inquiry`, `RuleReference` `sourceModel` / `targetModel` |
| `resource` | A one-sided slot | `TagAttachment.resourceModel` |
| `subject` | The row a record is about | `AuditLog.subjectModel` |
| `actor` | Who acted | `AuditLog.actorUserId` |

Never `referenced*`.

A side whose typed FKs are `onDelete: SetNull` keeps a plain id beside them: register the axis with
`dualPolymorphismId` (`sourceId`, `targetId`) in `packages/db/src/registries/falsePolymorphism.ts`. Why:
SetNull nulls the typed key when the row it points at is hard-deleted, and only the plain id still says
what it was; the required-FK rule accepts it in the key's place. CI rule
`set-null-arm-requires-dual-polymorphism-id` enforces this; `Cascade` arms are exempt.

Each side gets its own enum, named for the question it answers, even when the two lists overlap:
`TagOwnerModel` (who can own a tag: `Tag.ownerModel`, `TagCategory.ownerModel`) and `TagResource`
(where a tag can be applied: `TagAttachment.resourceModel`, `Tag.resources`). A value that is only
meaningful on one side (`platform`, an owner with no row) never appears in the other side's enum.

The typed FKs and relations carry the side too, so both ends read the same way: `sourceSegmentId` /
`sourceSegment`, `targetTagId` / `targetTag` (as `Inquiry.sourceUserId` / `targetUserId`). The
back-relations do the same, side plus the full model name: `sourceRuleReferences` on a source model,
`targetRuleReferences` on a target model, both on a model that is both (`Segment`).

When the model's own name already carries a side word, side plus model stutters (customer + CustomerRelationship) and reads both ways,
so the back-relation names the side with `As<Side>`, as
`auditLogsAsActor` / `auditLogsAsSubject` already do: `customerRelationshipsAsCustomer` (rows where I
am the customer) / `customerRelationshipsAsProvider` on User, Organization and Space.

### Entitlement: source, target and the library's anchor

An `Entitlement` row is a directed edge, so it uses `source` / `target` like `RuleReference`. The
**source** is the anchor the entitlement acts from, the **target** the holder (`Token`,
`Integration`, `OrganizationUser`, `SpaceUser`); `resource` is the model its actions apply to. The
permissions library keeps its own words, and one transformer in `@template/permissions`
(`toEntitlementEntry` / `toEntitlementInput`, `packages/permissions/src/entitlementRows.ts`) moves
between them, only where a holder is handed to the library:

| Library entry | Row |
|---|---|
| `anchor.resource` (`db:space`) | `sourceModel` (`Space`) and the typed FK `sourceSpaceId` |
| `anchor.id` | `sourceId` |
| `anchor.path` | `sourcePath` |
| `resource` (`db:integration`) | `resource` (`Integration`) |
| `actions` (`{ read: true }`) | `actions` (`['read']`) |
| the holder it is installed on | `targetModel`, `targetId` and the arm's keys: `targetTokenId`, `targetIntegrationId`, or a member's owner chain (`targetOrganizationId`, `targetSpaceId`, `targetUserId`, as `Inquiry`'s) |

Back-relations follow the side rule: `targetEntitlements` on a holder, `sourceEntitlements` on every
model an entitlement can anchor at. An API response carries the holder's live rows as stored, under
`targetEntitlements`; a create body's `entitlements` is a list of `EntitlementInput` rows. Entries
never cross the API. The grantor has no name on the row: it is the target's owner.

### IDs

TODO: Document ID format
- UUIDv7 for sortability
- **Ids and keys that share a space carry a namespace from one registry, never a bare name.** Redis keys take theirs from `redisNamespace` ([REDIS.md](REDIS.md#namespaces)). A new family of keys or ids that can share a space gets a registry of the same shape: a `const` object of namespaces, one builder that joins `<namespace>:<name>` and one reader; nothing writes a prefix by hand, and a written value may not take a namespace only generated ones carry. Why: bare names in a shared space collide silently (Foundry, 2026-11-16: a region named `feedback` took a built-in role's id and the daemon could not boot for five hours).

---

## Files & Directories

### Backend Structure

```
apps/api/src/
├── config/          # App configuration
├── jobs/            # Background job definitions
├── lib/             # Shared utilities (avoid barrel files)
│   ├── cache/       # Cache utilities
│   ├── context/     # Request context getters
│   ├── permissions/ # Permission helpers
│   └── utils/       # General utilities
├── middleware/      # Hono middleware
├── modules/         # Domain modules
│   └── <model>/
│       ├── routes/  # Route handlers
│       ├── hooks/   # Model hooks
│       └── jobs/    # Model-specific jobs
└── routes/          # Route registration
```

### Frontend Structure

TODO: Document frontend structure
