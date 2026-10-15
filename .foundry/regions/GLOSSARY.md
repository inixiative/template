# Template glossary

**Every term the template's region Wardens use, alphabetical, each with the region that holds it.**

<!-- Generated with the region Warden docs (v1) by ~/.foundry/evals/warden-regions/assemble.py. A term defined by two regions appears once per region. -->

---

## #

**#/**  
Alias for imports inside the same app (e.g. #/lib/context/getActor). *Region:* [Monorepo layout and build](monorepo-architecture/knowledge.md)

**#/**  
Import alias within an app. *Region:* [Naming, style and lint](naming-style/knowledge.md)

## A

**AAD**  
Additional Authenticated Data from buildAAD binding ciphertext to immutable record fields so it cannot be moved to another row. *Region:* [Field-level encryption](encryption/knowledge.md)

**acceptedKinds**  
CommunicationKind[] on Contact (and optionally CustomerRef) listing which kinds the contact accepts. *Region:* [Delivery, messaging and contacts](delivery-messaging-contacts/knowledge.md)

**access**  
NavItem rule (permissions, context, pageContext) => boolean; the source of truth for page visibility. *Region:* [Frontend apps, routes and navigation](frontend-apps-navigation/knowledge.md)

**Account**  
Per-user linked credentials for one provider (OAuth tokens or password). *Region:* [Authentication and Users](authentication-users/knowledge.md)

**acquireFindForUpdateLock**  
The Redis fence findForUpdate takes for rows a transaction will read then write. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**actionRoute**  
Route template for a custom non-CRUD verb, e.g. action: 'activate' → POST /:id/activate. *Region:* [API routes and schemas](api-routes-schemas/knowledge.md)

**ActionRule**  
One permission rule: action string, { rel, action }, { self }, { rule }, { any }, { all }, or null. *Region:* [Tenancy and Permissions](tenancy-permissions/knowledge.md)

**adapter module**  
types.ts interface + client/<provider>.ts factories + index.ts wiring; app code imports only the exported adapter. *Region:* [App events, webhooks, adapters](app-events-webhooks-adapters/knowledge.md)

**adapters**  
Class: provider adapter modules exposing one interface over provider implementations, wired with makeAdapterRouter/Registry. *Region:* [App events, webhooks, adapters](app-events-webhooks-adapters/knowledge.md)

**addUniqueWhereNotNull / addCheckConstraint / addGistIndex**  
Helpers for partial unique indexes, CHECK constraints and GIST indexes, which Prisma can't express. *Region:* [Database client and schema](database/knowledge.md)

**advance**  
auto moves on as soon as a step holds; confirm waits for the user (e.g. one-time secrets). *Region:* [Inquiries and Flows](inquiries-flows/knowledge.md)

**Adversarial review**  
Background review of the full change after significant implementation, run without being asked. *Region:* [Engineering process, docs, Atlas](engineering-process-docs/knowledge.md)

**AES-256-GCM**  
Authenticated encryption used per field with a random 12-byte IV and a 16-byte auth tag that detects tampering. *Region:* [Field-level encryption](encryption/knowledge.md)

**alias**  
NavItem flag: routable page hidden from the sidebar. *Region:* [Frontend apps, routes and navigation](frontend-apps-navigation/knowledge.md)

**AND / OR groups**  
Indexed combinators (searchFields[AND][0][...]) that keep same-relation filters distinct; max 25 groups. *Region:* [List filtering and pagination](filtering-pagination/knowledge.md)

**api-client**  
Class: the generated SDK, apiQuery/apiMutation, optimistic mutations, data hooks and form helpers. *Region:* [Frontend store and API client](frontend-state-api-client/knowledge.md)

**api-modules**  
Class: the folder anatomy of an apps/api module (routes/, controllers/, schemas/, services/, handlers/ …) and where new code goes. *Region:* [API routes and schemas](api-routes-schemas/knowledge.md)

**/api/telemetry/browser**  
Origin-checked, rate-limited endpoint converting browser events to OTLP (telemetry.source=browser). *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**apiFetchInternal**  
Shared fetch layer: bearer and x-spoof-user-email headers, VITE_API_URL, :id path params, serializeBracketQuery, throw on error. *Region:* [Frontend store and API client](frontend-state-api-client/knowledge.md)

**apiMutation**  
Turns an SDK write into a mutationFn taking request options as variables; returns the full response. *Region:* [Frontend store and API client](frontend-state-api-client/knowledge.md)

**apiPath**  
Resolves an SDK operationId to its URL path with serialized bracket query. *Region:* [API routes and schemas](api-routes-schemas/knowledge.md)

**apiQuery**  
Turns an SDK GET into a queryFn that reads options from queryKey[0] and unwraps { data: { data, pagination } }. *Region:* [Frontend store and API client](frontend-state-api-client/knowledge.md)

**apiRateLimit / authRateLimit**  
The API-wide limiter (principal, space, organization) and the /api/auth/* per-IP limiter. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**app-events**  
Class: the emitAppEvent side-effect bus, makeAppEvent handlers, their email/WebSocket/observe handoffs and commit deferral. *Region:* [App events, webhooks, adapters](app-events-webhooks-adapters/knowledge.md)

**appendToStream**  
Sequences and publishes a stream append through Redis via a per-stream serialized queue. *Region:* [WebSockets and data streams](websockets/knowledge.md)

**AppEnv**  
Hono env type whose Variables (AppVars) hold db, txn, app, user, organizationUsers, organizations, spaceUsers, spaces, session, token, spoofedBy, permix, requestId, resource, resourceType, bracketQuery, filterLens. *Region:* [Request context, errors, batch](request-context-errors-batch/knowledge.md)

**AppError**  
HTTPException subclass whose getResponse() emits the standard error body; requestId is stamped by the handler. *Region:* [Request context, errors, batch](request-context-errors-batch/knowledge.md)

**AppEvent**  
Model recording emitted events (upserted by envelope id) with actor, source and payload. *Region:* [App events, webhooks, adapters](app-events-webhooks-adapters/knowledge.md)

**AppEventName**  
Typed union of event names, declared with their payloads and registrations in apps/api/src/appEvents/handlers/index.ts. *Region:* [App events, webhooks, adapters](app-events-webhooks-adapters/knowledge.md)

**applyMembershipDiff**  
Writes membership adds and removals for a segment from a matching set. *Region:* [Customers and segments](customers-segments/knowledge.md)

**AppStore**  
Type of the composed store: ClientSlice & AuthSlice & NavigationSlice & PermissionsSlice & TenantSlice & UISlice. *Region:* [Frontend store and API client](frontend-state-api-client/knowledge.md)

**AppTheme / SpaceTheme**  
Complete platform theme type; nullable, all-optional tenant override type with bare HSL colors and logo/favicon. *Region:* [UI components, layout and theme](ui-components-theme/knowledge.md)

**architecture**  
Class: system overview, request and data flow, key architectural patterns. *Region:* [Monorepo layout and build](monorepo-architecture/knowledge.md)

**ArrayNode**  
A list or relation condition: presence, count, or predicate (all/any/none) with a nested condition sub-builder. *Region:* [Rule builder editor model](rules-builder/knowledge.md)

**assign**  
Action gating role grants and token creation: high roles (owner, admin) need own, others manage. *Region:* [Tenancy and Permissions](tenancy-permissions/knowledge.md)

**atlas**  
Class: Atlas code map: concept vocabulary, @atlas annotations, navigating by concept. *Region:* [Engineering process, docs, Atlas](engineering-process-docs/knowledge.md)

**@atlas block**  
Top-of-file JSDoc annotation declaring @kind, @partOf, @uses, @constructs; the only standing comment allowed. *Region:* [Engineering process, docs, Atlas](engineering-process-docs/knowledge.md)

**atlas check**  
CI gate verifying blocks exist and use valid vocabulary, not correctness. *Region:* [Engineering process, docs, Atlas](engineering-process-docs/knowledge.md)

**atlas stamp**  
Fills @kind/@partOf from .atlas/config.ts rules; dry-run by default, --write applies, never touches @uses. *Region:* [Engineering process, docs, Atlas](engineering-process-docs/knowledge.md)

**aToB**  
Integration transformer naming (stripeToUser). *Region:* [Naming, style and lint](naming-style/knowledge.md)

**audience**  
Required: 'shared' (every holder gets identical data, test-enforced) or 'perRecipient' (appends need recipient userIds). *Region:* [WebSockets and data streams](websockets/knowledge.md)

**audit-log**  
Class: the AuditLog trail of mutations on enabled models, with actor, diffs and redaction. *Region:* [Mutation hooks and write lifecycle](mutation-hooks/knowledge.md)

**AUDIT_ENABLED_MODELS**  
Opt-in list of AuditSubjectModel values whose mutations are audited. *Region:* [Mutation hooks and write lifecycle](mutation-hooks/knowledge.md)

**auditActorContext**  
AsyncLocalStorage scope carrying the actor (user, spoof user, token, job, inquiry, IP) and the soft-delete bypass flag. *Region:* [Mutation hooks and write lifecycle](mutation-hooks/knowledge.md)

**AuditLog**  
Model storing action, subjectModel, before/after, changes and actor/context columns for each audited mutation. *Region:* [Mutation hooks and write lifecycle](mutation-hooks/knowledge.md)

**auth slice**  
Store slice with user, organizations, spaces, spoof state and initialize/signIn/signUp/logout/refreshMe. *Region:* [Authentication and Users](authentication-users/knowledge.md)

**auth-middleware**  
Class: the server auth middleware chain, spoofing and the validateUser/validateActor gates. *Region:* [Authentication and Users](authentication-users/knowledge.md)

**authenticate frame**  
The client message carrying credentials after an anonymous upgrade; resolved via /api/v1/me, re-sent on spoof/unspoof. *Region:* [WebSockets and data streams](websockets/knowledge.md)

**_authenticated**  
Layout route: requireAuth + AppShell + nav-based access check. *Region:* [Frontend apps, routes and navigation](frontend-apps-navigation/knowledge.md)

**authentication**  
Class: BetterAuth sessions, OAuth, AuthProviders, API tokens and token types. *Region:* [Authentication and Users](authentication-users/knowledge.md)

**AuthMethod**  
Discriminated union (email, oauth, saml) accepted by signIn and signUp. *Region:* [Authentication and Users](authentication-users/knowledge.md)

**authMiddleware**  
Resolves a BetterAuth session from Bearer, cookie or ?token= and sets the user context. *Region:* [Authentication and Users](authentication-users/knowledge.md)

**AuthProvider**  
An organization's EMAIL, OAUTH or SAML login configuration with encrypted secrets. *Region:* [Authentication and Users](authentication-users/knowledge.md)

**AuthProvider**  
First production user of the engine: OAuth client secrets in encryptedSecrets. *Region:* [Field-level encryption](encryption/knowledge.md)

**AuthSlice**  
Signed-in user, memberships as id-keyed dictionaries, spoof state, initialize/refreshMe/signIn/signUp/setSpoof/logout. *Region:* [Frontend store and API client](frontend-state-api-client/knowledge.md)

**autoApprove**  
Required handler hook called after send; returning true resolves the inquiry as approved immediately. *Region:* [Inquiries and Flows](inquiries-flows/knowledge.md)

**autoRegisterRoutes**  
Scans a module's routes/ and controllers/ and mounts each pair at startup; admin/internal variants exist. *Region:* [API routes and schemas](api-routes-schemas/knowledge.md)

## B

**Barrel**  
Top-level index.ts public API; the only file allowed relative imports; intermediate barrels are banned. *Region:* [Naming, style and lint](naming-style/knowledge.md)

**Barrel file**  
Top-level index.ts that is a package's public API; the only place relative imports are allowed. *Region:* [Monorepo layout and build](monorepo-architecture/knowledge.md)

**bashMainCheckoutGuard**  
PreToolUse hook denying raw git worktree commands and mutating commands that would land in the main checkout. *Region:* [Dev environment and tooling](dev-environment-tooling/knowledge.md)

**batch**  
Class: the Batch API (rounds, execution strategies, interpolation, status tracking) and its in-process read helpers. *Region:* [Request context, errors, batch](request-context-errors-batch/knowledge.md)

**Bearer token**  
Authorization: Bearer <token>; carries both SPA session tokens and API keys. *Region:* [Authentication and Users](authentication-users/knowledge.md)

**BetterAuth**  
The auth library behind the auth instance: email/password, social OAuth, sessions, verification; mounted at /api/auth/*. *Region:* [Authentication and Users](authentication-users/knowledge.md)

**bind / bindings**  
Named tokens in a rule or lens filled at evaluation (bindRule, bindLens); bindOptional lets a binding resolve to null. *Region:* [json-rules, lenses and rule references](json-rules-lenses/knowledge.md)

**Biome**  
Linter/formatter configured from @inixiative/config/biome/base.json (+ react.json). *Region:* [Naming, style and lint](naming-style/knowledge.md)

**bracket notation**  
Nested query params like searchFields[price][gte]=100, parsed by prepareRequest / parseBracketNotation. *Region:* [List filtering and pagination](filtering-pagination/knowledge.md)

**bracketQuery**  
The parsed bracket-notation object on context, c.get('bracketQuery'). *Region:* [List filtering and pagination](filtering-pagination/knowledge.md)

**bracketQuery**  
Context var holding the parsed bracket-notation query (?filter[role]=admin → { filter: { role: 'admin' } }). *Region:* [Request context, errors, batch](request-context-errors-batch/knowledge.md)

**breadcrumbLabel**  
NavItem function naming a record page's crumb. *Region:* [Frontend apps, routes and navigation](frontend-apps-navigation/knowledge.md)

**bridge**  
A cross-source join declared on a lens; bridge fields are addressed as fieldMap:Model. *Region:* [json-rules, lenses and rule references](json-rules-lenses/knowledge.md)

**build-tooling**  
Class: Turborepo tasks, watch mode, codegen, build presets, hot reload. *Region:* [Monorepo layout and build](monorepo-architecture/knowledge.md)

**buildAAD**  
Registry callback producing the AAD string; must use only immutable fields such as id and organizationId. *Region:* [Field-level encryption](encryption/knowledge.md)

**builderSource**  
Serialize a lens into a RuleBuilderSource a server ships to the builder. *Region:* [Rule builder editor model](rules-builder/knowledge.md)

**buildWhereClause**  
Combines search, searchFields, filters and lens root wheres into one Prisma where after whitelist validation. *Region:* [List filtering and pagination](filtering-pagination/knowledge.md)

**buildX**  
Factory variant that builds the entity in memory with no DB write. *Region:* [Tests, factories and VCR](testing/knowledge.md)

**BullBoard**  
Web UI for inspecting, retrying and cleaning queued jobs; basic auth outside local. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**bun --hot / Vite HMR**  
Backend and frontend hot reload used under turbo watch. *Region:* [Monorepo layout and build](monorepo-architecture/knowledge.md)

**bun run check**  
The full gate: lint, typecheck, backend and frontend tests, CI rules. *Region:* [Dev environment and tooling](dev-environment-tooling/knowledge.md)

**bun run docs:toc**  
Regenerates TOCs between toc:start/toc:end markers (scripts/docs/regenToc.ts). *Region:* [Engineering process, docs, Atlas](engineering-process-docs/knowledge.md)

**bun run init**  
Once-per-fork interactive provisioning TUI (Infisical, secrets, cloud services); init:agent is the non-interactive form. *Region:* [Dev environment and tooling](dev-environment-tooling/knowledge.md)

**bun run init**  
Entry point (init/index.tsx) for the interactive TUI; run once per project lifecycle by whoever forks the template. *Region:* [Init provisioning TUI](init-script/knowledge.md)

**bun run local**  
Starts every app with Turborepo watch so workspace package changes hot-reload consumers. *Region:* [Dev environment and tooling](dev-environment-tooling/knowledge.md)

**bun run reset:db**  
Full local DB reset: compose down, up, db:push, db:seed with prime data. *Region:* [Dev environment and tooling](dev-environment-tooling/knowledge.md)

**bun run setup**  
Per-developer bring-up: prerequisites, sync env, install, Docker, Prisma generate, db push, seed. *Region:* [Dev environment and tooling](dev-environment-tooling/knowledge.md)

**bun test**  
Bun's test runner; from apps/api it injects .env.test via with-env; root bun run test runs the suites. *Region:* [Tests, factories and VCR](testing/knowledge.md)

**bunx atlas query / graph**  
Find files by kind/partOf/uses, or reverse indexes (conceptToFiles, usesConsumers) for whole concepts. *Region:* [Engineering process, docs, Atlas](engineering-process-docs/knowledge.md)

**buttonVariants**  
CVA class generator to style a link or other element like a Button. *Region:* [UI components, layout and theme](ui-components-theme/knowledge.md)

## C

**cache**  
Get-or-compute with TTL (default 24h), single-flight on misses, negative caching of null for 1 minute. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**cacheKey**  
The one builder of canonical keys: cache:{accessor}:{field}:{value}[:{tags}][:*]. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**cacheReference**  
The reverse-reference map: per model, every cache key a record is reachable by; cleared after commit on mutation. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**caching**  
The read-through cache(): cache keys, TTLs, single-flight, mutation-driven invalidation. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**canDeliver**  
Shared gate for email and messaging: system passes, otherwise the kind must be in acceptedKinds. *Region:* [Delivery, messaging and contacts](delivery-messaging-contacts/knowledge.md)

**canSubscribe**  
Authorizes a channel subscribe by probing the canonical HTTP route with the socket's sanitized credentials; only 2xx grants. *Region:* [WebSockets and data streams](websockets/knowledge.md)

**captureTraceContext / withRemoteTrace**  
Serialize the active trace into a carrier and resume it in another process. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**Cascade resolution**  
Owner-tier walk that picks the winning row: user chain (SpaceUser → OrganizationUser → User → default) or org chain (Space → Organization → default). *Region:* [Email templates and rendering](email-templates/knowledge.md)

**CASCADE_EXEMPT**  
Relations a model references but does not own, skipped by the tombstone cascade. *Region:* [Mutation hooks and write lifecycle](mutation-hooks/knowledge.md)

**cassette**  
Recorded, sanitized provider response keyed by call and version; status >= 400 replays as a thrown error. *Region:* [Tests, factories and VCR](testing/knowledge.md)

**channelKey**  
Builds a channel name from operation id and path params, dropping query, headers and body; parseChannelKey reverses it. *Region:* [WebSockets and data streams](websockets/knowledge.md)

**check**  
Evaluate a rule against rows in memory; returns true or the failing error text. *Region:* [json-rules, lenses and rule references](json-rules-lenses/knowledge.md)

**check**  
The ReBAC evaluator: check(permix, rebacSchema, model, hydratedRecord, action), merging row rules additively. *Region:* [Tenancy and Permissions](tenancy-permissions/knowledge.md)

**check-generated-files.sh**  
Fails when the Prisma client or OpenAPI SDK is out of date. *Region:* [Dev environment and tooling](dev-environment-tooling/knowledge.md)

**check-import-aliases**  
Fails on relative internal imports that should use #/ or @template/. *Region:* [Naming, style and lint](naming-style/knowledge.md)

**checkContextPermission**  
Tries current context, then the space's organization, user, public; switches to the first that allows the page. *Region:* [Frontend apps, routes and navigation](frontend-apps-navigation/knowledge.md)

**checkFlow**  
Re-evaluates steps from step 0 as the caller; computes stepStates and currentStep, deletes when done. *Region:* [Inquiries and Flows](inquiries-flows/knowledge.md)

**ci-deploy**  
Class: CI/CD pipelines, the full check, deploy environments and scripts. *Region:* [Dev environment and tooling](dev-environment-tooling/knowledge.md)

**circuit breaker**  
A subscription auto-disables after 5 consecutive failed events. *Region:* [App events, webhooks, adapters](app-events-webhooks-adapters/knowledge.md)

**Circuit breaker**  
ENTRYPOINT §3: stop and ask when scope grows, >3 files, >2 failed attempts or a new abstraction is needed. *Region:* [Engineering process, docs, Atlas](engineering-process-docs/knowledge.md)

**claimLane**  
Writes jobId as the holder of a Redis lane with a TTL; the last claim wins. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**clamp**  
A where restriction ANDed into a lens (clampLens) or injected into a rule at each anchor (narrowRule). *Region:* [json-rules, lenses and rule references](json-rules-lenses/knowledge.md)

**Clean status list**  
All steps rendered upfront with done / spinner / pending markers instead of streaming logs. *Region:* [Init provisioning TUI](init-script/knowledge.md)

**cleanStaleData**  
Singleton cron handler that hard-deletes rows idle past a retention window. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**cleanupTouchedTables**  
afterAll truncation of only the tables written during the suite. *Region:* [Tests, factories and VCR](testing/knowledge.md)

**clearKey**  
Delete an exact cache key or a wildcard pattern via SCAN. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**clientIp**  
Non-null caller IP from the trusted x-forwarded-for hop, IPv6 bucketed to /64. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**ClientSlice**  
Holds the TanStack QueryClient and ApiWebsocket so they are reachable outside React. *Region:* [Frontend store and API client](frontend-state-api-client/knowledge.md)

**cn**  
clsx + tailwind-merge helper for conditional class names. *Region:* [UI components, layout and theme](ui-components-theme/knowledge.md)

**code-style**  
Class: formatting, no comments, TypeScript rules, imports. *Region:* [Naming, style and lint](naming-style/knowledge.md)

**color-mix shades**  
--primary-1..4 derived by mixing with white (light) or black (dark) unless a space overrides them. *Region:* [UI components, layout and theme](ui-components-theme/knowledge.md)

**communication-preferences**  
Class tag: CommunicationKind opt-in/opt-out via acceptedKinds and canDeliver, plus unsubscribe links. *Region:* [Delivery, messaging and contacts](delivery-messaging-contacts/knowledge.md)

**CommunicationKind**  
system (always delivered), platform and activity (opt-out), marketing (opt-in). *Region:* [Delivery, messaging and contacts](delivery-messaging-contacts/knowledge.md)

**CommunicationLog**  
Per-recipient delivery ledger and dedup fence (idempotencyKey @unique), grouped by sendKey, with status and reasonCode. *Region:* [Delivery, messaging and contacts](delivery-messaging-contacts/knowledge.md)

**CommunicationReasonCode**  
Why a failed row failed, e.g. not_found, render_failed, ambiguous_timeout, quota_exceeded, unsubscribe_unavailable. *Region:* [Delivery, messaging and contacts](delivery-messaging-contacts/knowledge.md)

**CommunicationStatus**  
queued → sending → sent, or failed / suppressed / undeliverable; only queued is open to delivery. *Region:* [Delivery, messaging and contacts](delivery-messaging-contacts/knowledge.md)

**{{#component:slug}}**  
Inline block markup that marks a reusable component inside authored MJML. *Region:* [Email templates and rendering](email-templates/knowledge.md)

**componentRefs**  
Pre-computed, slug-keyed list of components an MJML body references; resolved through the cascade at read time, never stored as ids. *Region:* [Email templates and rendering](email-templates/knowledge.md)

**componentVersions**  
AuditLog map of slug → child snapshot id stamped by the emailVersioning hook, forming the version tree. *Region:* [Email templates and rendering](email-templates/knowledge.md)

**composeNarrowed**  
Compute a source's narrowed lens so the builder gates choices against it. *Region:* [Rule builder editor model](rules-builder/knowledge.md)

**composeTemplate**  
Phase 1 of render: resolve a template by slug through the cascade and expand its components; returns the winning owner. *Region:* [Email templates and rendering](email-templates/knowledge.md)

**Concept registry**  
.atlas/concepts.ts CONCEPTS: class:name → module/package/docs; structure only, broad but closed. *Region:* [Engineering process, docs, Atlas](engineering-process-docs/knowledge.md)

**concurrency-limits**  
Class tag: in-process coordination with serialized queues, getConcurrency caps and resolveAll bounded batches. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**ConcurrencyType**  
Resource classes with caps: db, redis, queue, socket, integration, etc. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**Condition**  
The json-rules rule AST type; StrictCondition / StrictRule pair each operator with its operand type. *Region:* [json-rules, lenses and rule references](json-rules-lenses/knowledge.md)

**Condition**  
The json-rules rule AST the builder owns and emits. *Region:* [Rule builder editor model](rules-builder/knowledge.md)

**conditions**  
The json-rules rule every segment carries; a hand-picked audience is a static rule over customer-ref ids. *Region:* [Customers and segments](customers-segments/knowledge.md)

**config sync / config check**  
Apply versions.json pins and presets locally / verify them read-only in CI. *Region:* [Monorepo layout and build](monorepo-architecture/knowledge.md)

**config train**  
@inixiative/config release command (--lane=primitives|agentic) that publishes ecosystem packages in dependency order. *Region:* [Dev environment and tooling](dev-environment-tooling/knowledge.md)

**ConfigProvider**  
Root context in init/utils/configState.tsx; the single source of config for every view. *Region:* [Init provisioning TUI](init-script/knowledge.md)

**Contact**  
One false-polymorphic table (User / Organization / Space owner) for phone, email, website and social handles, ordered by position. *Region:* [Delivery, messaging and contacts](delivery-messaging-contacts/knowledge.md)

**ContactRegistry**  
Maps each ContactType to its ContactTypeDef: inputSchema, parseInput, valueSchema, toValueKey, subtype, uniqueness, display. *Region:* [Delivery, messaging and contacts](delivery-messaging-contacts/knowledge.md)

**contactRules**  
Before-mutation hook that validates and canonicalizes every Contact write through the registry. *Region:* [Delivery, messaging and contacts](delivery-messaging-contacts/knowledge.md)

**contacts**  
Class tag: the Contact model, its per-type registry, URL/handle parsers and contact rules. *Region:* [Delivery, messaging and contacts](delivery-messaging-contacts/knowledge.md)

**contentSchema**  
Zod schema for the type-specific payload stored in inquiry.content on create and update. *Region:* [Inquiries and Flows](inquiries-flows/knowledge.md)

**context**  
Factory result map of created related entities keyed by camelCase accessor names; passed back in to reuse them. *Region:* [Tests, factories and VCR](testing/knowledge.md)

**ContextSelector**  
AppShell control for switching Personal/Organization/Space; reads tenant and auth from the store. *Region:* [Frontend apps, routes and navigation](frontend-apps-navigation/knowledge.md)

**Create and see**  
Start a flow without pre-checking; if every step already holds it returns complete and is never stored. *Region:* [Inquiries and Flows](inquiries-flows/knowledge.md)

**createApiWebsocket**  
Client socket that reconnects, replays identity then subscribes then opens, and tracks last seq per stream. *Region:* [WebSockets and data streams](websockets/knowledge.md)

**createAppQueryClient**  
Builds each app's QueryClient with global error handling and registers it in the client slice. *Region:* [Frontend store and API client](frontend-state-api-client/knowledge.md)

**createConsoleClient**  
Dev/test email client that logs instead of sending. *Region:* [Delivery, messaging and contacts](delivery-messaging-contacts/knowledge.md)

**createEncryption**  
Low-level encrypt/decrypt service built from a keyring; prefer encryptField/decryptField for model fields. *Region:* [Field-level encryption](encryption/knowledge.md)

**createFactory**  
Defines a typed build/create factory for a Prisma model with defaults and only non-inferable dependencies. *Region:* [Tests, factories and VCR](testing/knowledge.md)

**createFrontendLogger**  
Scoped, level-controlled consola logger for browser apps (FrontendScope). *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**createLock**  
Single-node Redis lock with heartbeat lease renewal and fenced release; only one process owns a resource. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**createManyAndReturn / updateManyAndReturn**  
The bulk writes hooks support; plain createMany/updateMany throw. *Region:* [Mutation hooks and write lifecycle](mutation-hooks/knowledge.md)

**createOptimisticListTarget**  
Builds a create/update/delete optimistic target for a list query from variables.path.id and variables.body. *Region:* [Frontend store and API client](frontend-state-api-client/knowledge.md)

**createRedisConnection**  
Open a dedicated connection, e.g. for BullMQ queue and worker. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**createResendClient**  
Real email client over Resend with a caller-supplied API key. *Region:* [Delivery, messaging and contacts](delivery-messaging-contacts/knowledge.md)

**createRoute**  
Route template for inserting a record (many: true for createMany); imported from #/lib/routeTemplates, never from @hono/zod-openapi. *Region:* [API routes and schemas](api-routes-schemas/knowledge.md)

**createS3Client**  
Provider factory building the memoized S3-backed StorageClient from typed config. *Region:* [App events, webhooks, adapters](app-events-webhooks-adapters/knowledge.md)

**createSerializedQueue**  
In-process promise chain; each run(fn) waits for the previous to settle. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**createTestApp**  
Builds the API app for route tests with mockUser, mockOrganizationUsers, mockSpaceUsers and mount; returns fetch and db. *Region:* [Tests, factories and VCR](testing/knowledge.md)

**createTestSocket**  
Fakes a WebSocket handle with WSData for socket handler tests. *Region:* [Tests, factories and VCR](testing/knowledge.md)

**createTestStore**  
Isolated app store with a retry-free query client for UI tests; testStore is the shared default. *Region:* [Tests, factories and VCR](testing/knowledge.md)

**createTestWorker**  
Runs a job handler in tests with a mock job and worker context; createMockJob for just a Job object. *Region:* [Tests, factories and VCR](testing/knowledge.md)

**createView**  
Build a view over a lens or narrowing in hand, with sourceValues. *Region:* [Rule builder editor model](rules-builder/knowledge.md)

**createX**  
Factory variant that persists the entity and its dependencies. *Region:* [Tests, factories and VCR](testing/knowledge.md)

**cron**  
Class: DB-stored CronJob schedules, BullMQ repeatables, manual trigger and retention cleanup. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**CronJob**  
Model for a recurring job: name, jobId, UTC pattern, handler, payload, enabled, maxAttempts, backoffMs. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**cronJobSync**  
Hook that moves a BullMQ repeatable when a CronJob row is created, updated or deleted. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**ctx.enqueueChildJob**  
Adds a child to the running staged job (only inside a stage); never pass `parent` to enqueueJob. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**ctx.log**  
Logs to both stdout and the job's BullBoard log. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**ctx.log**  
Job-handler logger that dual-writes to the facade and BullBoard. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**ctx.signal**  
Cooperative abort signal a superseding job checks to stop work. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**cursorPaginate**  
Keyset pagination returning items with nextCursor and hasMore. *Region:* [List filtering and pagination](filtering-pagination/knowledge.md)

**CustomerModel**  
Discriminator for the customer side of a CustomerRef. *Region:* [Customers and segments](customers-segments/knowledge.md)

**CustomerRef**  
A customer (User, Organization or Space) linked to the provider (User, Organization or Space) serving it; the segment rule root. *Region:* [Customers and segments](customers-segments/knowledge.md)

**customerRefLens**  
Lens declaring the CustomerRef fields and relations a segment rule may read (contacts, tags, communications, segment memberships). *Region:* [Customers and segments](customers-segments/knowledge.md)

**customers**  
Class tag: CustomerRef customer/provider pairs, provider routes and the customer-ref lens. *Region:* [Customers and segments](customers-segments/knowledge.md)

## D

**Data stream**  
A live view of one read route's default response: open → snapshot → appends → close, with per-stream seq. *Region:* [WebSockets and data streams](websockets/knowledge.md)

**{ data } envelope**  
Every response is wrapped in { data }; pagination and other metadata ride alongside. *Region:* [API routes and schemas](api-routes-schemas/knowledge.md)

**data-modeling**  
Class: schema conventions such as split schema, UUIDv7 and typed IDs, enum naming, FK typing and false polymorphism. *Region:* [Database client and schema](database/knowledge.md)

**DataConfig**  
Frontend config from makeDataConfig(operationId): searchable/orderable fields, enum filters, default order. *Region:* [List filtering and pagination](filtering-pagination/knowledge.md)

**db**  
The shared Prisma client from `@template/db`; inside an open transaction `db.<model>` routes to it. *Region:* [Database client and schema](database/knowledge.md)

**db-client**  
Class: the transaction-aware Prisma client `db` and its scope, transaction and callback methods plus the delegate query helpers. *Region:* [Database client and schema](database/knowledge.md)

**db-scripts**  
Class: the `bun run db:*` commands (generate, push, migrate, deploy, dump, restore, clone, studio) and constraint helpers. *Region:* [Database client and schema](database/knowledge.md)

**db.findForUpdate**  
SELECT … FOR UPDATE inside db.txn; with upserting: true it fences a not-yet-existing key with a Redis lock. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**db.findForUpdate**  
SELECT ... FOR UPDATE inside db.txn; `{ upserting: true }` fences a not-yet-existing row with a Redis lock. *Region:* [Database client and schema](database/knowledge.md)

**db.onCommit**  
Defers a callback until the surrounding transaction commits; emitAppEvent and the webhook hook use it. *Region:* [App events, webhooks, adapters](app-events-webhooks-adapters/knowledge.md)

**db.onCommit**  
Queues callbacks to run only after the surrounding transaction commits; throws outside db.txn. *Region:* [Database client and schema](database/knowledge.md)

**db.onFinally**  
Queues callbacks for when the transaction ends, commit or rollback. *Region:* [Database client and schema](database/knowledge.md)

**db.raw**  
The raw client: bypasses the current transaction and the mutation hooks. *Region:* [Database client and schema](database/knowledge.md)

**db.raw**  
Client that bypasses transactions and hooks; only for deliberate hook skipping. *Region:* [Mutation hooks and write lifecycle](mutation-hooks/knowledge.md)

**db.scope**  
Opens an AsyncLocalStorage scope (request id or `job:name:id`) carrying transaction state. *Region:* [Database client and schema](database/knowledge.md)

**db.scope**  
AsyncLocalStorage scope keyed by request UUID or job ID; read with db.getScopeId() and db.getScopeContext() ('api' | 'worker'). *Region:* [Request context, errors, batch](request-context-errors-batch/knowledge.md)

**db.txn**  
Opens a transaction, or merges into the outermost one already open in this scope. *Region:* [Database client and schema](database/knowledge.md)

**db.withDeleted**  
The single bypass of soft-delete scoping; must be awaited inside; mounted for admin routes by validateSuperadmin. *Region:* [Mutation hooks and write lifecycle](mutation-hooks/knowledge.md)

**db:clone**  
Copies a remote database locally and truncates webhook subscriptions so production webhooks don't fire. *Region:* [Database client and schema](database/knowledge.md)

**db:push**  
Pushes the Prisma schema to the database without a migration file. *Region:* [Database client and schema](database/knowledge.md)

**debounce**  
Class tag: debouncing values and callbacks before they hit the backend (useDebounce). *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**Decomposition by Default**  
ENTRYPOINT §0.2: split distinct concerns, lifecycles and owners into separate records/functions. *Region:* [Engineering process, docs, Atlas](engineering-process-docs/knowledge.md)

**Decoration**  
Presentational layer that hoists lens paths to the root selector as named facets and relabels fields and values. *Region:* [Rule builder editor model](rules-builder/knowledge.md)

**decryptField**  
Type-safe helper that decrypts a registered field from a record using the current or previous key. *Region:* [Field-level encryption](encryption/knowledge.md)

**DecryptFieldInput**  
Type of the record shape decryptField accepts for a given model and key. *Region:* [Field-level encryption](encryption/knowledge.md)

**defaultExpirationDays**  
Days until a sent inquiry expires (via computeExpiresAt); omit for no expiry. *Region:* [Inquiries and Flows](inquiries-flows/knowledge.md)

**defineStream**  
Declares a stream family (operationId) with kind, ordering, params schema and audience. *Region:* [WebSockets and data streams](websockets/knowledge.md)

**degraded rule**  
A rule with missing bindings, a lens that no longer admits it, or dead references; it never matches and degradation is never stored. *Region:* [json-rules, lenses and rule references](json-rules-lenses/knowledge.md)

**Degraded segment**  
A segment whose rule (or a segment it depends on) is broken; keeps members and is skipped by reconciliation and sweep. *Region:* [Customers and segments](customers-segments/knowledge.md)

**deletedAt**  
Soft-delete timestamp; its presence makes a model soft-deletable. *Region:* [Mutation hooks and write lifecycle](mutation-hooks/knowledge.md)

**deleteRoute**  
Route template for deleting a record by id; its controller answers respond.noContent(). *Region:* [API routes and schemas](api-routes-schemas/knowledge.md)

**deliverability**  
Cached address validity on Contact; distinct from preference (acceptedKinds) and channel ownership (verifiedAt). *Region:* [Delivery, messaging and contacts](delivery-messaging-contacts/knowledge.md)

**deliverEmail**  
Per-recipient job (body in deliverEmailMessage) that settles, gates, renders, claims, sends and records one email. *Region:* [Delivery, messaging and contacts](delivery-messaging-contacts/knowledge.md)

**deliverEmailHandoffs**  
Email bridge that enqueues sendEmail for handoffs with deterministic planner job ids. *Region:* [Delivery, messaging and contacts](delivery-messaging-contacts/knowledge.md)

**dependencies**  
Class: third-party dependency inventory and tech stack. *Region:* [Monorepo layout and build](monorepo-architecture/knowledge.md)

**Dependency direction**  
apps → @template/permissions, @template/email → @template/db, @template/shared; web → shared, ui. *Region:* [Monorepo layout and build](monorepo-architecture/knowledge.md)

**dependsOn**  
Task ordering; ^ means a workspace dependency's task; drives the db:generate → generate:openapi → generate:sdk chain. *Region:* [Monorepo layout and build](monorepo-architecture/knowledge.md)

**descriptor tree**  
The headless tree of GroupNode / LeafNode / ArrayNode a renderer draws (buildRoot, buildActionRoot, useRuleBuilder). *Region:* [Rule builder editor model](rules-builder/knowledge.md)

**DetailPanel / MasterDetailLayout**  
Scrolling detail view with fixed header; list pane beside detail pane. *Region:* [UI components, layout and theme](ui-components-theme/knowledge.md)

**dev-setup**  
Class: setup, local run, sanctioned scripts, Docker services, debugging. *Region:* [Dev environment and tooling](dev-environment-tooling/knowledge.md)

**disabledText**  
Button/Input/DropdownMenuItem prop that disables the element and shows why. *Region:* [UI components, layout and theme](ui-components-theme/knowledge.md)

**Doc alignment review**  
Agent-driven pass comparing each doc to code: dead code, orphaned, outdated, missing docs, unwired code. *Region:* [Engineering process, docs, Atlas](engineering-process-docs/knowledge.md)

**docs-process**  
Class: docs workflow: read before, update after, doc structure and alignment review, doc routing. *Region:* [Engineering process, docs, Atlas](engineering-process-docs/knowledge.md)

**Dot-path delegation**  
{ rel: 'sourceSpace.organization', action } jumps to an ancestor and skips intermediate delegation; stricter than single-hop. *Region:* [Tenancy and Permissions](tenancy-permissions/knowledge.md)

**Drain loop**  
Per-worker ~2s interval (startOutboxDrainLoop) that, under a Redis lock, re-enqueues outbox rows fast-first. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**Dual-key rotation**  
Current and previous keys both decrypt during the rotation window, so no request fails mid-rotation. *Region:* [Field-level encryption](encryption/knowledge.md)

**dynamic reference**  
A rule source whose referenced rows can't be known at save (bind, path, contains, between); save refuses it. *Region:* [json-rules, lenses and rule references](json-rules-lenses/knowledge.md)

## E

**{{#each}}**  
Loop block over a collection; rules inside it are rewritten into array rules by scopedRule. *Region:* [Email templates and rendering](email-templates/knowledge.md)

**email-delivery**  
Class tag: email sending through the sendEmail planner, deliverEmail, senders and provider adapters. *Region:* [Delivery, messaging and contacts](delivery-messaging-contacts/knowledge.md)

**email-templates**  
Class tag: email templates and components, MJML, component refs, cascade, render/save, the email lens and rule blocks. *Region:* [Email templates and rendering](email-templates/knowledge.md)

**EmailComponent**  
Prisma model for a reusable MJML fragment (header, footer, button) referenced by slug from templates or other components. *Region:* [Email templates and rendering](email-templates/knowledge.md)

**EmailEntry**  
Registry entry per template slug: entity, sender, recipients, cc, bcc and data as lenses, plus render policy. *Region:* [Delivery, messaging and contacts](delivery-messaging-contacts/knowledge.md)

**EmailHandoff**  
{ template, data } returned by a handler's email selector; recipients and sender come from the email registry. *Region:* [App events, webhooks, adapters](app-events-webhooks-adapters/knowledge.md)

**EmailHandoff**  
What an app-event handler returns to request a templated email: template slug plus binding data, never recipients. *Region:* [Delivery, messaging and contacts](delivery-messaging-contacts/knowledge.md)

**EmailLens**  
Four lenses, one per scope root, that decide which tokens, paths and rules a template may use. *Region:* [Email templates and rendering](email-templates/knowledge.md)

**EmailLens**  
Four per-root lenses (sender, recipient, data, system) every email token, path and rule goes through. *Region:* [json-rules, lenses and rule references](json-rules-lenses/knowledge.md)

**emailLensFor**  
API builder of a slug's owner-scoped email lens from the registry entry, DEFAULT_RECIPIENT_NARROWING and the row's stored slots. *Region:* [Email templates and rendering](email-templates/knowledge.md)

**EmailOwnerModel**  
Owner discriminator for email rows: default, admin, Organization, Space, and the user tiers User, OrganizationUser, SpaceUser. *Region:* [Email templates and rendering](email-templates/knowledge.md)

**EmailTemplate**  
Prisma model for a whole sendable MJML message with slug, locale, subject, kind, componentRefs and owner. *Region:* [Email templates and rendering](email-templates/knowledge.md)

**emailTemplateAuditLogId**  
CommunicationLog column pinning the template snapshot that was sent, used by recompose. *Region:* [Email templates and rendering](email-templates/knowledge.md)

**emailVerifier**  
Address verification via Bouncer (createBouncerVerifier), or no-op without a key; verdict cached on Contact.deliverability for 30 days. *Region:* [Delivery, messaging and contacts](delivery-messaging-contacts/knowledge.md)

**emitAppEvent**  
emitAppEvent(name, data): builds the actor envelope and runs the registered handler, after commit when inside db.txn(). *Region:* [App events, webhooks, adapters](app-events-webhooks-adapters/knowledge.md)

**emitFromCassette**  
Replays recorded cassette events onto an emitter for event-stream providers. *Region:* [Tests, factories and VCR](testing/knowledge.md)

**EmptyState**  
Icon/title/description/action block; Table renders it automatically for empty data. *Region:* [UI components, layout and theme](ui-components-theme/knowledge.md)

**ENCRYPTED_MODELS**  
Registry mapping each model to its encrypted field configs; adding an entry is the only step to encrypt a field. *Region:* [Field-level encryption](encryption/knowledge.md)

**EncryptedFieldData**  
The payload { ciphertext, version, iv, authTag }, stored across the encrypted, metadata and version columns. *Region:* [Field-level encryption](encryption/knowledge.md)

**encryptField**  
Type-safe helper encryptField<Model, Key>(model, key, record) returning the three column values to persist. *Region:* [Field-level encryption](encryption/knowledge.md)

**encryption**  
Class tag: field-level encryption (AES-256-GCM), keyrings, key rotation, CI version validation. *Region:* [Field-level encryption](encryption/knowledge.md)

**encryptionEnv**  
Env schema builder for all registered prefixes; validates integer version and 256-bit base64 keys. *Region:* [Field-level encryption](encryption/knowledge.md)

**engineering-process**  
Class: how agents work here: why-first, decomposition, YAGNI both ways, verification, reuse what exists. *Region:* [Engineering process, docs, Atlas](engineering-process-docs/knowledge.md)

**enqueueJob**  
The one way to queue a job by handler name with options (delay, attempts, type, lane, bypass); inline in tests. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**Entitlements**  
JSON boolean grants on OrganizationUser or Token, merged over role actions as an allow override. *Region:* [Tenancy and Permissions](tenancy-permissions/knowledge.md)

**enumOmits**  
Hides enum values from the SDK type surface; paired with root.where for server enforcement. *Region:* [List filtering and pagination](filtering-pagination/knowledge.md)

**env schema**  
Zod schema in apps/<app>/src/config/env.ts; the only place env vars are declared, coerced and defaulted. *Region:* [Dev environment and tooling](dev-environment-tooling/knowledge.md)

**env-config**  
Class: environment names and detection, env files, Infisical, with-env composition, adding env vars. *Region:* [Dev environment and tooling](dev-environment-tooling/knowledge.md)

**{ENV_PREFIX}_ENCRYPTION_KEY_CURRENT**  
Base64 32-byte key used to encrypt; generate with openssl rand -base64 32. *Region:* [Field-level encryption](encryption/knowledge.md)

**{ENV_PREFIX}_ENCRYPTION_KEY_PREVIOUS**  
Prior key kept for decryption during rotation; removable once all rows are on the new version. *Region:* [Field-level encryption](encryption/knowledge.md)

**{ENV_PREFIX}_ENCRYPTION_VERSION**  
Integer current key version (not "v2"); previous version is derived as current - 1. *Region:* [Field-level encryption](encryption/knowledge.md)

**Environment**  
Type of the canonical environment names: local, test, pr, staging, prod. *Region:* [Dev environment and tooling](dev-environment-tooling/knowledge.md)

**envPrefix**  
Registry entry's env var prefix, e.g. AUTH_PROVIDER_SECRETS, for its three keyring vars. *Region:* [Field-level encryption](encryption/knowledge.md)

**errorHandlerMiddleware**  
app.onError handler that maps ZodError, Prisma errors, ResponseValidationError, AppError and raw Error to the right response. *Region:* [Request context, errors, batch](request-context-errors-batch/knowledge.md)

**errorReporter**  
Adapter singleton: Sentry (createSentryReporter) when enabled with a DSN, console reporter otherwise. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**errors**  
Class: makeError/AppError, the global errorHandlerMiddleware, HTTP_ERROR_MAP and the status conventions. *Region:* [Request context, errors, batch](request-context-errors-batch/knowledge.md)

**estimateSegmentReach**  
Counts customers matching unsaved conditions with the same admission checks as save (the reach endpoint). *Region:* [Customers and segments](customers-segments/knowledge.md)

**execAsync**  
promisify(exec) wrapper every init/api CLI call uses; execSync there is a bug. *Region:* [Init provisioning TUI](init-script/knowledge.md)

**executePrismaPlan**  
Run a toPrisma plan's groupBy steps and return the resolved Prisma where. *Region:* [json-rules, lenses and rule references](json-rules-lenses/knowledge.md)

## F

**Facet**  
A named root-selector entry: a leaf, a collection (array node) or a branch (scoped group). *Region:* [Rule builder editor model](rules-builder/knowledge.md)

**factory**  
createX / buildX from @template/db/test: (overrides?, context?) => Promise<{ entity, context }>. *Region:* [Tests, factories and VCR](testing/knowledge.md)

**fail open**  
When Redis is down, rate limits allow the request (warn and report) and cache reads fall through. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**False polymorphism**  
A discriminator enum plus one nullable typed FK per kind, instead of a `type` + `id` pair; gives real FK constraints and typed includes. *Region:* [Database client and schema](database/knowledge.md)

**FEATURES.md / COMPARISONS.md**  
Subsystem inventory and comparisons to consult before concluding something is missing. *Region:* [Engineering process, docs, Atlas](engineering-process-docs/knowledge.md)

**FEATURES.md / COMPARISONS.md**  
Status-marked subsystem inventory and comparisons; check before concluding something is missing. *Region:* [Monorepo layout and build](monorepo-architecture/knowledge.md)

**fetchAndHydrateMe**  
Loads /me into the store and runs permissions.setup. *Region:* [Authentication and Users](authentication-users/knowledge.md)

**fetchAndHydrateMe**  
Fetches /me, hydrates the auth slice and calls permissions.setup(me); components call auth.refreshMe instead. *Region:* [Frontend store and API client](frontend-state-api-client/knowledge.md)

**fetchOne**  
Fetch one hydrated record by identifier, cached in Redis with a TTL. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**Field triplet**  
Column convention encrypted{Field}, encrypted{Field}EncryptionMetadata, encrypted{Field}EncryptionKeyVersion. *Region:* [Field-level encryption](encryption/knowledge.md)

**fieldErrors**  
Optional per-field messages on 422 errors; Zod issues map onto it automatically for forms. *Region:* [Request context, errors, batch](request-context-errors-batch/knowledge.md)

**FieldKind**  
json-rules field type classification used to pick operators (getOperatorsForKind). *Region:* [Rule builder editor model](rules-builder/knowledge.md)

**FieldMap / FieldMapSet**  
Per-model field descriptions (kinds, relations, isRequired) a lens is built over; a FieldMapSet holds several sources and needs mapName. *Region:* [json-rules, lenses and rule references](json-rules-lenses/knowledge.md)

**file-based routing**  
TanStack Router scans app/routes and generates a type-safe route tree (bun run generate:routes). *Region:* [Frontend apps, routes and navigation](frontend-apps-navigation/knowledge.md)

**filtering-search**  
List filtering, search and orderBy: bracket query notation, buildWhereClause, searchable and orderable fields. *Region:* [List filtering and pagination](filtering-pagination/knowledge.md)

**filterLens**  
A list route's LensNarrowing over lensFor(Model) that controls which fields can be filtered and sorted, not the response shape. *Region:* [List filtering and pagination](filtering-pagination/knowledge.md)

**filterLens**  
A route's LensNarrowing over lensFor(Model) controlling accepted filters and sorting, not response shape. *Region:* [json-rules, lenses and rule references](json-rules-lenses/knowledge.md)

**FindForUpdateLockTimeoutError**  
Thrown when the create-if-missing fence is not acquired within waitMs (default 3000ms), rolling back the transaction. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**findOwnedIntegration**  
Loads an integration by id only if the caller's user or organization owns it. *Region:* [App events, webhooks, adapters](app-events-webhooks-adapters/knowledge.md)

**findRoute / findRouteAcrossContexts**  
Match a path to its nav item within one context, or across contexts. *Region:* [Frontend apps, routes and navigation](frontend-apps-navigation/knowledge.md)

**fixed window**  
A counter per scope, window and identity: limit:{scope}:{windowMs}:{identity}. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**FK auto-inference**  
Factories infer dependencies from {modelName}Id fields; non-standard or composite FKs need a dependencies entry. *Region:* [Tests, factories and VCR](testing/knowledge.md)

**Flow**  
Row holding a user's active guided flow: flowKey, stored steps and returnUrl. *Region:* [Inquiries and Flows](inquiries-flows/knowledge.md)

**FlowBanner**  
The Continue/Finish button mounted once per app in __root.tsx. *Region:* [Inquiries and Flows](inquiries-flows/knowledge.md)

**FlowKey**  
Enum naming each registered flow, e.g. setUpOrganization. *Region:* [Inquiries and Flows](inquiries-flows/knowledge.md)

**flowNext**  
The single rule deciding Finish, Continue to the step's page, or nothing. *Region:* [Inquiries and Flows](inquiries-flows/knowledge.md)

**flowRegistry**  
Map from FlowKey to its FlowDefinition (bindingsSchema and steps). *Region:* [Inquiries and Flows](inquiries-flows/knowledge.md)

**flows**  
Class: guided in-app flows: registry, server-checked steps and the FlowBanner client. *Region:* [Inquiries and Flows](inquiries-flows/knowledge.md)

**FlowStep**  
key, label, to, advance, readPath and a json-rules rule over { data }. *Region:* [Inquiries and Flows](inquiries-flows/knowledge.md)

**flushRedis**  
Clears the in-memory Redis mock between tests; throws outside tests. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**frontend-auth**  
Class: the frontend auth slice, login and signup forms, OAuth callback and route guards. *Region:* [Authentication and Users](authentication-users/knowledge.md)

**frontend-routing**  
Class: the three frontend apps, their file routes, layouts and app shells. *Region:* [Frontend apps, routes and navigation](frontend-apps-navigation/knowledge.md)

**frontend-store**  
Class: the shared Zustand store, its six slices, access patterns and how to add or remove a slice. *Region:* [Frontend store and API client](frontend-state-api-client/knowledge.md)

**_fullscreen**  
Layout route: requireAuth + FullscreenLayout without AppShell, for invoices, previews, print, embeds, focused flows. *Region:* [Frontend apps, routes and navigation](frontend-apps-navigation/knowledge.md)

## G

**.gen. files**  
Template-owned generated artifacts (routeTree.gen.ts, prismaMap.gen.ts, openapi.local.gen.json) ignored by git, lint, search and task inputs. *Region:* [Monorepo layout and build](monorepo-architecture/knowledge.md)

**generate:openapi**  
Turbo task that produces the OpenAPI spec from the API routes; the SDK is generated from it. *Region:* [API routes and schemas](api-routes-schemas/knowledge.md)

**generate:sdk**  
Script that regenerates @template/sdk from openapi.gen.json; SDK_ENVIRONMENT targets a non-local env. *Region:* [Frontend store and API client](frontend-state-api-client/knowledge.md)

**generated zod schemas**  
packages/db/src/generated/zod/, produced by prisma-zod-generator on db:generate, e.g. UserCreateInputObjectZodSchema. *Region:* [API routes and schemas](api-routes-schemas/knowledge.md)

**get / post / patch / del / json**  
Request builders and typed response parser from #tests/utils/request; jsonError for error bodies. *Region:* [Tests, factories and VCR](testing/knowledge.md)

**getActor**  
Resolves { user, organization, organizationUser, space, spaceUser, token } for any auth kind: session, user/OrganizationUser/SpaceUser/Organization/Space token. *Region:* [Request context, errors, batch](request-context-errors-batch/knowledge.md)

**getConcurrency**  
Returns the tightest predefined cap across the ConcurrencyType resources touched. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**getContextParams**  
Turns tenant context into [model, record] for permissions.check in access rules. *Region:* [Frontend apps, routes and navigation](frontend-apps-navigation/knowledge.md)

**getContextParams**  
Returns [model, record] for the current tenant context, for frontend permission checks. *Region:* [Tenancy and Permissions](tenancy-permissions/knowledge.md)

**getNextSeq**  
Incrementing number for unique test values. *Region:* [Tests, factories and VCR](testing/knowledge.md)

**getProjectConfig**  
Reads project.config.ts via a timestamp-busted dynamic import so repeat reads are fresh. *Region:* [Init provisioning TUI](init-script/knowledge.md)

**getRedisClient**  
The shared main connection for all non-blocking commands. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**getRedisSub / getRedisPub**  
The dedicated subscriber connection (SUBSCRIBE blocks) and the publisher client. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**getResource**  
Reads the record resourceContextMiddleware loaded for the route's :id, typed by generic (getResource<'organization'>(c)). *Region:* [Request context, errors, batch](request-context-errors-batch/knowledge.md)

**getSecret / setSecret**  
Read or store a secret in Infisical by project, environment and path; the source for secrets on resume. *Region:* [Init provisioning TUI](init-script/knowledge.md)

**getState()**  
useAppStore.getState(): reads state or calls actions outside React components and in handlers. *Region:* [Frontend store and API client](frontend-state-api-client/knowledge.md)

**getValidatedBody / getValidatedQuery**  
Typed validated body/query for code that only has a generic Context<AppEnv>, avoiding the c.req.valid cast. *Region:* [Request context, errors, batch](request-context-errors-batch/knowledge.md)

**Guest user**  
A User created by findUserOrCreateGuest for an email with no account yet. *Region:* [Authentication and Users](authentication-users/knowledge.md)

**guidance**  
Behaviour hint for the UI in the error body: fixInput, reauthenticate, requestPermission, tryAgain, refreshAndRetry, contactSupport. *Region:* [Request context, errors, batch](request-context-errors-batch/knowledge.md)

## H

**handleApprove**  
The handler's side effect when an inquiry is approved. *Region:* [Inquiries and Flows](inquiries-flows/knowledge.md)

**handlers/index.ts**  
Registry of JobHandlerName, JobPayloads and jobHandlers; every new handler is added here. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**happy-dom**  
DOM for frontend tests via @happy-dom/global-registrator preloaded from bunfig.toml. *Region:* [Tests, factories and VCR](testing/knowledge.md)

**HARD_DELETE_ON_TOMBSTONE**  
Ephemeral grant models (Session, Token, WebhookSubscription) hard-deleted on cascade so a revive can't restore them. *Region:* [Mutation hooks and write lifecycle](mutation-hooks/knowledge.md)

**health route**  
apps/api/src/routes/health answers process health checks. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**heartbeat**  
Self-scheduling timer that runs the next beat only after the previous settles; returns stop(). *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**HookTiming / DbAction**  
Enums naming when a hook runs (before/after) and on which operations (create, update, deleteMany, ...). *Region:* [Mutation hooks and write lifecycle](mutation-hooks/knowledge.md)

**HTTP_ERROR_MAP**  
Single source in @template/shared/errors of each status's label, message and default guidance; error types derive from it. *Region:* [Request context, errors, batch](request-context-errors-batch/knowledge.md)

**hydrate**  
Loads a record's schema relations recursively with deduplicated fetches, instead of hand-written includes. *Region:* [Database client and schema](database/knowledge.md)

**Hydration**  
Loading a record's parent chain (createHydrator) so check() can walk its relations. *Region:* [Tenancy and Permissions](tenancy-permissions/knowledge.md)

## I

**idempotencyKey**  
Event-anchored, hash-last key: planner {event}:{template}:{hash(data)}; deliver adds sender, email and contents hashes. *Region:* [Delivery, messaging and contacts](delivery-messaging-contacts/knowledge.md)

**Idempotent create**  
Create call that treats 'already exists' as success and returns the existing id (createRailwayConnection, createRailwaySync, ensureRailwayConnection). *Region:* [Init provisioning TUI](init-script/knowledge.md)

**Idempotent rotation**  
updateManyAndReturn with the old version in the where clause, so a rerun or a racing worker never double-encrypts. *Region:* [Field-level encryption](encryption/knowledge.md)

**identity**  
The function keying a bucket: userIdentity, principalIdentity, spaceIdentity, organizationIdentity, ipIdentity. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**{{#if rule=…}}**  
Conditional block whose json-rules condition is checked at save and evaluated through the lens at render. *Region:* [Email templates and rendering](email-templates/knowledge.md)

**immutable-fields**  
Class: silent stripping of id, createdAt, FKs and configured fields from update data. *Region:* [Mutation hooks and write lifecycle](mutation-hooks/knowledge.md)

**ImmutableFieldsOverrides**  
Per-model include/exclude adjustments to the default immutable set (id, createdAt, all FKs). *Region:* [Mutation hooks and write lifecycle](mutation-hooks/knowledge.md)

**includeCustomer**  
Prisma include for the customer side, used when a provider lists its customers. *Region:* [Customers and segments](customers-segments/knowledge.md)

**includeProvider**  
Prisma include for the provider side, used when a customer lists its providers. *Region:* [Customers and segments](customers-segments/knowledge.md)

**index route**  
Where a page moves when its segment gains children (bots/index.tsx + bots/$id.tsx). *Region:* [Frontend apps, routes and navigation](frontend-apps-navigation/knowledge.md)

**Infisical**  
Secret store for pr, staging and prod; configured by init, .infisical.json marks it set up. *Region:* [Dev environment and tooling](dev-environment-tooling/knowledge.md)

**Infisical**  
Secret store init configures first; later tasks store and read credentials there. *Region:* [Init provisioning TUI](init-script/knowledge.md)

**inheritToSpaces**  
Flag letting a Space resolve its Organization's template or component in the cascade. *Region:* [Email templates and rendering](email-templates/knowledge.md)

**init-script**  
Class: the init provisioning TUI (Ink): resumable idempotent tasks, Infisical/Railway/PlanetScale provisioning. *Region:* [Init provisioning TUI](init-script/knowledge.md)

**initGracefulShutdown**  
Installs signal handling that runs onShutdown handlers within a timeout; called once. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**initializeTelemetry**  
Starts process telemetry once from readTelemetryConfig('api'|'worker'). *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**@inixiative/config**  
Shared toolchain package: tsconfig/biome/tsup presets, versions.json BOM, sync/check/scan/train CLI. *Region:* [Monorepo layout and build](monorepo-architecture/knowledge.md)

**inquiries**  
Class: the Inquiry request/approval primitive, its handlers, sources/targets and autoApprove. *Region:* [Inquiries and Flows](inquiries-flows/knowledge.md)

**Inquiry**  
A source-to-target request with type, status, content, resolution, sentAt and expiresAt. *Region:* [Inquiries and Flows](inquiries-flows/knowledge.md)

**InquiryHandler**  
Per-type definition of sources, targets, schemas, validate, handleApprove, autoApprove, unique and expiry. *Region:* [Inquiries and Flows](inquiries-flows/knowledge.md)

**InquiryResourceModel**  
The party enum on both ends: admin, User, OrganizationUser, Organization, Space, SpaceUser, Integration, Token. *Region:* [Inquiries and Flows](inquiries-flows/knowledge.md)

**InquiryStatus**  
draft, sent, changesRequested, approved, denied, canceled. *Region:* [Inquiries and Flows](inquiries-flows/knowledge.md)

**inquiryTerminalStatuses**  
Backend closed states [approved, denied, canceled] for notIn queries. *Region:* [Inquiries and Flows](inquiries-flows/knowledge.md)

**InquiryType**  
Enum of inquiry kinds, e.g. inviteOrganizationUser, createSpace, updateSpace, transferSpace. *Region:* [Inquiries and Flows](inquiries-flows/knowledge.md)

**inStreamOrder**  
Per-stream in-process serialized queue for WebSocket publish ordering. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**Integration**  
A named provider connection owned by a user, organization, OrganizationUser, space or SpaceUser. *Region:* [App events, webhooks, adapters](app-events-webhooks-adapters/knowledge.md)

**IntegrationRecord**  
Links an Integration to a synced CustomerRef, with poisonedAt for repeated rejections. *Region:* [App events, webhooks, adapters](app-events-webhooks-adapters/knowledge.md)

**integrations**  
Class: owner Integrations (provider connections) and the IntegrationRecords they sync. *Region:* [App events, webhooks, adapters](app-events-webhooks-adapters/knowledge.md)

**interpolate**  
Phase 2 of render, per recipient: evaluate conditions and substitute tokens, narrowed to the lens, reporting issues to a sink. *Region:* [Email templates and rendering](email-templates/knowledge.md)

**interpolation**  
<<roundIndex.requestIndex.path>> in a later round's path, body or headers, resolved from an earlier round's response. *Region:* [Request context, errors, batch](request-context-errors-batch/knowledge.md)

**Interrogate before proposing**  
ENTRYPOINT §0.4: for shape-finding work, ask and surface forks before a closed proposal. *Region:* [Engineering process, docs, Atlas](engineering-process-docs/knowledge.md)

**intersectEntitlements**  
Keeps only entitlement keys true in both the membership and the token. *Region:* [Tenancy and Permissions](tenancy-permissions/knowledge.md)

**isNoOpUpdate**  
Shared no-op detection: an update touching only ignored fields skips cache clearing. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**isNoOpUpdate / NOOP_FIELDS / HOOK_IGNORE_FIELDS**  
Shared registry of noise fields (updatedAt, lastLoginAt, positions) whose change alone is a no-op for audit, cache and webhooks. *Region:* [Mutation hooks and write lifecycle](mutation-hooks/knowledge.md)

**isProgressComplete**  
Checks whether a named step already finished, so a re-run skips it. *Region:* [Init provisioning TUI](init-script/knowledge.md)

**isTerminalInquiry**  
Frontend terminal check that also treats a past expiresAt as terminal. *Region:* [Inquiries and Flows](inquiries-flows/knowledge.md)

**isTest / isLocal / isPR / isStaging / isProd**  
Flags from packages/shared/src/utils/env.ts set from ENVIRONMENT. *Region:* [Dev environment and tooling](dev-environment-tooling/knowledge.md)

**isUniqueConstraintError / isWriteConflictError**  
Detect Prisma P2002 duplicate keys and P2034 write conflicts/deadlocks in a caught error. *Region:* [Request context, errors, batch](request-context-errors-batch/knowledge.md)

## J

**job-lanes**  
Class: fast/slow lanes via withLanePriority, slow slot share and the lane-divided depth budget. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**job-outbox**  
Class: the JobOutbox overflow buffer and its spill, accumulator and drain loop. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**JobLane**  
`fast` or `slow`; a label on the job envelope (JobData.lane), defaulting to fast. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**JobOutbox**  
DB table holding spilled ad-hoc job intent (handlerName, jobId, dedupeKey, lane, data, options) for later drain. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**jobs**  
Class: BullMQ background jobs, i.e. the makeJob wrappers, handler registry, enqueueJob and the worker. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**JobType**  
`adhoc` (one-off), `cron` (repeater) or `cronTrigger` (manual cron run); gates overflow routing. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**json-rules**  
The @inixiative/json-rules engine: a JSON rule AST plus compilers (check, toPrisma, toSql), lenses and introspection. *Region:* [json-rules, lenses and rule references](json-rules-lenses/knowledge.md)

## K

**keepClampColumns**  
projectRows option that keeps hidden clamp columns for re-checking; never returned to viewers. *Region:* [json-rules, lenses and rule references](json-rules-lenses/knowledge.md)

**keyof typeof**  
Derive a union type from a const object so values live in one place. *Region:* [Naming, style and lint](naming-style/knowledge.md)

**Keyring**  
One field's set of keys and version from env: current key, optional previous key, integer version. *Region:* [Field-level encryption](encryption/knowledge.md)

**keyset cursor**  
An opaque cursor packing sort chain, last-row values and filter hash (encodeCursor / decodeCursor / buildKeysetWhere). *Region:* [List filtering and pagination](filtering-pagination/knowledge.md)

**@kind**  
The file's role from .atlas/kinds.ts (controller, service, registry...), never a layer. *Region:* [Engineering process, docs, Atlas](engineering-process-docs/knowledge.md)

**kind**  
How a stream folds and which ops it accepts: list (upsert, remove; rows keyed by id) or log (append). *Region:* [WebSockets and data streams](websockets/knowledge.md)

## L

**laneKey**  
Builds the lane key from (handlerName, dedupeKey). *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**LaunchView / launch.ts**  
Launch preflight and confirmation that sets the launched flag. *Region:* [Init provisioning TUI](init-script/knowledge.md)

**LeafNode**  
A scalar field condition row; exposes valid plus field.valid / value.valid and its reachable scopes. *Region:* [Rule builder editor model](rules-builder/knowledge.md)

**leave**  
Self action letting a user remove their own membership or token ({ self: 'userId' }). *Region:* [Tenancy and Permissions](tenancy-permissions/knowledge.md)

**lefthook**  
Pre-commit hooks from @inixiative/config/lefthook/base.yml running typecheck and Biome on staged files. *Region:* [Naming, style and lint](naming-style/knowledge.md)

**Lens**  
A composed view over field maps (createLens, lensFor) that rules, filters and renders are gated against. *Region:* [json-rules, lenses and rule references](json-rules-lenses/knowledge.md)

**lenses**  
Lenses and narrowings that bound which models, columns, relations and rows a rule, filter or render may see. *Region:* [json-rules, lenses and rule references](json-rules-lenses/knowledge.md)

**LensNarrowing**  
A layer that narrows its parent lens's schema, enums, relations and row where; layers only narrow. *Region:* [json-rules, lenses and rule references](json-rules-lenses/knowledge.md)

**LensScope**  
The scope a lens binds rule conditions to; lensScopeSurface lists its values and to-many loop portals. *Region:* [Rule builder editor model](rules-builder/knowledge.md)

**lesserRole**  
Returns the lowest of several roles; caps a token's role at its user's role. *Region:* [Tenancy and Permissions](tenancy-permissions/knowledge.md)

**lint-rules**  
Class: Biome, custom lint scripts and the CI rule runner that enforce style. *Region:* [Naming, style and lint](naming-style/knowledge.md)

**List state persistence**  
readInitialState / writeToHistoryState / writeToHistoryStateAndUrl keep list state in history.state, or the URL when shareable. *Region:* [Frontend store and API client](frontend-state-api-client/knowledge.md)

**[:] literal segment**  
Bracket marker passing a real null, true or false instead of a string. *Region:* [List filtering and pagination](filtering-pagination/knowledge.md)

**LIVE_QUERIES**  
Set derived from WS_CHANNELS that gates which mounted queries subscribe over the socket. *Region:* [WebSockets and data streams](websockets/knowledge.md)

**locks**  
Class tag: mutual exclusion across processes and rows (createLock, withOwnerLock, db.findForUpdate). *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**log**  
The shared logger facade from @template/shared/logger; per-app frontend `log` exports wrap createFrontendLogger. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**log.child**  
Component logger with bound fields. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**LOG_LEVEL**  
Env var filtering every facade output including OTLP and BullBoard broadcasts. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**logging**  
Class: structured logging: shared log facade, withLogContext, scopes, redaction. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**logScope / LogScope**  
Display-only scope prefix; LogScope.worker etc. are the predefined scopes. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**loop portal**  
A to-many relation exposed by a scope surface as an entry into a nested element scope. *Region:* [Rule builder editor model](rules-builder/knowledge.md)

**Loop prevention**  
Excluding generated outputs from task inputs so watch mode doesn't regenerate forever. *Region:* [Monorepo layout and build](monorepo-architecture/knowledge.md)

**lua-in-queries**  
CI rule: each Redis Lua script lives with its eval function in the module's queries/ folder. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

## M

**make***  
Prefix for factories and curried builders (makeController, makeError). *Region:* [Naming, style and lint](naming-style/knowledge.md)

**makeAdapterRouter**  
Picks the provider for process.env.ENVIRONMENT with a default; the standard adapter wrapper. *Region:* [App events, webhooks, adapters](app-events-webhooks-adapters/knowledge.md)

**makeAppEvent**  
Defines an event handler { email, websocket, cb } whose tasks run isolated with allSettled and aggregated failures. *Region:* [App events, webhooks, adapters](app-events-webhooks-adapters/knowledge.md)

**makeBroadcastRegistry**  
Registers providers by name and runs an operation on all of them via Promise.allSettled. *Region:* [App events, webhooks, adapters](app-events-webhooks-adapters/knowledge.md)

**makeContextQueries**  
Maps user/organization/space contexts to one query each for a list shown in several contexts; missing context throws. *Region:* [Frontend store and API client](frontend-state-api-client/knowledge.md)

**makeController**  
Binds a handler to a route, exposing only the responders the route declares and validating the response payload. *Region:* [API routes and schemas](api-routes-schemas/knowledge.md)

**makeError**  
Factory for a throwable AppError with status, message, guidance, fieldErrors and headers; apps/api only. *Region:* [Request context, errors, batch](request-context-errors-batch/knowledge.md)

**makeJob**  
Basic typed job wrapper; with `stages` and `finish` it becomes a staged fan-out-and-wait job. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**makeSingletonJob**  
Job wrapper that takes a createLock before running so only one run happens at a time across workers. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**makeSingletonJob**  
Wrapper whose Redis lock (5 min TTL, 1 min heartbeat) lets only one run execute at a time. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**makeSupersedingJob**  
Job wrapper where a newer job with the same dedupe key supersedes older runs. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**makeSupersedingJob**  
Wrapper where a newer job with the same dedupe key supersedes the older one via `ctx.signal`; cooperative, does not kill. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**makeUnrefInterval**  
Recurring in-process tick that starts once, stops cleanly and never blocks exit. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**Mandatory task intake**  
ENTRYPOINT §1: restate mode, scope, goal, non-goals, pattern, abstractions, validation, stop condition. *Region:* [Engineering process, docs, Atlas](engineering-process-docs/knowledge.md)

**MAP.md**  
Generated concept map at repo root (atlas generate); never hand-edited. *Region:* [Engineering process, docs, Atlas](engineering-process-docs/knowledge.md)

**mapDefaults**  
Per-model narrowing (where, sources) applied wherever that model appears in the lens; used by redactLens and omitForeignKeys. *Region:* [json-rules, lenses and rule references](json-rules-lenses/knowledge.md)

**mapRefs**  
Extracts component blocks from MJML, deduplicating identical variants and indexing different ones (:0, :1). *Region:* [Email templates and rendering](email-templates/knowledge.md)

**markComplete**  
Persists a named provider step as done in project config progress. *Region:* [Init provisioning TUI](init-script/knowledge.md)

**--max-concurrency=1**  
Required for DB-backed test scripts so files don't truncate each other's tables. *Region:* [Tests, factories and VCR](testing/knowledge.md)

**messageContact**  
Messaging job: pre-rendered content to one Contact after canDeliver. *Region:* [Delivery, messaging and contacts](delivery-messaging-contacts/knowledge.md)

**MessageProviderAdapter**  
(contact, content, kind, options) => Promise<void>; the per-ContactType channel sender registered on messageProviderRegistry. *Region:* [Delivery, messaging and contacts](delivery-messaging-contacts/knowledge.md)

**messageUser**  
Messaging job: users matched by a json-rules rule through the sender's recipient lens, rendered and sent to each accepting contact. *Region:* [Delivery, messaging and contacts](delivery-messaging-contacts/knowledge.md)

**messaging**  
Class tag: non-email channels dispatched through per-ContactType message provider adapters. *Region:* [Delivery, messaging and contacts](delivery-messaging-contacts/knowledge.md)

**MinIO**  
Local S3 container; ephemeral buckets created by minio-init.sh, per-slot buckets by minio-provision.sh. *Region:* [Dev environment and tooling](dev-environment-tooling/knowledge.md)

**Modal**  
Dialog with size and dismissOnBackdrop; its close button continues an active flow. *Region:* [UI components, layout and theme](ui-components-theme/knowledge.md)

**<Model>ScalarSchema**  
Generated zod schema of a Prisma model's scalar fields from @template/db; the default response schema. *Region:* [API routes and schemas](api-routes-schemas/knowledge.md)

**ModelNames / AccessorNames**  
PascalCase model names (`User`) versus camelCase client accessors (`user`), with is*/to* guards and converters. *Region:* [Database client and schema](database/knowledge.md)

**Modules**  
Type-safe registry of model names used as route-template model/submodel values. *Region:* [API routes and schemas](api-routes-schemas/knowledge.md)

**monorepo-layout**  
Class: workspaces, packages, path aliases, import direction, where things live. *Region:* [Monorepo layout and build](monorepo-architecture/knowledge.md)

**Mutation lifecycle**  
Hook stage between controllers and the DB: rules, immutable fields, cache, webhooks. *Region:* [Monorepo layout and build](monorepo-architecture/knowledge.md)

**mutation-hooks**  
Class: the hook registry and mutationLifeCycle extension, hook-safe bulk writes and model write rules. *Region:* [Mutation hooks and write lifecycle](mutation-hooks/knowledge.md)

**mutationLifeCycle**  
The Prisma extension that wraps every mutation in a transaction and runs before/after hooks. *Region:* [Database client and schema](database/knowledge.md)

**mutationLifeCycle**  
Prisma extension wrapping every mutation in a transaction with before/after hooks and `previous`. *Region:* [Mutation hooks and write lifecycle](mutation-hooks/knowledge.md)

## N

**_name / __name**  
Single underscore = unused binding; double underscore = private/internal (class members, brands, module state). *Region:* [Naming, style and lint](naming-style/knowledge.md)

**naming**  
Class: naming conventions for identifiers, files, routes, schema names, polymorphic side names, vocabulary. *Region:* [Naming, style and lint](naming-style/knowledge.md)

**NavConfig**  
Per-app map of context type (user, organization, space, public) to NavItem[]. *Region:* [Frontend apps, routes and navigation](frontend-apps-navigation/knowledge.md)

**navigatePreserving**  
navigation slice call: navigate keeping 'context' (org/space+spoof+flow), 'spoof' (spoof+flow) or 'all' params. *Region:* [Frontend apps, routes and navigation](frontend-apps-navigation/knowledge.md)

**navigation**  
Class: nav config, permission-gated items, tenant context switching and URL context. *Region:* [Frontend apps, routes and navigation](frontend-apps-navigation/knowledge.md)

**NavigationSlice**  
Stored router navigate, navConfig, currentRouteMatch, flowId and navigatePreserving. *Region:* [Frontend store and API client](frontend-state-api-client/knowledge.md)

**NavItem**  
label, path, icon, title, description, access, alias, breadcrumbLabel, items. *Region:* [Frontend apps, routes and navigation](frontend-apps-navigation/knowledge.md)

**negative caching**  
Caching a null/undefined result briefly (1 minute) to stop thundering herds. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**No comments**  
Hard rule: code self-documents; only the @atlas block and a rare one-line non-obvious why are allowed. *Region:* [Naming, style and lint](naming-style/knowledge.md)

**No TS enum**  
Use const objects `as const` or Prisma enums instead of the enum keyword. *Region:* [Naming, style and lint](naming-style/knowledge.md)

**no-create-race-machinery**  
CI rule that fails a change adding a bare .upsert( or a unique-violation catch. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**no-create-race-machinery**  
CI rule failing a change that adds bare upsert or unique-violation catches. *Region:* [Naming, style and lint](naming-style/knowledge.md)

**no-inline-env-coercion**  
CI rule forbidding casting or defaulting process.env outside the central env schema. *Region:* [Dev environment and tooling](dev-environment-tooling/knowledge.md)

**no-isarray-cast**  
CI rule forbidding casts after Array.isArray narrowing. *Region:* [Naming, style and lint](naming-style/knowledge.md)

**no-prisma-maps**  
CI rule banning field @map and model @@map so Prisma names equal DB identifiers. *Region:* [Naming, style and lint](naming-style/knowledge.md)

**no-radix**  
CI rule forbidding Radix UI imports (menus/selects use Ariakit). *Region:* [UI components, layout and theme](ui-components-theme/knowledge.md)

**node / react (tsup presets)**  
Shared tsup build presets for Node and React packages. *Region:* [Monorepo layout and build](monorepo-architecture/knowledge.md)

**normalizeEmail**  
Lowercases and trims an email before storing or comparing. *Region:* [Authentication and Users](authentication-users/knowledge.md)

**now contract**  
Relative and calendar date expressions require an explicit now (plus timeZone / weekStart). *Region:* [json-rules, lenses and rule references](json-rules-lenses/knowledge.md)

## O

**object-storage**  
Class: the env-routed S3 storage client behind the storage adapter, and its buckets. *Region:* [App events, webhooks, adapters](app-events-webhooks-adapters/knowledge.md)

**observeRegistry**  
Broadcasts every envelope to the structured log and database adapters; best-effort, not a retry queue. *Region:* [App events, webhooks, adapters](app-events-webhooks-adapters/knowledge.md)

**One-time token (ott)**  
Single-use token in the OAuth callback URL fragment, exchanged for the session via completeOAuthSignIn. *Region:* [Authentication and Users](authentication-users/knowledge.md)

**onIssue**  
Registry render policy: platform (stable unbranded fallback), fail (retry/DLQ), or degrade (send with empty blocks). *Region:* [Email templates and rendering](email-templates/knowledge.md)

**onLockLost**  
createLock callback fired when the lease is lost so the holder can stop its critical work. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**onShutdown**  
Registers a cleanup handler for graceful shutdown. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**OPAQUE_SLOT**  
The opaque data bag, addressable at any depth; a loop over it may not read lens-backed roots (opaqueLoopIssue). *Region:* [Email templates and rendering](email-templates/knowledge.md)

**openapi**  
Class: file-based route registration and OpenAPI 3.1 spec generation from the route definitions. *Region:* [API routes and schemas](api-routes-schemas/knowledge.md)

**OpenAPIHono**  
The Hono router class every module router (userRouter, adminUserRouter) is an instance of. *Region:* [API routes and schemas](api-routes-schemas/knowledge.md)

**openDataStream**  
Resolves the stream route, reads the seq, runs the route in-process for the snapshot, and subscribes the socket. *Region:* [WebSockets and data streams](websockets/knowledge.md)

**operationId**  
Generated name in the resourceActionSubresource pattern (userCreate, organizationReadManySpaces, adminOrganizationReadMany). *Region:* [API routes and schemas](api-routes-schemas/knowledge.md)

**orderBy**  
?orderBy[]=field:direction sort parameter, auto-injected as an enum for lens routes. *Region:* [List filtering and pagination](filtering-pagination/knowledge.md)

**ordered-lists**  
Class: dense 1..N position columns kept by the orderedList hook from orderedListRegistry. *Region:* [Mutation hooks and write lifecycle](mutation-hooks/knowledge.md)

**orderedListRegistry**  
Declares a model's ordered field and the scope keys partitioning it into independent lists. *Region:* [Mutation hooks and write lifecycle](mutation-hooks/knowledge.md)

**ordering**  
List-stream upsert precedence: 'updatedAt' (default, newer wins) or 'arrival' (last to arrive wins). *Region:* [WebSockets and data streams](websockets/knowledge.md)

**Organization**  
Top-level tenant; owns users, spaces, tokens and content, fully isolated from other organizations. *Region:* [Tenancy and Permissions](tenancy-permissions/knowledge.md)

**OrganizationUser**  
A user's membership in one organization, with role and entitlements. *Region:* [Tenancy and Permissions](tenancy-permissions/knowledge.md)

**organize by domain**  
Components go in the folder of the domain that uses them (settings/CreateTokenModal), not components/modals/. *Region:* [UI components, layout and theme](ui-components-theme/knowledge.md)

**OrgSelector**  
Reusable org/workspace picker component; its onCancel prop is required. *Region:* [Init provisioning TUI](init-script/knowledge.md)

**OTEL_SERVICE_NAME**  
Base service name; processes append -api, -worker, -web, -admin, -superadmin. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**OTLP**  
OpenTelemetry protocol; OTEL_EXPORTER_OTLP_ENDPOINT base URL, per-signal endpoints are complete URLs. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**Overflow flag**  
Per-lane Redis key (`job:overflow`, `job:overflow:slow`) set NX with a drain-renewed TTL when depth crosses the cap. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**owner**  
Polymorphic side used for tenancy only. *Region:* [Naming, style and lint](naming-style/knowledge.md)

**ownerActions**  
Helper generating own/manage/operate/read fan-out across user, organization and space owner FKs. *Region:* [Tenancy and Permissions](tenancy-permissions/knowledge.md)

## P

**Page**  
Standard page body: title, description?, actions?, children. *Region:* [UI components, layout and theme](ui-components-theme/knowledge.md)

**paginate**  
Offset pagination helper: reads query and lens from context, returns data plus page/pageSize/total/totalPages. *Region:* [List filtering and pagination](filtering-pagination/knowledge.md)

**pagination**  
Offset and cursor pagination: paginate(), cursorPaginate(), response metadata and the frontend pagination hooks. *Region:* [List filtering and pagination](filtering-pagination/knowledge.md)

**@partOf**  
Concepts the file is a member of; removing the file breaks them. *Region:* [Engineering process, docs, Atlas](engineering-process-docs/knowledge.md)

**partOfFor**  
Config helper assigning @partOf by module/package path capture in stamp rules. *Region:* [Engineering process, docs, Atlas](engineering-process-docs/knowledge.md)

**Pass the delegate**  
Hand `db.user` to a generic helper (`query.findMany(db.user, args)`) so types infer, instead of `db[toAccessor(model)]`. *Region:* [Database client and schema](database/knowledge.md)

**PasswordInput**  
Input with a show/hide toggle for secrets. *Region:* [UI components, layout and theme](ui-components-theme/knowledge.md)

**Pattern discovery**  
ENTRYPOINT §4: find 2-3 similar modules and extract their patterns before implementing. *Region:* [Engineering process, docs, Atlas](engineering-process-docs/knowledge.md)

**permissionRules**  
Optional JSON column of row-level ActionRules that only widen access (typically read only). *Region:* [Tenancy and Permissions](tenancy-permissions/knowledge.md)

**permissions**  
Class: roles, actions, Permix, ReBAC walks, entitlements, row-level overrides and validatePermission. *Region:* [Tenancy and Permissions](tenancy-permissions/knowledge.md)

**PermissionsSlice**  
Permix instance with setup(me), check(model, record, action) and clear(). *Region:* [Frontend store and API client](frontend-state-api-client/knowledge.md)

**permix**  
The per-request Permix permission checker, empty until auth middleware sets it up. *Region:* [Request context, errors, batch](request-context-errors-batch/knowledge.md)

**permix**  
Per-request permission checker created in prepareRequest; setup loads grants, check answers them, setSuperadmin bypasses. *Region:* [Tenancy and Permissions](tenancy-permissions/knowledge.md)

**picks**  
The columns a filterLens makes filterable; columns only, a relation name there is a wrong_kind error. *Region:* [List filtering and pagination](filtering-pagination/knowledge.md)

**picks / omits**  
Which columns a narrowing keeps; columns only, never relations. *Region:* [json-rules, lenses and rule references](json-rules-lenses/knowledge.md)

**pinoLogger**  
Native Pino instance for third-party SDKs only; bypasses the OTLP/broadcast pipeline. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**#pkg filter**  
Turborepo syntax `task#package` that runs a task in one package (local#api). *Region:* [Monorepo layout and build](monorepo-architecture/knowledge.md)

**Platform providers**  
Social providers enabled by env vars (getPlatformProviders), not database rows. *Region:* [Authentication and Users](authentication-users/knowledge.md)

**PlatformRole**  
System-wide role on User: user or superadmin (superadmin bypasses all permission checks). *Region:* [Tenancy and Permissions](tenancy-permissions/knowledge.md)

**poisoned record**  
IntegrationRecord.poisonedAt set after 3 receiver rejections (400/422) while other records deliver; later deliveries skip it. *Region:* [App events, webhooks, adapters](app-events-webhooks-adapters/knowledge.md)

**Polymorphic side names**  
`owner` for tenancy only, `source`/`target` for directed edges, `resource` for one-sided slots, `subject` for what a record is about, `actor` for who acted; never `referenced*`. *Region:* [Database client and schema](database/knowledge.md)

**Polymorphic sides**  
owner, source/target, resource, subject, actor as `<side>Model` plus side-prefixed FKs and relations; never referenced*. *Region:* [Naming, style and lint](naming-style/knowledge.md)

**PolymorphismRegistry**  
Single declaration of each model's polymorphic axes (typeField → fkMap); read via getPolymorphismConfig. *Region:* [Database client and schema](database/knowledge.md)

**ports.json**  
@inixiative/config port registry: each project gets service default + 100 x its block. *Region:* [Dev environment and tooling](dev-environment-tooling/knowledge.md)

**POST /api/v1/batch/execute**  
The Batch API endpoint: { strategy, requests: rounds[][], headers? } → 200 with batch results and summary. *Region:* [Request context, errors, batch](request-context-errors-batch/knowledge.md)

**PR environment**  
Ephemeral pr deployment per pull request with its own DB branch and Infisical secrets, cleaned on merge. *Region:* [Dev environment and tooling](dev-environment-tooling/knowledge.md)

**Preflight**  
Pre-send checks on a template (subject present, images have alt, preheader, spam phrases, unresolved lens paths) via runPreflight / emailTemplatePreflight. *Region:* [Email templates and rendering](email-templates/knowledge.md)

**prepareRequest**  
First middleware: sets db, requestId, bracketQuery, a fresh permix, nulls auth/resource vars, wraps the request in db.scope(requestId); minimal setup for /api/batch. *Region:* [Request context, errors, batch](request-context-errors-batch/knowledge.md)

**Prerequisites**  
First view: CLI and session checks via checkPrerequisites before any task runs. *Region:* [Init provisioning TUI](init-script/knowledge.md)

**preset facet**  
A facet that seeds a fixed reusable rule, optionally with tunable Variables. *Region:* [Rule builder editor model](rules-builder/knowledge.md)

**preventHardDelete**  
Hook blocking delete/deleteMany on models that may only be soft-deleted. *Region:* [Mutation hooks and write lifecycle](mutation-hooks/knowledge.md)

**previous**  
The pre-mutation row(s), fetched automatically for update, upsert and delete and passed to hooks. *Region:* [Mutation hooks and write lifecycle](mutation-hooks/knowledge.md)

**Previous ∪ Result**  
Invalidation clears keys derived from both the old and new row so value keys (email, slug) don't go stale. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**Prime data**  
Seed records marked `prime: true`, dev-only, loaded with `db:seed --prime` and skipped in production. *Region:* [Database client and schema](database/knowledge.md)

**primitives**  
packages/ui/src/components/primitives: Shadcn-based base UI (Button, Input, Card, Table, Select, ...). *Region:* [UI components, layout and theme](ui-components-theme/knowledge.md)

**PrismaMap**  
Runtime model/field/relation map built by @inixiative/prisma-map and generated into prismaMap.gen.ts. *Region:* [Database client and schema](database/knowledge.md)

**process-lifecycle**  
Class: graceful shutdown handlers, health checks, connection draining, unref intervals. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**ProfileFormCard**  
Name/slug form shared by the three profile pages; showThemeToggle adds the theme picker. *Region:* [UI components, layout and theme](ui-components-theme/knowledge.md)

**progress flag**  
One persisted boolean per externally verifiable provider fact; never an umbrella flag over several remote writes. *Region:* [Init provisioning TUI](init-script/knowledge.md)

**project.config.ts**  
Project config file holding project metadata and per-provider progress flags. *Region:* [Init provisioning TUI](init-script/knowledge.md)

**projection**  
What a narrowed lens exposes (projectLens); projectRows strips rows to it. *Region:* [json-rules, lenses and rule references](json-rules-lenses/knowledge.md)

**prompt()**  
init/utils/prompts.ts helper composing keyboard hint text from commands in a fixed order. *Region:* [Init provisioning TUI](init-script/knowledge.md)

**ProviderModel**  
Discriminator for the provider side of a CustomerRef, and for a Segment's owner. *Region:* [Customers and segments](customers-segments/knowledge.md)

**_public**  
Layout route for unauthenticated pages (login, signup, auth.callback). *Region:* [Frontend apps, routes and navigation](frontend-apps-navigation/knowledge.md)

**publishMembershipChanges**  
Emits segment.membersAdded/Removed and customerRef.segmentsAdded/Removed for non-empty diffs. *Region:* [Customers and segments](customers-segments/knowledge.md)

## Q

**query**  
Delegate helper object (findMany, findUnique, update, del, ...) typed from the delegate you pass. *Region:* [Database client and schema](database/knowledge.md)

**query key**  
The SDK-generated key (e.g. organizationReadQueryKey) that every apiQuery must be paired with. *Region:* [Frontend store and API client](frontend-state-api-client/knowledge.md)

**Query-refetch hint**  
{ category: 'query', action: 'refetch', key: { _id, path? } }: tells the client to invalidate and refetch over HTTP. *Region:* [WebSockets and data streams](websockets/knowledge.md)

**Quick Doc Routing**  
ENTRYPOINT §11 table mapping task type to the docs/claude file to read first. *Region:* [Engineering process, docs, Atlas](engineering-process-docs/knowledge.md)

## R

**rate-limiting**  
Fixed-window rate limits keyed by user, space, organization or IP, answering 429 with Retry-After. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**rateLimit**  
Middleware that ANDs fixed-window rules and 429s with Retry-After when any bucket is over its max. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**rateLimitMax**  
The single seam resolving a tier's max (for subscriptions / feature flags), never a column. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**rawView**  
A view over a raw record with every relation on, for permissions and transitions rules. *Region:* [Rule builder editor model](rules-builder/knowledge.md)

**readAsCaller / readAllAsCaller**  
Read one API path (or every page of a list) in-process with the caller's session, permissions and tenancy. *Region:* [Request context, errors, batch](request-context-errors-batch/knowledge.md)

**readRoute**  
Route template for a single read or (many: true) a list, with optional paginate, search, ordering and filterLens. *Region:* [API routes and schemas](api-routes-schemas/knowledge.md)

**ready / WITH GAPS**  
worktree:create outcome: green when every step landed, yellow listing what to rerun. *Region:* [Dev environment and tooling](dev-environment-tooling/knowledge.md)

**ReBAC**  
Relationship-based access: actions delegate along relations (space → organization) instead of being granted per row. *Region:* [Tenancy and Permissions](tenancy-permissions/knowledge.md)

**rebacSchema**  
The per-model table of ActionRules the app enforces (packages/permissions/src/rebac/schema.ts). *Region:* [Tenancy and Permissions](tenancy-permissions/knowledge.md)

**receivedWebhooks**  
In-memory capture of POST /test/webhook deliveries; clearReceivedWebhooks resets it. *Region:* [Tests, factories and VCR](testing/knowledge.md)

**recomposeSnapshot**  
Rebuilds the as-sent composition by splicing pinned component snapshots back into the template snapshot. *Region:* [Email templates and rendering](email-templates/knowledge.md)

**RECONCILE_TRIGGERS**  
Registry mapping each model the segment lens reads to the events that trigger reconciliation. *Region:* [Customers and segments](customers-segments/knowledge.md)

**reconcileCustomerRefSegments**  
Job keyed by { customerModel, customerId } that re-evaluates that customer's refs against dynamic segments; superseding per customer. *Region:* [Customers and segments](customers-segments/knowledge.md)

**reconcileSegment**  
Job/service that recomputes a whole segment through toPrisma and applies the membership diff. *Region:* [Customers and segments](customers-segments/knowledge.md)

**recordDuration / incrementCounter**  
Histogram duration and counter metrics without hand-made meters. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**recurring-timers**  
Class tag: non-overlapping in-process recurring work such as heartbeat and unref intervals. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**redactFields / ignoreFields**  
Registries for sensitive values (shown as [REDACTED]) versus noise fields (dropped before diffing). *Region:* [Mutation hooks and write lifecycle](mutation-hooks/knowledge.md)

**redactLogValue / stringifyLogValue**  
Redact sensitive fields and URLs from a value, as structure or as string. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**redirectPreservingContext**  
Throws a beforeLoad redirect keeping org, space and spoof params. *Region:* [Frontend apps, routes and navigation](frontend-apps-navigation/knowledge.md)

**redirectTo**  
Search param the guard sets so login/signup return the user to the original path. *Region:* [Frontend apps, routes and navigation](frontend-apps-navigation/knowledge.md)

**redis**  
Redis connections, key namespaces and built-in key uses. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**redisNamespace**  
The reserved key prefixes: bull, cache, job, ws, otp, session, limit, lock, lane. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**reference-data**  
Class: static ISO country, currency, language and IANA timezone lists with lookups and zod schemas. *Region:* [Database client and schema](database/knowledge.md)

**refetch**  
Builds a query-refetch hint message for a WebSocket handoff. *Region:* [WebSockets and data streams](websockets/knowledge.md)

**refreshUserContext**  
Clears permissions and reloads the user's memberships mid-request (cached findUserWithRelations) after membership or role changes. *Region:* [Request context, errors, batch](request-context-errors-batch/knowledge.md)

**registerBatch**  
Puts a batch's db and base context in the in-memory batch registry so sub-requests run as the caller; paired with unregisterBatch. *Region:* [Request context, errors, batch](request-context-errors-batch/knowledge.md)

**registerCronJobs**  
Worker-startup sync of enabled CronJob rows to BullMQ repeatables, removing orphans. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**registerDbHook**  
Attaches a named before/after handler to given DbActions on a model or '*'. *Region:* [Mutation hooks and write lifecycle](mutation-hooks/knowledge.md)

**registerHooks**  
Installs all application hooks at startup; called from both API and worker entry points. *Region:* [Mutation hooks and write lifecycle](mutation-hooks/knowledge.md)

**registerInquiryType**  
Registers a type's label and source/target summary, detail, compose and review components. *Region:* [Inquiries and Flows](inquiries-flows/knowledge.md)

**registerTestTracker**  
Starts tracking touched tables; the db client registers it, tests do not call it. *Region:* [Tests, factories and VCR](testing/knowledge.md)

**registry**  
apps/api/src/lib/email/registry.ts: per-slug entry declaring entity lenses, slots and render policy. *Region:* [Email templates and rendering](email-templates/knowledge.md)

**rehydration**  
Recognizing a saved raw rule as its named facet again (matchFacet, lockedLeading, hoist). *Region:* [Rule builder editor model](rules-builder/knowledge.md)

**relations**  
The filterLens key that turns a relation on for filtering; relations are off until enabled. *Region:* [List filtering and pagination](filtering-pagination/knowledge.md)

**relations**  
The narrowing key that turns a relation on and may scope it with its own where; relations are off until turned on. *Region:* [json-rules, lenses and rule references](json-rules-lenses/knowledge.md)

**RenderIssue**  
Typed render-time issue (kind rule | token | each, path, detail) emitted instead of throwing. *Region:* [Email templates and rendering](email-templates/knowledge.md)

**Request context (AppEnv)**  
Per-request db, user, org, space and permissions scoped through AsyncLocalStorage. *Region:* [Monorepo layout and build](monorepo-architecture/knowledge.md)

**request-context**  
Class: the per-request AppEnv context, the middleware that fills it, and the getters handlers read it with. *Region:* [Request context, errors, batch](request-context-errors-batch/knowledge.md)

**request-schemas**  
Class: request/response zod schemas, mostly generated from Prisma (ScalarSchema, CreateInput) and narrowed with sanitize helpers. *Region:* [API routes and schemas](api-routes-schemas/knowledge.md)

**requestId**  
UUID per request, returned as the request-id header and stamped on every error body for log correlation. *Region:* [Request context, errors, batch](request-context-errors-batch/knowledge.md)

**requireAuth**  
Route guard redirecting unauthenticated users to /login?redirectTo=… *Region:* [Authentication and Users](authentication-users/knowledge.md)

**requireAuth / requirePublic**  
beforeLoad guards from @template/ui/guards built by createAuthGuards; both run auth.initialize() first. *Region:* [Frontend apps, routes and navigation](frontend-apps-navigation/knowledge.md)

**requirePublic**  
Route guard redirecting authenticated users away from login and signup. *Region:* [Authentication and Users](authentication-users/knowledge.md)

**resolutionInputSchema**  
What the resolver submits; declared fields (except explanation) may override content. *Region:* [Inquiries and Flows](inquiries-flows/knowledge.md)

**resolutionSchema**  
Full stored resolution shape, including fields computed by handleApprove. *Region:* [Inquiries and Flows](inquiries-flows/knowledge.md)

**resolveAll**  
Promise.all over thunks with an optional cap; results in input order. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**resolvedContent**  
inquiry.content merged with the resolver's declared override fields, passed to handleApprove. *Region:* [Inquiries and Flows](inquiries-flows/knowledge.md)

**resolvedCustomerRefLens**  
customerRefLens bound to one provider owner (ownerModel, ownerId). *Region:* [Customers and segments](customers-segments/knowledge.md)

**resolveOperation**  
Looks up an operationId's route and fills path params for in-process callers. *Region:* [API routes and schemas](api-routes-schemas/knowledge.md)

**resolveSender**  
Loads the sending row through its lens as the sender variable; identity only, not branding. *Region:* [Delivery, messaging and contacts](delivery-messaging-contacts/knowledge.md)

**Resource naming**  
Railway resources named {project}-{env}-{app} from project.config.ts; never hardcoded. *Region:* [Init provisioning TUI](init-script/knowledge.md)

**resourceActionSubresource**  
Route/operationId pattern: userCreate, organizationReadManySpaces, adminOrganizationReadMany. *Region:* [Naming, style and lint](naming-style/knowledge.md)

**resourceContextArgs**  
Per-accessor include/orderBy map that decides which relations resourceContextMiddleware loads, with ResourcePayloadMap typing. *Region:* [Request context, errors, batch](request-context-errors-batch/knowledge.md)

**resourceContextMiddleware**  
Loads the :id resource into context; 404 for zero matches, 409 for several; supports ?lookup= on unique fields. *Region:* [Request context, errors, batch](request-context-errors-batch/knowledge.md)

**respond**  
The responder object a makeController handler receives: respond.ok (200), respond.created (201), respond.noContent (204). *Region:* [API routes and schemas](api-routes-schemas/knowledge.md)

**responseSchema**  
The route's response shape, independent of filterLens. *Region:* [List filtering and pagination](filtering-pagination/knowledge.md)

**ResponsiveDrawer**  
Right drawer at or above breakpoint (default md), Modal below; recommended for detail views. *Region:* [UI components, layout and theme](ui-components-theme/knowledge.md)

**Resume tests**  
init/tasks/tests/*Resume.test.ts using bun:test, mock.module and VCR cassettes queued per init/api client. *Region:* [Init provisioning TUI](init-script/knowledge.md)

**retryWithTimeout**  
utils/retry.ts loop retrying only on specific not-ready errors with a delay and a timeout message. *Region:* [Init provisioning TUI](init-script/knowledge.md)

**revive**  
Restores soft-deleted rows by clearing deletedAt; cascade revive matches the shared timestamp. *Region:* [Mutation hooks and write lifecycle](mutation-hooks/knowledge.md)

**Role**  
Per-membership (and per-token) RBAC role: owner, admin, member, viewer, ordered by roleHierarchy. *Region:* [Tenancy and Permissions](tenancy-permissions/knowledge.md)

**__root**  
Root route: registers nav config (useRegisterNavigation), page meta, theme, websocket and FlowBanner once. *Region:* [Frontend apps, routes and navigation](frontend-apps-navigation/knowledge.md)

**root.where**  
A static server-enforced row filter on the route, AND-merged into every query. *Region:* [List filtering and pagination](filtering-pagination/knowledge.md)

**root.where**  
Predicate on the root rows: decides which rows are in the result set. *Region:* [json-rules, lenses and rule references](json-rules-lenses/knowledge.md)

**rotateEncryptionKeys**  
Singleton job, auto-enqueued at worker startup, that re-encrypts every registered field still on the previous version. *Region:* [Field-level encryption](encryption/knowledge.md)

**round**  
An array of batch sub-requests that run in parallel; rounds run in order. *Region:* [Request context, errors, batch](request-context-errors-batch/knowledge.md)

**route-templates**  
Class: the route factories in #/lib/routeTemplates and the makeController responders that every endpoint is built from. *Region:* [API routes and schemas](api-routes-schemas/knowledge.md)

**routeRow**  
Parses an upsert row with the route's responseSchema and brands it; raw models do not typecheck. *Region:* [WebSockets and data streams](websockets/knowledge.md)

**routes/api vs routes/internal**  
Public tenant endpoints mount under apps/api/src/routes/api; non-public service calls under routes/internal. *Region:* [API routes and schemas](api-routes-schemas/knowledge.md)

**Rule health**  
Whether a segment's rule is sound, derived from its RuleReference edges and their dependency closure. *Region:* [Customers and segments](customers-segments/knowledge.md)

**Rule reference**  
A RuleReference edge from an email template or component to a row its rule names (tag, organization, space, segment), synced on save. *Region:* [Email templates and rendering](email-templates/knowledge.md)

**rule-references**  
RuleReference edges recording the rows a stored rule names, their sync on save, and rule health/degradation. *Region:* [json-rules, lenses and rule references](json-rules-lenses/knowledge.md)

**RULE_REFERENCEABLE_MODELS**  
The targetModel axis of PolymorphismRegistry.RuleReference: which models a rule may reference. *Region:* [json-rules, lenses and rule references](json-rules-lenses/knowledge.md)

**RuleBuilderSource**  
The serializable source a self-contained app stores or a server sends; resolved client-side into a view. *Region:* [Rule builder editor model](rules-builder/knowledge.md)

**RuleErrorSink**  
Callback (issue: RenderIssue) => void that collects render issues for degraded rules, failed filters and empty tokens. *Region:* [Email templates and rendering](email-templates/knowledge.md)

**ruleIssues**  
Rule health issues included on owner reads of a segment; hidden from customer-facing membership reads. *Region:* [Customers and segments](customers-segments/knowledge.md)

**RuleReference**  
One edge row per (rule-bearing source row -> referenced target row), false-polymorphic on both ends. *Region:* [json-rules, lenses and rule references](json-rules-lenses/knowledge.md)

**rules-builder**  
The @inixiative/rules-builder package: headless rule-editor model (views, facets, descriptor tree, pickers) for json-rules Conditions. *Region:* [Rule builder editor model](rules-builder/knowledge.md)

**RulesRegistry**  
Per-model json-rules conditions checked on write; a failing rule throws. *Region:* [Mutation hooks and write lifecycle](mutation-hooks/knowledge.md)

**run-ci-rules.sh**  
Runs scripts/ci/rules/*; --test checks each rule against scripts/ci/rule-violations fixtures. *Region:* [Dev environment and tooling](dev-environment-tooling/knowledge.md)

**run-ci-rules.sh**  
Runs scripts/ci/rules alphabetically; --test checks rules against rule-violations pass/fail fixtures. *Region:* [Naming, style and lint](naming-style/knowledge.md)

**run-post-biome-checks**  
Runs the custom lint scripts after Biome (import aliases, generated files, Finder duplicates). *Region:* [Naming, style and lint](naming-style/knowledge.md)

**running / loading<Entity> / storing<Action>**  
Boolean execution-state naming in init views. *Region:* [Init provisioning TUI](init-script/knowledge.md)

**RuntimeDelegate**  
The one cast used for dynamic Prisma model access in the rotation job. *Region:* [Field-level encryption](encryption/knowledge.md)

## S

**sanitizeKeys**  
Template arg listing body keys stripped before Prisma, for fields clients must not set. *Region:* [API routes and schemas](api-routes-schemas/knowledge.md)

**sanitizeRequestSchema**  
Strips server-managed keys from a zod request body schema. *Region:* [API routes and schemas](api-routes-schemas/knowledge.md)

**SavedRule**  
A rule packaged with its source reference and captured sourceValues; written by stringifySavedRule, read by parseSavedRule. *Region:* [Rule builder editor model](rules-builder/knowledge.md)

**schema-introspection**  
Class: runtime schema maps (@inixiative/prisma-map, prismaMap.gen.ts) and model-name/field-metadata helpers. *Region:* [Database client and schema](database/knowledge.md)

**scope references**  
$-prefixed paths ($., $$., $$$.) that reach enclosing array elements; check()-only beyond simple cases. *Region:* [json-rules, lenses and rule references](json-rules-lenses/knowledge.md)

**scope references**  
$. / $$. / $$$. prefixes reaching enclosing elements; offered pre-prefixed via LeafNode.scopes and value.path.scopes. *Region:* [Rule builder editor model](rules-builder/knowledge.md)

**Scope roots**  
The four token roots a template may read: sender, recipient, data, system (SCOPE_ROOTS). *Region:* [Email templates and rendering](email-templates/knowledge.md)

**scopeNarrowing**  
Middleware that ANDs a per-request, context-dependent where onto the route's narrowing; it can only narrow. *Region:* [List filtering and pagination](filtering-pagination/knowledge.md)

**search**  
A broad term fanned across the lens's searchable text fields (contains / has / string_contains). *Region:* [List filtering and pagination](filtering-pagination/knowledge.md)

**searchablePaths / orderablePaths**  
The filter and sort field paths a filterLens exposes; orderable excludes to-many crossings and Json/Bytes. *Region:* [List filtering and pagination](filtering-pagination/knowledge.md)

**SearchableSelect**  
Select with a search box; filters locally, or calls onSearch debounced for API search. *Region:* [UI components, layout and theme](ui-components-theme/knowledge.md)

**searchFields**  
Per-field filters with Prisma operators (contains, gte, in, some, every, none, is, ...). *Region:* [List filtering and pagination](filtering-pagination/knowledge.md)

**searchPaths**  
paginate() option pinning the global search term to a subset of the lens's searchable paths. *Region:* [List filtering and pagination](filtering-pagination/knowledge.md)

**SecretRevealModal**  
Shows a newly created secret once with a copy button. *Region:* [UI components, layout and theme](ui-components-theme/knowledge.md)

**SeedFile**  
A model's seed records (`model`, `records`, `updateOmitFields`, `createOnly`), upserted by id. *Region:* [Database client and schema](database/knowledge.md)

**seeding**  
Class: SeedFile records, the seed runner (seed/seedTable) and prime dev data. *Region:* [Database client and schema](database/knowledge.md)

**Segment**  
A named set of one provider's CustomerRef rows, defined by a lens-validated rule in conditions. *Region:* [Customers and segments](customers-segments/knowledge.md)

**Segment-of-segment rule**  
A segment condition naming another segment; evaluated in dependency order and checked for cycles (findReferenceCycle). *Region:* [Customers and segments](customers-segments/knowledge.md)

**segmentConditions**  
Hook that requires, validates and normalizes Segment conditions against the owner's lens. *Region:* [Customers and segments](customers-segments/knowledge.md)

**SegmentMember**  
Junction linking one CustomerRef into a Segment, unique per pair, written only by reconciliation. *Region:* [Customers and segments](customers-segments/knowledge.md)

**segments**  
Class tag: provider-owned audiences with static/dynamic membership reconciliation. *Region:* [Customers and segments](customers-segments/knowledge.md)

**SegmentType**  
static (computed after create or rule change) or dynamic (also reacts to customer changes). *Region:* [Customers and segments](customers-segments/knowledge.md)

**send / resolve / read**  
The inquiry ReBAC actions: source-side send (edit, send, cancel), target-side resolve, either-side read. *Region:* [Inquiries and Flows](inquiries-flows/knowledge.md)

**sendEmail**  
Planner job: resolve entity, sender and recipients, find-or-create per-recipient CommunicationLog rows, enqueue deliverEmail. *Region:* [Delivery, messaging and contacts](delivery-messaging-contacts/knowledge.md)

**SenderType**  
Who an email is sent as: platform, admin, User, Organization, Space, OrganizationUser, SpaceUser. *Region:* [Delivery, messaging and contacts](delivery-messaging-contacts/knowledge.md)

**sendFrame**  
The only way to send to a socket; closes the connection with 1013 when Bun drops a frame. *Region:* [WebSockets and data streams](websockets/knowledge.md)

**sendToChannel / sendToUser / broadcast**  
Cross-instance publishes to channel subscribers, one user's sockets, or everyone; the *Local variants deliver on this instance only. *Region:* [WebSockets and data streams](websockets/knowledge.md)

**sendWebhook**  
Job handler delivering one event to one subscription: sign, POST, record, retry. *Region:* [App events, webhooks, adapters](app-events-webhooks-adapters/knowledge.md)

**seq**  
Per-stream Redis counter (ws:seq:{stream}, per user for perRecipient) stamped on snapshots and appends for gap detection. *Region:* [WebSockets and data streams](websockets/knowledge.md)

**__serialize**  
Factory entity helper that converts Date fields to ISO strings for API/SDK/UI-shaped assertions. *Region:* [Tests, factories and VCR](testing/knowledge.md)

**server**  
Shared MSW mock server for UI tests; per-test responses via server.use. *Region:* [Tests, factories and VCR](testing/knowledge.md)

**services**  
Backend business logic; 'handlers' is reserved for jobs and frontend events. *Region:* [Naming, style and lint](naming-style/knowledge.md)

**Session**  
A BetterAuth login session for browser clients, stored in Redis through secondaryStorage. *Region:* [Authentication and Users](authentication-users/knowledge.md)

**setEnvOverride / withEnv**  
Schema-parsed env overrides for tests, persistent (reset by resetEnvOverrides) or scoped to one call. *Region:* [Tests, factories and VCR](testing/knowledge.md)

**setLogService**  
Process-wide constant fields stamped on every record. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**settleTemplate**  
API entry that resolves a template through the cascade and renders subject and body with system tokens and RenderIssue collection. *Region:* [Email templates and rendering](email-templates/knowledge.md)

**setupState / SetupState**  
'new' | 'stale' | 'incomplete' | 'complete', derived with useMemo via detectSetupState, never stored. *Region:* [Init provisioning TUI](init-script/knowledge.md)

**setUserContext**  
Stores user, organizationUsers and permissions on the context from a loaded user with relations. *Region:* [Request context, errors, batch](request-context-errors-batch/knowledge.md)

**shadowMerge**  
Merges previous with update data, resolving increment/push/set, so rules validate the resulting row. *Region:* [Mutation hooks and write lifecycle](mutation-hooks/knowledge.md)

**show**  
Standard prop: boolean or () => boolean; false renders null. *Region:* [UI components, layout and theme](ui-components-theme/knowledge.md)

**SignUpResult**  
authenticated, verification-pending or redirecting. *Region:* [Authentication and Users](authentication-users/knowledge.md)

**--skip-db**  
worktree:create opt-out for docs-only worktrees: no databases, buckets, schema push or Docker. *Region:* [Dev environment and tooling](dev-environment-tooling/knowledge.md)

**skipFieldValidation**  
Superadmin bypass of the field whitelist; path validation still applies. *Region:* [List filtering and pagination](filtering-pagination/knowledge.md)

**sleepUnlessShuttingDown / isShutdownInProgress**  
Shutdown-aware wait and check for loops. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**slice**  
A StateCreator<AppStore> returning one namespaced key (auth, tenant, ...) spread into useAppStore. *Region:* [Frontend store and API client](frontend-state-api-client/knowledge.md)

**Slow slot share**  
Each worker runs slow jobs in at most JOBS_SLOW_SLOT_FRACTION of its slots; claimSlotOrRequeue parks the excess. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**SLOW_LANE_PRIORITY**  
2^21 - 1, the lowest usable BullMQ priority; explicit priorities are capped at it. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**SlugInput**  
Input that normalizes typed or pasted text to a slug. *Region:* [UI components, layout and theme](ui-components-theme/knowledge.md)

**soft-delete**  
Class: deletedAt tombstones, cascade and revive, and automatic soft-delete read scoping. *Region:* [Mutation hooks and write lifecycle](mutation-hooks/knowledge.md)

**softDeleteScopeExtension**  
Client extension that auto-injects `deletedAt: null` into reads, write wheres and nested includes. *Region:* [Mutation hooks and write lifecycle](mutation-hooks/knowledge.md)

**soundSegments**  
Filters a list to segments whose rules have no issues. *Region:* [Customers and segments](customers-segments/knowledge.md)

**source**  
The party that sends an inquiry; inferred from the route context, never from the body. *Region:* [Inquiries and Flows](inquiries-flows/knowledge.md)

**source / target**  
The two ends of a directed edge (Inquiry, RuleReference). *Region:* [Naming, style and lint](naming-style/knowledge.md)

**sources**  
Lens-declared option sets for a field (toSourceQueries, materializeSources); from: 'mapDefaults' names any eligible row. *Region:* [json-rules, lenses and rule references](json-rules-lenses/knowledge.md)

**sourceValues**  
Fetched option values for sourced fields, keyed by path, passed into a view. *Region:* [Rule builder editor model](rules-builder/knowledge.md)

**Space**  
Sub-tenant container inside one Organization; its own permission scope, delegating own to the organization. *Region:* [Tenancy and Permissions](tenancy-permissions/knowledge.md)

**SpaceUser**  
A user's membership in one space; requires the matching OrganizationUser. *Region:* [Tenancy and Permissions](tenancy-permissions/knowledge.md)

**Special owner values**  
Owner enum values with no FK: `default` (seeded base, all read) and `admin` (super-admin only). *Region:* [Database client and schema](database/knowledge.md)

**spillToOutbox**  
Routes every spill through the batching accumulator, which resolves on commit. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**Spoofing**  
Superadmin impersonation via the x-spoof-user-email header; the original admin is kept as spoofedBy. *Region:* [Tenancy and Permissions](tenancy-permissions/knowledge.md)

**stable id tiebreaker**  
paginate() appends { id: desc } when no id ordering is given, so pages stay consistent. *Region:* [List filtering and pagination](filtering-pagination/knowledge.md)

**Staged job**  
A makeJob with ordered stages; each stage waits for the children it added, as a BullMQ flow parent. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**StandardAction**  
The shared action tiers read, operate, manage, own that resource action sets extend. *Region:* [Tenancy and Permissions](tenancy-permissions/knowledge.md)

**startStreamReauthorizeSweep**  
Boot-time sweep re-probing every open stream every 45s via x-auth-probe with a rate-limit-exempt system secret. *Region:* [WebSockets and data streams](websockets/knowledge.md)

**storage**  
The exported StorageClient adapter (apps/api/src/lib/storage) routed over createS3Client. *Region:* [App events, webhooks, adapters](app-events-webhooks-adapters/knowledge.md)

**STREAM_DEFINITIONS**  
The shared registry of stream definitions both server and client import. *Region:* [WebSockets and data streams](websockets/knowledge.md)

**STREAM_FOLDS**  
Maps each stream kind to its snapshot and op folds (listStream, logStream); folds must be idempotent. *Region:* [WebSockets and data streams](websockets/knowledge.md)

**streamAppend**  
Builds the branded, typed stream handoff from a definition, params, op and payload; the only way to produce an append. *Region:* [WebSockets and data streams](websockets/knowledge.md)

**Stub format**  
'> Stub - to be expanded' plus TODO sections for incomplete docs. *Region:* [Engineering process, docs, Atlas](engineering-process-docs/knowledge.md)

**submodel**  
Template arg for a nested resource, e.g. model 'organization', submodel 'token' → /:id/tokens. *Region:* [API routes and schemas](api-routes-schemas/knowledge.md)

**substitute**  
Registry option naming an alternate template to send on render issues; substitutes cannot chain. *Region:* [Email templates and rendering](email-templates/knowledge.md)

**summary.status**  
Batch outcome: success, partialSuccess or failed; per-request result.error tells which failed. *Region:* [Request context, errors, batch](request-context-errors-batch/knowledge.md)

**superadmin**  
Class: the PlatformRole superadmin, admin routes, spoofing and the superadmin app. *Region:* [Tenancy and Permissions](tenancy-permissions/knowledge.md)

**supersede-lanes**  
Class tag: newest work for a key wins via claimLane/watchLane batons and superseding jobs. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**SupersededError**  
Thrown by a job replaced by newer lane work so it is not treated as a failure. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**sweepSegments**  
Nightly 04:00 UTC cron that queues sound dynamic segments in dependency order as the backstop. *Region:* [Customers and segments](customers-segments/knowledge.md)

**sync-env**  
Creates .env.local/.env.test from examples and appends keys missing from existing files without overwriting. *Region:* [Dev environment and tooling](dev-environment-tooling/knowledge.md)

**syncConfig**  
Re-reads config into context; tasks call it (as onStepComplete) after each step instead of polling. *Region:* [Init provisioning TUI](init-script/knowledge.md)

**System tokens**  
Platform-provided {{system.*}} values such as the unsubscribe URL; sender-specific values use {{sender.*}}. *Region:* [Email templates and rendering](email-templates/knowledge.md)

## T

**Table**  
Column-defined list with empty state, pagination or infiniteScroll, sticky header, no virtualization. *Region:* [UI components, layout and theme](ui-components-theme/knowledge.md)

**target**  
The party that receives and resolves an inquiry. *Region:* [Inquiries and Flows](inquiries-flows/knowledge.md)

**telemetry**  
Class: OpenTelemetry spans/metrics, browser telemetry, error reporter. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**telemetry.export.failed**  
Rate-limited warning record when an export batch is dropped. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**telemetryExtension**  
Prisma extension tracing every operation by model and operation. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**telemetryMiddleware**  
API request spans and metrics, skipping health and browser telemetry paths. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**Template args**  
model, submodel, action, many, paginate, admin, skipId, bodySchema, responseSchema, query, params, sanitizeKeys, filterLens, middleware. *Region:* [API routes and schemas](api-routes-schemas/knowledge.md)

**@template/<pkg>/***  
Subpath alias for cross-package imports and for imports within a shared package. *Region:* [Monorepo layout and build](monorepo-architecture/knowledge.md)

**@template/<pkg>/***  
Import alias across packages and inside shared packages. *Region:* [Naming, style and lint](naming-style/knowledge.md)

**@template/db**  
packages/db: Prisma client, modular schema, hooks, extensions, encryption, Redis, test factories. *Region:* [Monorepo layout and build](monorepo-architecture/knowledge.md)

**@template/sdk**  
Standalone API client package generated from the OpenAPI spec by hey-api, with types and TanStack query-key helpers. *Region:* [Frontend store and API client](frontend-state-api-client/knowledge.md)

**@template/sdk**  
packages/sdk: hey-api client generated from openapi.gen.json with TanStack Query helpers. *Region:* [Monorepo layout and build](monorepo-architecture/knowledge.md)

**@template/shared**  
packages/shared: isomorphic utilities only (logger, errors, env flags); no frontend code. *Region:* [Monorepo layout and build](monorepo-architecture/knowledge.md)

**@template/ui**  
packages/ui: all frontend components, hooks, store slices, pages and auth utilities, organized by domain. *Region:* [Monorepo layout and build](monorepo-architecture/knowledge.md)

**@template/ui**  
Package holding all frontend components, hooks, store, pages and guards; @template/shared holds isomorphic code only. *Region:* [UI components, layout and theme](ui-components-theme/knowledge.md)

**tenancy**  
Class: Organizations, Spaces and their OrganizationUser/SpaceUser memberships; User, Organization and Space contexts with data isolation. *Region:* [Tenancy and Permissions](tenancy-permissions/knowledge.md)

**tenant context**  
tenant.context: type public | user | organization | space with the active organization/space. *Region:* [Frontend apps, routes and navigation](frontend-apps-navigation/knowledge.md)

**tenant.page**  
The record a page is about, set with tenant.setPage and passed to nav access checks. *Region:* [Frontend apps, routes and navigation](frontend-apps-navigation/knowledge.md)

**TenantSlice**  
Current context (public/user/organization/space) and the page record; setUser/setOrganization/setSpace/setPage. *Region:* [Frontend store and API client](frontend-state-api-client/knowledge.md)

**test-factories**  
Class: build/create factories and test tracker cleanup. *Region:* [Tests, factories and VCR](testing/knowledge.md)

**test-harness**  
Class: test structure, running tests, createTestApp, request helpers and frontend tests. *Region:* [Tests, factories and VCR](testing/knowledge.md)

**test-rules**  
Class: rules for tests and their CI restrictions (no mocks, tracker registration, unhappy paths). *Region:* [Tests, factories and VCR](testing/knowledge.md)

**test:fe / test:init**  
Root scripts for frontend (SDK + routes regenerated, then shared/ui/app suites) and init/ tests. *Region:* [Tests, factories and VCR](testing/knowledge.md)

**theme-layout**  
Class: the AppShell layout system (Page, overlays, panels) and the multi-tier theme. *Region:* [UI components, layout and theme](ui-components-theme/knowledge.md)

**three-tier theme**  
--app-* platform colors -> --space-* tenant overrides -> active tokens (--primary) that components use. *Region:* [UI components, layout and theme](ui-components-theme/knowledge.md)

**tickets/**  
Home for open questions and planned work, not docs/claude. *Region:* [Engineering process, docs, Atlas](engineering-process-docs/knowledge.md)

**tmp/**  
Gitignored directory for temporary files and experiments. *Region:* [Dev environment and tooling](dev-environment-tooling/knowledge.md)

**tmp/AI_WORKSPACE/**  
Gitignored staging area for long analysis and larger reviewed changes. *Region:* [Engineering process, docs, Atlas](engineering-process-docs/knowledge.md)

**toast / Toaster**  
App toast helper with defaults (use instead of sonner) and the container mounted once in __root. *Region:* [UI components, layout and theme](ui-components-theme/knowledge.md)

**Token**  
An API key row stored as keyHash (SHA-256) with keyPrefix, owner, role, entitlements, expiry and isActive. *Region:* [Authentication and Users](authentication-users/knowledge.md)

**tokenAuthMiddleware**  
Hashes a Bearer or URL key, looks it up (10-minute cache) and sets the token owner's context; runs before session auth. *Region:* [Authentication and Users](authentication-users/knowledge.md)

**TokenOwnerModel**  
Who a Token belongs to: User, Organization, OrganizationUser, Space or SpaceUser. *Region:* [Authentication and Users](authentication-users/knowledge.md)

**tombstone**  
A soft-deleted row; cascade tombstones owned children with the parent's exact timestamp (the revive group). *Region:* [Mutation hooks and write lifecycle](mutation-hooks/knowledge.md)

**tombstones / revive**  
The list fold remembers removed ids (last 500) and ignores later upserts unless flagged revive. *Region:* [WebSockets and data streams](websockets/knowledge.md)

**toPrisma**  
Compile a rule into a Prisma query plan, optionally under a lens; its where is read only through executePrismaPlan. *Region:* [json-rules, lenses and rule references](json-rules-lenses/knowledge.md)

**toSql**  
Compile a rule into a SQL WHERE clause, optionally under a lens. *Region:* [json-rules, lenses and rule references](json-rules-lenses/knowledge.md)

**traceJob**  
Wraps a job's execution in a span linked to the enqueuer's trace. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**transactionAll / transactionPerRound / allowFailures / failOnRound**  
The four batch execution strategies: all atomic, each round atomic, continue past failures, stop after the first failing round. *Region:* [Request context, errors, batch](request-context-errors-batch/knowledge.md)

**triggerCronJob**  
Runs a stored cron's handler now (POST /api/admin/cronJob/:id/trigger). *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**tsconfig.frontend.json**  
Frontend apps' tsconfig base extending react.json and adding vite/client types. *Region:* [Monorepo layout and build](monorepo-architecture/knowledge.md)

**turbo watch local#<app>**  
Runs one app (api, web, admin, superadmin) or local:worker#api with workspace watching. *Region:* [Dev environment and tooling](dev-environment-tooling/knowledge.md)

**turbo.json**  
Turborepo task graph: task names match package.json scripts, with dependsOn, inputs, outputs and caching. *Region:* [Monorepo layout and build](monorepo-architecture/knowledge.md)

**Two wheres**  
A collection facet's fixed where (its identity, matched on rehydration) versus defaultWhere (editable array-traversal operators). *Region:* [Rule builder editor model](rules-builder/knowledge.md)

**type over interface**  
Object shapes are declared with type aliases. *Region:* [Naming, style and lint](naming-style/knowledge.md)

**Typed model IDs**  
Branded string types such as `UserId` with constructors like `userId(id)` that stop mixing IDs of different models. *Region:* [Database client and schema](database/knowledge.md)

**TypedBuildResult**  
Type declaring which context entries a factory guarantees. *Region:* [Tests, factories and VCR](testing/knowledge.md)

## U

**ui-components**  
Class: packages/ui primitives, settings pages, modals and the standard conditional props. *Region:* [UI components, layout and theme](ui-components-theme/knowledge.md)

**UISlice**  
Theme preference, global loading flag and app identity from VITE_ env. *Region:* [Frontend store and API client](frontend-state-api-client/knowledge.md)

**Understand the Why First**  
ENTRYPOINT §0.1: state what a thing is for before changing how it works. *Region:* [Engineering process, docs, Atlas](engineering-process-docs/knowledge.md)

**unique**  
Handler flag: 'targeted' = one open inquiry per source+target+type, 'untargeted' = per source+type. *Region:* [Inquiries and Flows](inquiries-flows/knowledge.md)

**Unsubscribe link**  
Stateless HMAC capability bound to {userId, contactId, kind}, served by a POST-only pre-auth route with RFC 8058 headers. *Region:* [Delivery, messaging and contacts](delivery-messaging-contacts/knowledge.md)

**updateRoute**  
Route template for mutating an existing record by id. *Region:* [API routes and schemas](api-routes-schemas/knowledge.md)

**upsertCache**  
Write a value already in hand into the cache. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**upserting: true**  
findForUpdate option for create-if-missing; where must be scalar equalities only. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**URL token**  
?token=<key> fallback for WebSocket upgrades, email links and downloads that cannot set headers. *Region:* [Authentication and Users](authentication-users/knowledge.md)

**useApiWebsocket**  
Hook mounted once at each app root; subscriptions follow the query cache. *Region:* [WebSockets and data streams](websockets/knowledge.md)

**useAppStore**  
The one shared Zustand store hook from @template/ui/store used by web, admin and superadmin. *Region:* [Frontend store and API client](frontend-state-api-client/knowledge.md)

**useAuthenticatedRouting**  
Syncs ?org=/?space= with the tenant slice, matches the route and runs access with context fallback. *Region:* [Frontend apps, routes and navigation](frontend-apps-navigation/knowledge.md)

**useConfig**  
Hook returning { config, syncConfig } inside init views. *Region:* [Init provisioning TUI](init-script/knowledge.md)

**useDarkMode / useThemePersistence**  
Apply .dark on <html> from ui.theme; load/save ui.theme in localStorage. *Region:* [UI components, layout and theme](ui-components-theme/knowledge.md)

**useDebounce**  
React hook that delays a changing value before it triggers backend requests. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**useDebounce**  
Debounces a value; useDebouncedCallback debounces a function; only for backend-hitting inputs. *Region:* [Frontend store and API client](frontend-state-api-client/knowledge.md)

**useDebouncedCallback**  
React hook that debounces a function call; has .cancel(). *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**useEventRefetch**  
Refetches queries when a named app event fires; pairs with useAppEvents emitters. *Region:* [Frontend store and API client](frontend-state-api-client/knowledge.md)

**useFilteredCollection**  
Builder plus in-memory check() over rows fetched whole, for display-only narrowing. *Region:* [Rule builder editor model](rules-builder/knowledge.md)

**useMediaQuery / useBreakpoint**  
Arbitrary media query match; named Tailwind breakpoint match. *Region:* [UI components, layout and theme](ui-components-theme/knowledge.md)

**useOptimisticMutation**  
Mutation hook that applies targets' optimisticUpdate, rolls back on error, reconciles and invalidates on settle. *Region:* [Frontend store and API client](frontend-state-api-client/knowledge.md)

**usePageMeta / useBreadcrumbs**  
Document title/description and breadcrumb trail derived from the matched nav item chain. *Region:* [Frontend apps, routes and navigation](frontend-apps-navigation/knowledge.md)

**usePaginatedData / useInfiniteData**  
Frontend hooks for page-numbered tables and infinite-scroll lists, both driven by a DataConfig. *Region:* [List filtering and pagination](filtering-pagination/knowledge.md)

**usePermission**  
UI hook turning a permission check into { show, disable, disabledText } for a record. *Region:* [Tenancy and Permissions](tenancy-permissions/knowledge.md)

**User**  
A person's platform identity: email, platformRole and owned relations. *Region:* [Authentication and Users](authentication-users/knowledge.md)

**User redaction**  
Anonymizing a user's PII on account deletion while keeping the row for referential integrity. *Region:* [Authentication and Users](authentication-users/knowledge.md)

**useRegisterNavigation**  
Stores the app's nav config and router navigate in the navigation slice, once in __root. *Region:* [Frontend apps, routes and navigation](frontend-apps-navigation/knowledge.md)

**users**  
Class: User lookup and guest creation, /me routes, email normalization and redaction. *Region:* [Authentication and Users](authentication-users/knowledge.md)

**@uses**  
Load-bearing concept dependencies, hand-curated; `@uses none` = looked and found none. *Region:* [Engineering process, docs, Atlas](engineering-process-docs/knowledge.md)

**useSectionHash / useSectionOpen**  
Keep visible section or a section's/modal's open state in the URL hash. *Region:* [Frontend apps, routes and navigation](frontend-apps-navigation/knowledge.md)

**useShallow**  
zustand v5 wrapper required for object selectors, otherwise the component re-renders forever. *Region:* [Frontend store and API client](frontend-state-api-client/knowledge.md)

**useSpaceTheme**  
Sets --space-* CSS properties from a SpaceTheme; not yet wired by any app. *Region:* [UI components, layout and theme](ui-components-theme/knowledge.md)

**useStream / useStreamAction**  
Hooks for a stream's folded snapshot as a query result, and for side-effect listeners on one op. *Region:* [WebSockets and data streams](websockets/knowledge.md)

**useValidateUniqueness**  
Checks a field (e.g. organization slug) is free via the lookup query param; 404 means available; excludeId when editing. *Region:* [Frontend store and API client](frontend-state-api-client/knowledge.md)

**util**  
Preferred over 'helper' for shared functions. *Region:* [Naming, style and lint](naming-style/knowledge.md)

**UUIDv7**  
Time-sortable primary key: `@default(dbgenerated("uuidv7()")) @db.VarChar(36)`. *Region:* [Database client and schema](database/knowledge.md)

## V

**validate***  
Prefix for middleware guards, instead of require*. *Region:* [Naming, style and lint](naming-style/knowledge.md)

**validateActor**  
401 unless getActor(c).user resolves a user. *Region:* [Authentication and Users](authentication-users/knowledge.md)

**validateEncryptionVersions**  
CI check (validate:encryption) that blocks downgrades, version jumps, bumps over mixed versions and more than two versions. *Region:* [Field-level encryption](encryption/knowledge.md)

**validateNotToken**  
Session-only gate: rejects token-authenticated requests for sensitive actions. *Region:* [Authentication and Users](authentication-users/knowledge.md)

**validateOwnerPermission**  
Route middleware for owner-polymorphic resources: checks the action on the record's ownerModel owner. *Region:* [Tenancy and Permissions](tenancy-permissions/knowledge.md)

**validatePathNotation**  
Rejects unsafe, snake_case, underscore-prefixed or too-deep (MAX_PATH_DEPTH 5) dotted paths. *Region:* [List filtering and pagination](filtering-pagination/knowledge.md)

**validatePermission**  
Route middleware: hydrate the loaded resource and run the ReBAC check for an action, 403 on failure. *Region:* [Tenancy and Permissions](tenancy-permissions/knowledge.md)

**validateSuperadmin**  
Middleware rejecting with 403 unless the user's platformRole is superadmin. *Region:* [Tenancy and Permissions](tenancy-permissions/knowledge.md)

**validateUser**  
401 unless c.get('user') holds a real credential user. *Region:* [Authentication and Users](authentication-users/knowledge.md)

**validateWebhookUrl**  
Rejects unsafe user-supplied target URLs (private addresses, non-enforced envs aside); webhookUrlSchema wraps it for zod. *Region:* [App events, webhooks, adapters](app-events-webhooks-adapters/knowledge.md)

**validations/**  
Module folder for cross-field and business-invariant checks, called with .parse() from the controller. *Region:* [API routes and schemas](api-routes-schemas/knowledge.md)

**ValueControl**  
The value input descriptor: options, shape and kind signals for choosing the right widget. *Region:* [Rule builder editor model](rules-builder/knowledge.md)

**valueKey**  
Canonical projection of a contact value (E.164, classifier:handle) used for per-owner uniqueness and lookup. *Region:* [Delivery, messaging and contacts](delivery-messaging-contacts/knowledge.md)

**Variable / VariableSlot**  
A preset's tunable value domain (default, options, range) and where it sits in the rule. *Region:* [Rule builder editor model](rules-builder/knowledge.md)

**vcr**  
Class: VCR record/replay of external provider calls. *Region:* [Tests, factories and VCR](testing/knowledge.md)

**VCR**  
@template/shared/vcr wrapper: capture passes through outside tests, replays or records sanitized cassettes in tests. *Region:* [Tests, factories and VCR](testing/knowledge.md)

**Verification**  
Short-lived verification values such as email verification tokens. *Region:* [Authentication and Users](authentication-users/knowledge.md)

**Verification discipline**  
ENTRYPOINT §0.5: verify before asserting, no deferral as escape hatch, exhaust validation before caveating. *Region:* [Engineering process, docs, Atlas](engineering-process-docs/knowledge.md)

**versions.json**  
The BOM: pinned Bun, toolchain, required packages, lane sets and consumer repos. *Region:* [Monorepo layout and build](monorepo-architecture/knowledge.md)

**view**  
The field surface the builder reads, built by createView, rawView or resolve; a LensView lists fields at a dotted path. *Region:* [Rule builder editor model](rules-builder/knowledge.md)

**viewState / ViewState**  
UI screen names only; never execution states like 'running'. *Region:* [Init provisioning TUI](init-script/knowledge.md)

## W

**watchLane**  
Polls a lane via heartbeat and fires onUsurped when a different holder appears. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**web / admin / superadmin**  
The three frontend apps: consumer/participant, operator, and platform-operations (user-context first, locked selector). *Region:* [Frontend apps, routes and navigation](frontend-apps-navigation/knowledge.md)

**webhookEnabledModels**  
Registry of models whose mutations fire outbound webhooks (currently CustomerRef). *Region:* [App events, webhooks, adapters](app-events-webhooks-adapters/knowledge.md)

**WebhookEvent**  
One delivery attempt: status (pending/sent/failed), payload, HTTP status and response; cleaned after 90 days. *Region:* [App events, webhooks, adapters](app-events-webhooks-adapters/knowledge.md)

**webhookRelatedModels**  
Maps a model to related records (FlexibleRef) whose changes fire its webhooks. *Region:* [App events, webhooks, adapters](app-events-webhooks-adapters/knowledge.md)

**webhooks**  
Class: outbound webhooks: subscriptions, signed delivery jobs, delivery history, URL safety, circuit breaker. *Region:* [App events, webhooks, adapters](app-events-webhooks-adapters/knowledge.md)

**WebhookSubscription**  
A User/Organization/Space-owned URL subscribed to a WebhookModel, unique per owner, model and url, with isActive. *Region:* [App events, webhooks, adapters](app-events-webhooks-adapters/knowledge.md)

**websocket.resync / streamResync**  
Client re-open for a fresh snapshot after a seq gap; server signal telling holders on every instance to re-open. *Region:* [WebSockets and data streams](websockets/knowledge.md)

**WhereScope**  
The type a scopeNarrowing callback returns (root where/relations, mapDefaults). *Region:* [List filtering and pagination](filtering-pagination/knowledge.md)

**wildcard key**  
A cacheKey with the wildcard flag, ending in :*, to clear a family of keys. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**with-env.sh**  
scripts/deployment/with-env.sh behind `bun run with <env> <app> <cmd>`: Infisical for cloud envs, root then app .env files for local/test. *Region:* [Dev environment and tooling](dev-environment-tooling/knowledge.md)

**withLanePriority**  
Applies SLOW_LANE_PRIORITY to slow adds so fast work is always picked first. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**withLogContext**  
Adds named searchable fields to every log emitted within an async call. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**withOwnerLock**  
Owner-scoped lock taken before the transaction opens to serialize cross-row writes; not re-entrant, 409 on timeout. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**withRule**  
The one fork through which a stored rule is evaluated: degraded (issue, never a match) or sound (run the evaluator). *Region:* [Email templates and rendering](email-templates/knowledge.md)

**withRule**  
The one fork every stored rule is evaluated through: sound arm or degraded arm, based on its health. *Region:* [json-rules, lenses and rule references](json-rules-lenses/knowledge.md)

**withSpan**  
Wraps an async unit of work in a named span. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**WorkerContext**  
Handler context: scoped `db`, `queue`, BullMQ `job`, optional `signal`, and `log`. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**worktree slot**  
A number 1-9 recorded in .worktrees/.slots/<N> and WORKTREE_SLOT that owns a worktree's ports, DBs, buckets and Redis DB. *Region:* [Dev environment and tooling](dev-environment-tooling/knowledge.md)

**worktrees**  
Class: worktree lifecycle through the repo scripts, with slots and per-slot DBs/ports. *Region:* [Dev environment and tooling](dev-environment-tooling/knowledge.md)

**writtenPatches**  
Extracts the written rows from hook args across single, bulk and upsert actions. *Region:* [Mutation hooks and write lifecycle](mutation-hooks/knowledge.md)

**ws-connections**  
Class: the server WebSocket connection: upgrade, authenticate frame and identity, registry, frame serialization, heartbeat, stale sweep. *Region:* [WebSockets and data streams](websockets/knowledge.md)

**ws-streams**  
Class: refetch channels and data streams: registries, audience, authorization and re-authorization, seq, folds and hooks. *Region:* [WebSockets and data streams](websockets/knowledge.md)

**ws:broadcast**  
Redis pub/sub channel that fans sendToChannel/sendToUser/appendToStream/broadcast out to every API instance's local registry. *Region:* [WebSockets and data streams](websockets/knowledge.md)

**WS_CHANNELS**  
Registry of authorized query channel families (inquiryRead, segmentReadManySegmentMembers) with typed name() builders. *Region:* [WebSockets and data streams](websockets/knowledge.md)

**WSHandoff**  
WebSocket handoff: channels or users message (refetch hints) or a stream append built with streamAppend. *Region:* [App events, webhooks, adapters](app-events-webhooks-adapters/knowledge.md)

## X

**x-webhook-signature**  
Base64 RSA-SHA256 signature of the timestamped body; receivers verify with the public key. *Region:* [App events, webhooks, adapters](app-events-webhooks-adapters/knowledge.md)

## Y

**YAGNI both ways**  
ENTRYPOINT §0.3: overbuilding and underbuilding are equal failures; flag real judgment calls. *Region:* [Engineering process, docs, Atlas](engineering-process-docs/knowledge.md)

## Z

**ZodEffects**  
What .refine() produces; it breaks hono-zod-openapi, so route schemas never use .refine(). *Region:* [API routes and schemas](api-routes-schemas/knowledge.md)
