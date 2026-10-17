# Technical Article Series: Template Engineering

Eight deep-dive technical articles targeting senior/staff engineers. Each article demonstrates a genuinely novel pattern from the template that solves a problem most teams discover the hard way.

---

## Article 1: Transaction-Aware Hooks — Why Your ORM Fires Webhooks on Rolled-Back Data

**Hook:** Every ORM you've used has this bug. After-hooks fire before the transaction commits. Your webhook just told Stripe about a subscription that doesn't exist.

**Outline:**

1. The universal problem: `afterCreate` runs inside the transaction, not after it
   - Sequelize, TypeORM, Prisma, Drizzle — all fire "after" hooks before commit
   - Real-world consequence: webhook delivers data from a rolled-back financial transaction
2. Why this is hard to fix without architectural changes
   - Hooks need transaction context but must execute outside the transaction
   - Nested transactions make this worse (savepoints vs. real commits)
3. The solution: `db.onCommit()` with AsyncLocalStorage + Proxy
   - Transparent transaction merging — no explicit passing of `tx` objects
   - Deferred callback registry tied to transaction lifecycle
   - Ordered execution: rules → immutable stripping → write → cache invalidation → webhook
4. Immutable field enforcement as a bonus
   - Auto-inferred from foreign key relationships
   - 3+ levels of nested stripping
   - Prevents accidental FK reassignment (moving a space to a different org)
5. Implementation walkthrough with Prisma + PostgreSQL
6. Why `createMany`/`updateMany` must be blocked in favor of `AndReturn` variants

**Target length:** 2,500–3,000 words
**Code examples:** Transaction merging proxy, `onCommit` callback registration, immutable field stripping logic

---

## Article 2: Pseudo-GraphQL Over REST — Bracket Notation Filtering Without the Complexity Tax

**Hook:** You don't need GraphQL. You need `?searchFields[user][name][contains]=john` parsed into a Prisma `where` clause. Here's how to build it.

**Outline:**

1. The GraphQL trap: adopting a query language to get flexible filtering
   - Schema stitching, resolvers, N+1 problems, caching complexity
   - Most teams only needed "filter by nested fields"
2. Bracket notation as a URL-native query language
   - `?searchFields[price][gte]=100&searchFields[tags][some][name]=urgent`
   - Familiar to anyone who's used Rails or PHP query strings
3. Operator design
   - 11 field operators: `contains`, `equals`, `in`, `notIn`, `lt`, `lte`, `gt`, `gte`, `startsWith`, `endsWith`, `not`
   - 5 relation operators: `some`, `every`, `none`, `is`, `isNot`
   - 10-level nesting depth limit (prevents abuse)
4. Parsing implementation
   - URL query string → nested object → Prisma-compatible `where` clause
   - Type coercion (string "100" → number where schema expects number)
   - Validation against declared `searchableFields` for non-superadmin requests
5. Security considerations
   - Field allowlisting prevents data exfiltration
   - Depth limiting prevents DoS via deeply nested queries
   - Performance: index-aware operator restrictions
6. Comparison: this approach vs. GraphQL vs. JSON:API filtering vs. OData

**Target length:** 2,000–2,500 words
**Code examples:** Parser implementation, Prisma where clause generation, searchable field validation middleware

---

## Article 3: Field-Level Encryption with AAD Binding — Preventing Ciphertext Transplant Attacks

**Hook:** Your encrypted fields can be copy-pasted between records. If someone swaps the encrypted `ssn` from User A's row into User B's row, your decryption succeeds and returns User A's SSN under User B's name. AAD binding stops this.

**Outline:**

1. The transplant attack nobody talks about
   - Encrypted data is portable by default — ciphertext doesn't know which record it belongs to
   - AES-GCM decrypts successfully regardless of which row contains the ciphertext
   - Consequence: insider threats, database compromises, and replication bugs become data crossover events
2. Additional Authenticated Data (AAD) binding
   - Bind ciphertext to immutable record fields (record ID, tenant ID, creation timestamp)
   - Decryption fails if AAD doesn't match — the ciphertext is non-transferable
   - Choose immutable fields carefully (anything that can be updated breaks decryption)
3. Per-field encryption versioning
   - Track "Field X on Record Y is on encryption version 2" — not just key-level versioning
   - Enables targeted re-encryption during rotation
   - Query: "which records still use version 1?" becomes trivial
4. Dual-key zero-downtime rotation
   - Current key + previous key active simultaneously
   - Decrypt with current, fall back to previous
   - Background job re-encrypts with current key
   - No service interruption, no maintenance window
5. Idempotent rotation with preconditions
   - Prevents double-encryption (re-encrypting already-rotated ciphertext)
   - Precondition check: "only rotate if current version < target version"
6. CI validation pipeline
   - Block version gaps (can't jump from v1 to v3)
   - Block version downgrades
   - Enforce that new encrypted fields start at current version

**Target length:** 2,500–3,000 words
**Code examples:** AAD construction from immutable fields, encryption/decryption with version tracking, rotation job with preconditions

---

## Article 4: Batch APIs Nobody Builds Right — 4 Execution Strategies with Result Interpolation

**Hook:** Your batch endpoint is a for-loop with a try/catch. Here's what a real batch API looks like: 4 execution strategies, round-based dependency resolution, and result interpolation across requests.

**Outline:**

1. The state of batch APIs
   - Most: loop over requests, return array of results
   - Better: atomic (all-or-nothing) vs. non-atomic (continue on failure)
   - Neither handles dependencies between requests in the same batch
2. Four execution strategies
   - `transactionAll`: Every request in one database transaction. All succeed or all fail.
   - `transactionPerRound`: Each round gets its own transaction. Round 2 can use Round 1's committed results.
   - `allowFailures`: Best-effort. Failed requests don't block others.
   - `failOnRound`: If any request in a round fails, the entire round fails (but previous rounds are committed).
3. Result interpolation: the missing feature
   - `<<0.0.data.id>>` — reference the result of request 0, round 0, path `data.id`
   - Round 1: Create user → Round 2: Create org with `userId: <<0.0.data.id>>`
   - Enables complex multi-step operations in a single API call
4. Round-based execution model
   - Requests declare their round (execution order)
   - Same-round requests execute concurrently
   - Cross-round references enforce sequential execution
5. Error handling per strategy
   - Rollback semantics differ per strategy
   - Partial success reporting: which requests succeeded, which failed, why
6. When to use which strategy
   - `transactionAll`: Financial operations, data migrations
   - `transactionPerRound`: Dependent entity creation (user → org → membership)
   - `allowFailures`: Bulk updates where partial success is acceptable
   - `failOnRound`: Import operations with validation checkpoints

**Target length:** 2,500–3,000 words
**Code examples:** Request/response schema, interpolation resolver, strategy executor

---

## Article 5: The Structured Error Pipeline — From API Exception to Frontend Toast Without Guesswork

**Hook:** Your frontend has a `catch (e) { toast("Something went wrong") }` somewhere. Here's how to make every API error tell the frontend exactly what to do.

**Outline:**

1. The error gap between backend and frontend
   - Backend: rich error context (validation failures, permission issues, rate limits)
   - Frontend: `if (status === 400) showGenericError()`
   - The gap: no contract for error shape, no semantic meaning in error responses
2. Structured error shape
   - `label`: Machine-readable error identifier (`InvalidInput`, `Forbidden`, `RateLimited`)
   - `message`: Human-readable description
   - `guidance`: What the frontend should do about it
   - `fieldErrors`: Per-field validation errors for form rendering
3. Six guidance categories
   - `fixInput`: Show inline form errors, highlight invalid fields
   - `tryAgain`: Show retry button (transient failures)
   - `reauthenticate`: Redirect to login (expired session/token)
   - `requestPermission`: Show permission request flow
   - `refreshAndRetry`: Stale data — refresh cache and retry
   - `contactSupport`: Unrecoverable — show support link
4. Frontend error routing
   - Single error handler reads `guidance` and dispatches to correct UI behavior
   - No more status code switch statements
   - Type-safe: frontend knows exactly which guidance values exist
5. Response validation: the safety net
   - Controller output validated against declared response schema
   - Mismatch → 500 error (fail loud, not wrong)
   - Catches contract violations before they reach users
6. Implementation with Zod + Hono + TanStack Query

**Target length:** 2,000–2,500 words
**Code examples:** Error schema definition, guidance-based error handler, response validation middleware

---

## Article 6: Transaction-Aware Everything — Events, Jobs, and Webhooks That Respect Your Database

**Hook:** Your background job just failed with "record not found" because it fired before the transaction committed. Your event handler just broadcast a WebSocket message about data that was rolled back. Here's the fix.

**Outline:**

1. The three phantom side-effect bugs
   - **Jobs**: Enqueued inside transaction, execute before commit, reference non-existent records
   - **Events**: Emitted inside transaction, handlers fire, transaction rolls back — stale cache, wrong WebSocket messages
   - **Webhooks**: Delivered inside transaction, external system acts on uncommitted data
2. The root cause: eager execution inside transactions
   - Most frameworks treat side effects as immediate
   - Transaction boundaries are invisible to event emitters and job queues
3. Transaction-aware event emission
   - `createAppEvent('user:created', { userId })` inside a transaction
   - Handler registration deferred to `db.onCommit()`
   - Rollback → handlers never fire
   - Auto-broadcast via WebSocket wildcard handler
4. Transaction-aware job enqueuing
   - Job inserted into queue only after transaction commits
   - Eliminates the "record not found" race condition
   - Why only Graphile Worker (PostgreSQL-backed queue) solves this natively
5. Webhook delivery with no-op detection
   - Compare previous vs. current record state (stripping ignored fields like `updatedAt`)
   - Skip delivery if nothing meaningful changed
   - Circuit breaker: disable webhook after 5 consecutive failures
   - 90-day auto-cleanup of delivery records
6. The pattern: `db.onCommit()` as a universal side-effect boundary

**Target length:** 2,500–3,000 words
**Code examples:** Event deferral implementation, job enqueue wrapper, webhook no-op detection

---

## Article 7: Hierarchical Multi-Tenancy — Three Token Scopes No Auth Service Provides

**Hook:** Clerk gives you organizations. Auth0 gives you tenants. Neither gives you Organization → Space hierarchy with three-tier token scoping. Here's what that looks like.

**Outline:**

1. The multi-tenancy gap in managed auth
   - Clerk: organizations with roles. Flat. No sub-units.
   - Auth0: organizations or tenants. Pick one.
   - WorkOS: directory sync and SSO. Doesn't model your hierarchy.
   - The pattern they all miss: hierarchical tenancy with scoped access tokens
2. The Organization → Space model
   - Organization: billing unit, team boundary
   - Space: project, workspace, environment within an org
   - Separate join tables: `OrganizationUser` and `SpaceUser`
   - A user can be in an org without accessing all spaces
3. Three-tier token scoping
   - **User-scope**: Cross-organization access (superadmins, platform operators)
   - **Org-scope**: Access to all spaces in one organization (org admins)
   - **Space-scope**: Access to a single space only (API integrations, service accounts)
   - Token resolution: SHA-256 lookup + Redis cache
4. Permission system: RBAC + ABAC + ReBAC unified
   - Permify for relationship-based access control (ReBAC) with graph traversal
   - json-rules for attribute-based policies (38 operators, stored in database)
   - Runtime policy changes without redeployment
   - Cycle detection in permission graphs
5. Frontend context switching
   - URL-synced tenant context
   - Permission-aware navigation (hide what you can't access)
   - Three frontend apps (web, admin, superadmin) sharing components
6. Why application-level isolation is the right default
   - Database-per-tenant: operational nightmare at scale
   - Schema-per-tenant: migration complexity
   - Row-level security: Prisma doesn't support it well
   - Application-level: flexible, portable, testable

**Target length:** 3,000–3,500 words
**Code examples:** Token resolution middleware, scope validation, permission check with ReBAC traversal

---

## Article 8: From Prisma Schema to Type-Safe SDK — A Code Generation Pipeline That Actually Works

**Hook:** Change a database column. The Zod schema updates. The OpenAPI spec updates. The TypeScript SDK updates. The mock handlers update. One source of truth, zero drift.

**Outline:**

1. The drift problem
   - API response doesn't match the TypeScript types
   - Mock data in tests doesn't match the real API
   - OpenAPI spec is 3 months stale
   - Frontend and backend disagree on field names
2. The generation cascade
   - **Prisma schema** → database types and migrations
   - **Zod schemas** → runtime validation (generated from Prisma)
   - **OpenAPI 3.1 spec** → API documentation (generated from Zod)
   - **TypeScript SDK** → client library (generated from OpenAPI)
   - **MSW mock handlers** → test mocks (generated from OpenAPI)
3. Each stage in detail
   - Prisma → Zod: `zod-prisma-types` with custom transforms
   - Zod → OpenAPI: `@asteasolutions/zod-to-openapi` with route registration
   - OpenAPI → SDK: code generation with typed request/response pairs
   - OpenAPI → MSW: handler generation with realistic fake data
4. Test factories with auto-inferred relationships
   - Factory knows that creating a `Space` requires an `Organization`
   - Auto-creates parent records unless explicitly provided
   - 15 factories covering the full data model
5. Smart test cleanup
   - Mutation tracking: know which tables were touched per test
   - `TRUNCATE CASCADE` only on modified tables
   - Faster than truncating everything, safer than manual cleanup
6. The DX payoff
   - 93 test files that never fight type mismatches
   - Frontend devs get SDK updates without asking
   - New engineers onboard against accurate mocks

**Target length:** 2,500–3,000 words
**Code examples:** Generation pipeline scripts, factory with auto-inferred relationships, test cleanup tracker

---

## Publishing Strategy

**Cadence:** One tech article per week, published Tuesdays. Paired with one white paper article on Thursdays (see `research/article_series_plan.md` in [inixiative/whitepaper](https://github.com/inixiative/whitepaper/blob/main/research/article_series_plan.md)). Two articles per week total across 8 weeks.

**Recommended order:**
1. Transaction-Aware Hooks (week 1) — broadest appeal, universal pain point
2. Structured Error Pipeline (week 2) — practical, immediately applicable
3. Pseudo-GraphQL Over REST (week 3) — controversial take, drives discussion
4. Transaction-Aware Everything (week 4) — builds on Article 1's foundation
5. Batch APIs (week 5) — demonstrates depth of API design thinking
6. Field-Level Encryption (week 6) — security angle attracts different audience
7. Hierarchical Multi-Tenancy (week 7) — architecture-level, attracts CTOs
8. Code Generation Pipeline (week 8) — DX focus, satisfying conclusion

**Cross-promotion:** Each article links to the template repo as the production implementation. Articles 1, 4, and 6 form a "transaction-aware" trilogy that should cross-link.
