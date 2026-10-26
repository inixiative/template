# Template glossary

**Every term the template's region Wardens use, alphabetical, each with the region that holds it.**

<!-- Generated with the region Warden docs (v1) by ~/.foundry/evals/warden-regions/assemble.py. A term defined by two regions appears once per region. -->

---

## #

**#/**  
Alias for imports inside the same app (e.g. #/lib/context/installPermissions). *Region:* [Monorepo layout and architecture](monorepo-architecture/knowledge.md)

## A

**AAD**  
Additional Authenticated Data from buildAAD, binding ciphertext to immutable record fields so it cannot move to another row. *Region:* [Encryption and secrets](encryption/knowledge.md)

**abac rule**  
{ rule: Condition }: a json-rules predicate evaluated over the record. *Region:* [Permissions library (ReBAC engine)](lib-permissions/knowledge.md)

**absent set**  
A path's NULL cases including a missing optional to-one hop, carried as `{ rel: { is: null } }`. *Region:* [Compiling rules to Prisma and SQL](json-rules-backends/knowledge.md)

**absolute instant**  
A `Date`, epoch number or zoned ISO string; used as-is, never re-anchored. *Region:* [json-rules dates, windows and verbs](json-rules-dates/knowledge.md)

**acceptedKinds**  
CommunicationKind[] on Contact (and optionally CustomerRef) listing the kinds the contact accepts. *Region:* [Email delivery and preferences](email-delivery/knowledge.md)

**acceptedKinds**  
CommunicationKind[] on Contact: the kinds this contact accepts. *Region:* [Messaging and contacts](messaging-contacts/knowledge.md)

**access**  
NavItem rule (permissions-roles / permissions-rebac, context, pageContext) => boolean; the source of truth for page visibility. *Region:* [Navigation config and tenant context](navigation/knowledge.md)

**Account**  
A user's linked credentials for one provider (OAuth tokens or password). *Region:* [Authentication: sessions, providers, tokens](authentication/knowledge.md)

**acquireFindForUpdateLock**  
The Redis fence findForUpdate takes for rows a transaction will read then write. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**Action**  
A named verb { paths: Transition[], label? }; the OR of its edges. *Region:* [Transitions library (lifecycle guards)](lib-transitions/knowledge.md)

**Action rule hooks**  
useActionRuleBuilder with buildActionRoot / setSchemaAction / removeSchemaAction: the builder shape for action rules. *Region:* [Rule builder: template usage](rules-builder/knowledge.md)

**actionRoute**  
Route template for a custom non-CRUD verb, e.g. action: 'activate' → POST /:id/activate. *Region:* [API routes, controllers and modules](api-routes/knowledge.md)

**ActionRule**  
One permission expression: string delegation, { rel, action }, { self }, { rule }, { any }, { all }, or null. *Region:* [Permissions library (ReBAC engine)](lib-permissions/knowledge.md)

**ActionRule**  
One rule: action string, { rel, action }, { self }, { rule }, { any }, { all }, or null. *Region:* [ReBAC, owner-polymorphic and row permissions](permissions-rebac/knowledge.md)

**actionRuleSchema**  
Recursive Zod validator for a serialized ActionRule, on the @inixiative/permissions-roles / permissions-rebac/actionRuleSchema subpath. *Region:* [Permissions library (ReBAC engine)](lib-permissions/knowledge.md)

**Actions live in slices**  
State changes and their side effects are slice actions; components never set state directly. *Region:* [Frontend store (Zustand slices)](frontend-store/knowledge.md)

**adapter module**  
types.ts interface + client/<provider>.ts factories + index.ts wiring; app code imports only the exported adapter. *Region:* [Adapters, integrations and storage](adapters-integrations/knowledge.md)

**adapters**  
Class: provider adapter modules exposing one interface over provider implementations, wired with makeAdapterRouter/Registry. *Region:* [Adapters, integrations and storage](adapters-integrations/knowledge.md)

**addUniqueWhereNotNull / addCheckConstraint / addGistIndex**  
Helpers for partial unique indexes, CHECK constraints and GIST indexes, which Prisma can't express. *Region:* [Database client and transactions](database-client/knowledge.md)

**Admin bare lens**  
filterLens: { parent: lensFor(Model) } with no picks/omits/where on an admin route, so paginate() has a narrowing to filter with. *Region:* [List filtering and search](filtering-search/knowledge.md)

**admin flag**  
Route-template arg marking a superadmin-only route mounted under the admin router. *Region:* [API routes, controllers and modules](api-routes/knowledge.md)

**Admin router**  
apps/api/src/routes/admin: superadmin-only routes, run inside db.withDeleted. *Region:* [Tenancy and Superadmin](tenancy/knowledge.md)

**admitRuleReferences**  
Refuses a new reference the source's composed where does not admit, so an org template can't name another org's tag. *Region:* [Template rules and rule references](json-rules/knowledge.md)

**adoption branch**  
train/adopt-<pkg>-<version>: the train's branch moving a failing dependent onto a candidate. *Region:* [Config package (toolchain, train)](lib-config/knowledge.md)

**advance**  
auto moves on as soon as a step holds; confirm waits for the user (e.g. one-time secrets). *Region:* [Guided flows](flows/knowledge.md)

**Adversarial review**  
Background review of the full change after significant implementation, run without being asked. *Region:* [Engineering process and docs](engineering-process-docs/knowledge.md)

**advisory**  
Gloss is past-session commentary that may be stale; trust the code and // why: over it. *Region:* [Gloss (margin comments)](lib-gloss/knowledge.md)

**AES-256-GCM**  
Authenticated encryption used per field with a random 12-byte IV and a 16-byte auth tag that detects tampering. *Region:* [Encryption and secrets](encryption/knowledge.md)

**affordance**  
The answer to "what changes can happen?" for a record or a set (available / eligible). *Region:* [Transitions library (lifecycle guards)](lib-transitions/knowledge.md)

**agentic lane**  
signet, archive, agent-session, foundry-core, foundry, foundry-acp. *Region:* [Config package (toolchain, train)](lib-config/knowledge.md)

**alias**  
The root table alias toSql qualifies columns with (t0 by default). *Region:* [Compiling rules to Prisma and SQL](json-rules-backends/knowledge.md)

**alias**  
NavItem flag: routable page hidden from the sidebar. *Region:* [Navigation config and tenant context](navigation/knowledge.md)

**aliasColumns**  
Builds an aliased SQL column list for a model from the map, for raw selects. *Region:* [Prisma-map and schema introspection](lib-prisma-map/knowledge.md)

**allowFailures**  
Strategy: no transactions; every request runs and commits independently. *Region:* [Batch API](batch/knowledge.md)

**AND / OR groups**  
Indexed combinators (searchFields[AND][0][...]) that keep same-relation filters distinct; max 25 groups, max 10 nesting levels. *Region:* [List filtering and search](filtering-search/knowledge.md)

**Annotations**  
The bag of tag classes parsed from /// comments on a model, field or index. *Region:* [Prisma-map and schema introspection](lib-prisma-map/knowledge.md)

**AnyNull**  
Prisma's Json null instance (known by identity) toPrisma uses for Json null checks. *Region:* [Compiling rules to Prisma and SQL](json-rules-backends/knowledge.md)

**api-client**  
Class: the generated SDK, apiQuery/apiMutation, optimistic mutations, data hooks and form helpers. *Region:* [API client, SDK and query hooks](api-client/knowledge.md)

**api-modules**  
Class: the folder anatomy of an apps/api module (routes/, controllers/, schemas/, services/, handlers/ …) and where new code goes. *Region:* [API routes, controllers and modules](api-routes/knowledge.md)

**/api/telemetry/browser**  
Origin-checked, rate-limited endpoint converting browser events to OTLP (telemetry.source=browser). *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**/api/v1/me identity probe**  
How a socket's identity is resolved: through the normal auth and spoof middleware, not WebSocket-specific auth. *Region:* [WebSocket connections](ws-connections/knowledge.md)

**apiFetchInternal**  
Shared fetch layer: bearer and x-spoof-user-email headers, VITE_API_URL, :id path params, serializeBracketQuery, throw on error. *Region:* [API client, SDK and query hooks](api-client/knowledge.md)

**apiMutation**  
Turns an SDK write into a mutationFn taking request options as variables; returns the full response. *Region:* [API client, SDK and query hooks](api-client/knowledge.md)

**apiPath**  
Resolves an SDK operationId to its URL path with serialized bracket query. *Region:* [Request schemas and OpenAPI](api-schemas-openapi/knowledge.md)

**apiQuery**  
Turns an SDK GET into a queryFn that reads options from queryKey[0] and unwraps { data: { data, pagination } }. *Region:* [API client, SDK and query hooks](api-client/knowledge.md)

**apiRateLimit / authRateLimit**  
The API-wide limiter (principal, space, organization) and the /api/auth/* per-IP limiter. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**app-events**  
Class: the emitAppEvent side-effect bus, makeAppEvent handlers, their email/WebSocket/observe handoffs and commit deferral. *Region:* [App events and webhooks](app-events-webhooks/knowledge.md)

**appendToStream**  
Sequences and publishes an append through Redis via a per-stream serialized queue. *Region:* [WebSocket data streams](ws-data-streams/knowledge.md)

**AppEnv**  
Hono env type whose Variables hold db, user, organizationUsers, session, token, spoofedBy, permix, requestId, resource, resourceType, bracketQuery, filterLens. *Region:* [Request context and errors](request-context-errors/knowledge.md)

**AppError**  
HTTPException subclass that emits the standard error body; requestId is stamped by the handler. *Region:* [Request context and errors](request-context-errors/knowledge.md)

**AppEvent**  
Model recording emitted events (upserted by envelope id) with actor, source and payload; diagnostic, not read back by code. *Region:* [App events and webhooks](app-events-webhooks/knowledge.md)

**AppEventName**  
Typed union of event names, declared with their payloads and registrations in apps/api/src/appEvents/handlers/index.ts. *Region:* [App events and webhooks](app-events-webhooks/knowledge.md)

**applyEmailLens**  
Rewrites a stored rule through the lens before check, so the lens's where decides at send as at save. *Region:* [The email lens](email-lens/knowledge.md)

**applyMembershipDiff**  
Writes membership adds and removals for a segment from a matching set. *Region:* [Customers and segments](customers-segments/knowledge.md)

**appPathSchema**  
Shared zod schema (and isAppPath guard) for in-app paths such as redirect targets. *Region:* [Request schemas and OpenAPI](api-schemas-openapi/knowledge.md)

**AppShell / FullscreenLayout**  
The two authenticated layouts: the shell with sidebar and header, or a full-screen page without it. *Region:* [Frontend apps, routes and layouts](frontend-apps-routing/knowledge.md)

**AppShell / Header**  
The authenticated frame: sidebar plus header; layout components read the store themselves. *Region:* [Layout system and theme](theme-layout/knowledge.md)

**AppStore**  
Type of the composed store: ClientSlice & AuthSlice & NavigationSlice & PermissionsSlice & TenantSlice & UISlice. *Region:* [Frontend store (Zustand slices)](frontend-store/knowledge.md)

**AppTheme / SpaceTheme**  
Complete platform theme type; nullable, all-optional tenant override type with bare HSL colors and logo/favicon. *Region:* [Layout system and theme](theme-layout/knowledge.md)

**Architectural review**  
DEVELOPER.md pause: does this match the codebase, over/under-engineered, maintainable, simpler alternative? *Region:* [Engineering process and docs](engineering-process-docs/knowledge.md)

**architecture**  
Class: system overview, request and data flow, key architectural patterns. *Region:* [Monorepo layout and architecture](monorepo-architecture/knowledge.md)

**archiveStaleRecords**  
Handler that archives stale records instead of deleting them. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**ArrayNode**  
A list or relation condition: presence, count, or predicate (all/any/none) with a nested condition sub-builder. *Region:* [rules-builder library README](lib-rules-builder/knowledge.md)

**ArrayNode**  
A list or relation condition: presence, count, or predicate (all/any/none) with a nested condition sub-builder. *Region:* [Rule builder: template usage](rules-builder/knowledge.md)

**assertValidFieldMaps**  
Throws when a field name holds . or :; validateFieldMaps returns the issues. *Region:* [Using a lens: build, gate, fetch](lens-usage/knowledge.md)

**assign**  
Action gating role grants and token creation: owner/admin need own, member/viewer need manage. *Region:* [Roles, actions and permission checks](permissions-roles/knowledge.md)

**atlas**  
Class: the template's Atlas code map: concept vocabulary, @atlas annotations, navigating by concept. *Region:* [Atlas code map (library + template usage)](lib-atlas/knowledge.md)

**@atlas**  
Opens a top-of-file JSDoc annotation block, above the imports. *Region:* [Atlas code map (library + template usage)](lib-atlas/knowledge.md)

**atlas check**  
The CI primitive: block presence, valid vocab, existing concepts and resolving doc references. *Region:* [Atlas code map (library + template usage)](lib-atlas/knowledge.md)

**atlas coverage**  
Unannotated files and @uses curation buckets; --min floor or --ratchet gate. *Region:* [Atlas code map (library + template usage)](lib-atlas/knowledge.md)

**atlas generate**  
Writes MAP.md from the annotated tree. *Region:* [Atlas code map (library + template usage)](lib-atlas/knowledge.md)

**atlas graph**  
Reverse indexes concept -> files, file -> concepts, doc -> concepts; --json for agents. *Region:* [Atlas code map (library + template usage)](lib-atlas/knowledge.md)

**@atlas pin**  
Exempts a block from atlas stamp --overwrite resyncing. *Region:* [Atlas code map (library + template usage)](lib-atlas/knowledge.md)

**atlas query**  
Finds files by --kind / --partOf / --uses / --path flags or a json-rules predicate; --json for machine output. *Region:* [Atlas code map (library + template usage)](lib-atlas/knowledge.md)

**atlas report**  
Writes COVERAGE.md (Mermaid) and atlas.html (Cytoscape) per-concept work plans. *Region:* [Atlas code map (library + template usage)](lib-atlas/knowledge.md)

**atlas stamp**  
The patcher: fills derivable tags from rules; dry-run by default, --write to apply. *Region:* [Atlas code map (library + template usage)](lib-atlas/knowledge.md)

**.atlas/**  
The repo's config folder: config.ts (stamp rules, ignore, references), kinds.ts, concepts.ts. *Region:* [Atlas code map (library + template usage)](lib-atlas/knowledge.md)

**aToB**  
Integration transformer naming (stripeToUser). *Region:* [Naming and code style](conventions/knowledge.md)

**Atomic files**  
One file, one named export; helpers stay internal. *Region:* [Naming and code style](conventions/knowledge.md)

**Atomic progress flag**  
One boolean per remote write, marked only after it succeeded, so a rerun resumes exactly where it stopped. *Region:* [Writing an init task](init-tasks/knowledge.md)

**audience**  
Required: 'shared' (identical data for every holder, test-enforced) or 'perRecipient' (appends carry recipient userIds). *Region:* [WebSocket data streams](ws-data-streams/knowledge.md)

**audit-log**  
Class: the AuditLog trail of mutations on enabled models, with actor, diffs and redaction. *Region:* [Audit log and soft delete](audit-soft-delete/knowledge.md)

**AUDIT_ENABLED_MODELS**  
Opt-in list of AuditSubjectModel values whose mutations are audited. *Region:* [Audit log and soft delete](audit-soft-delete/knowledge.md)

**auditActorContext**  
Async-scope actor provenance that emitAppEvent copies onto the event envelope. *Region:* [App events and webhooks](app-events-webhooks/knowledge.md)

**auditActorContext**  
AsyncLocalStorage scope carrying the actor (user, spoof user, token, job, inquiry, IP) and the soft-delete bypass flag. *Region:* [Audit log and soft delete](audit-soft-delete/knowledge.md)

**auditActorMiddleware**  
Sets the actor context used when writing audit logs. *Region:* [Auth middleware, validators and users](auth-middleware-users/knowledge.md)

**AuditLog**  
Model storing action, subjectModel, before/after, changes and actor/context columns for each audited mutation. *Region:* [Audit log and soft delete](audit-soft-delete/knowledge.md)

**auth slice**  
Store slice (packages/ui/src/store/slices/auth.ts) holding user, organizations, spaces, spoof state, strategy and the auth actions. *Region:* [Frontend Authentication](frontend-auth/knowledge.md)

**Auth strategy**  
Frontend choice between standalone (own login) and embedded (parent frame) authentication, detected by detectAuthStrategy. *Region:* [Authentication: sessions, providers, tokens](authentication/knowledge.md)

**auth-middleware**  
Class: the auth middleware chain and spoofing; no "is there a user" gate — every route names its action and the rule decides. *Region:* [Auth middleware, validators and users](auth-middleware-users/knowledge.md)

**auth.initialize**  
Once per load: if a token exists, hydrate /me and authenticate the websocket; sets isInitialized. *Region:* [Frontend Authentication](frontend-auth/knowledge.md)

**auth.logout**  
Signs out and always clears token, user, permissions-roles / permissions-rebac and tenant, then navigates to /login. *Region:* [Frontend Authentication](frontend-auth/knowledge.md)

**auth.refreshMe**  
Re-hydrates /me after user or membership changes. *Region:* [Frontend Authentication](frontend-auth/knowledge.md)

**auth.setSpoof**  
Sets spoofUserEmail, re-hydrates /me with x-spoof-user-email and spoofs the websocket. *Region:* [Frontend Authentication](frontend-auth/knowledge.md)

**auth.signIn**  
Store sign-in: calls lib signIn, then hydrates /me and the websocket for non-OAuth methods. *Region:* [Frontend Authentication](frontend-auth/knowledge.md)

**auth.signUp**  
Store sign-up: hydrates on authenticated, clears auth on verification-pending, returns the result. *Region:* [Frontend Authentication](frontend-auth/knowledge.md)

**AuthCallbackPage**  
OAuth callback at /auth/callback: exchanges #ott once, hydrates, navigates to authRedirectTo. *Region:* [Frontend Authentication](frontend-auth/knowledge.md)

**authenticate frame**  
Client message that carries credentials after the anonymous upgrade; resolved through /api/v1/me and re-sent on spoof or unspoof. *Region:* [WebSocket connections](ws-connections/knowledge.md)

**_authenticated**  
Layout route: requireAuth + AppShell + nav-based access check. *Region:* [Frontend apps, routes and layouts](frontend-apps-routing/knowledge.md)

**authentication**  
Class: BetterAuth sessions, OAuth, AuthProviders, API tokens and token types. *Region:* [Authentication: sessions, providers, tokens](authentication/knowledge.md)

**authGuard**  
createAuthGuards factory in packages/ui/src/guards/authGuard.ts; appGuards holds the instances. *Region:* [Frontend Authentication](frontend-auth/knowledge.md)

**AuthMethod**  
Discriminated union of email, oauth and saml credentials accepted by signIn and signUp. *Region:* [Frontend Authentication](frontend-auth/knowledge.md)

**authMiddleware**  
Resolves a BetterAuth session and sets the user context via setUserContext. *Region:* [Auth middleware, validators and users](auth-middleware-users/knowledge.md)

**authorize**  
The injected callback that evaluates per-side permission rules. *Region:* [Transitions library (lifecycle guards)](lib-transitions/knowledge.md)

**AuthProvider**  
An organization's EMAIL, OAUTH or SAML login configuration with encrypted secrets. *Region:* [Authentication: sessions, providers, tokens](authentication/knowledge.md)

**AuthProvider**  
First user of the engine: an organization's OAuth client secrets in encryptedSecrets. *Region:* [Encryption and secrets](encryption/knowledge.md)

**authRedirectTo**  
localStorage key holding redirectTo across the OAuth round trip. *Region:* [Frontend Authentication](frontend-auth/knowledge.md)

**AuthSlice**  
Signed-in user, memberships as id-keyed dictionaries, spoof state, initialize/refreshMe/signIn/signUp/setSpoof/logout. *Region:* [Frontend store (Zustand slices)](frontend-store/knowledge.md)

**autoApprove**  
Required handler hook called after send; returning true resolves the inquiry as approved immediately. *Region:* [Inquiry model and handlers](inquiry-handlers/knowledge.md)

**autoRegisterRoutes**  
Scans a module's routes/ and controllers/ and mounts each pair at startup; admin/internal variants exist. *Region:* [Request schemas and OpenAPI](api-schemas-openapi/knowledge.md)

**available**  
Lists actions whose from side passes for a record (to defers to checkTransition). *Region:* [Transitions library (lifecycle guards)](lib-transitions/knowledge.md)

## B

**back-relation**  
The side of a relation that holds no FK (fromFields empty), such as a list of children. *Region:* [Prisma-map and schema introspection](lib-prisma-map/knowledge.md)

**Backend Support Matrix**  
The README table of which rule shapes check(), toPrisma() and toSql() each support. *Region:* [Compiling rules to Prisma and SQL](json-rules-backends/knowledge.md)

**Barrel file**  
Top-level index.ts that is a package's public API; the only place relative imports are allowed. *Region:* [Monorepo layout and architecture](monorepo-architecture/knowledge.md)

**base lens**  
The menu: every column of the anchor, no relation turned on. *Region:* [The lens model](lens-model/knowledge.md)

**bashMainCheckoutGuard**  
PreToolUse hook denying raw git worktree commands and mutating commands that would land in the main checkout. *Region:* [Dev setup and worktrees](dx-setup/knowledge.md)

**basicAuthMiddleware**  
Static-credential (Basic) gate for fixed-credential routes. *Region:* [Auth middleware, validators and users](auth-middleware-users/knowledge.md)

**batch**  
Class: the Batch API: rounds, execution strategies, interpolation, status tracking, and the caller-scoped read helpers. *Region:* [Batch API](batch/knowledge.md)

**Batch timeout**  
10000 + 2000 × total requests ms; batch-wide for transaction strategies only. *Region:* [Batch API](batch/knowledge.md)

**BatchExecutionStrategies**  
The const object of strategies from which BatchExecutionStrategy and batchExecutionStrategyEnum are derived. *Region:* [Batch API](batch/knowledge.md)

**Bearer token**  
Authorization: Bearer <token>; carries both SPA session tokens and API keys. *Region:* [Auth middleware, validators and users](auth-middleware-users/knowledge.md)

**Bearer token**  
Authorization: Bearer <token>; carries both SPA session tokens and API keys. *Region:* [Authentication: sessions, providers, tokens](authentication/knowledge.md)

**BetterAuth**  
The auth library behind auth: email/password, social OAuth, sessions, verification; mounted at /api/auth/*. *Region:* [Authentication: sessions, providers, tokens](authentication/knowledge.md)

**bind / bindOptional**  
A { bind } token is a caller-supplied value; bindOptional lets an unsupplied one read as null, never pruned. *Region:* [Running, validating and typing rules](json-rules-runtime/knowledge.md)

**bindings**  
Named values a predicate reads via { bind }, passed in options alongside now, timeZone and weekStart. *Region:* [Transitions library (lifecycle guards)](lib-transitions/knowledge.md)

**bindingsSchema**  
Zod schema for what the caller must send to start a flow, e.g. { organizationId }. *Region:* [Guided flows](flows/knowledge.md)

**bindLens / listLensBindings**  
Fill a narrowing chain's { bind } tokens (staged, non-mutating) / list the names it requires. *Region:* [Using a lens: build, gate, fetch](lens-usage/knowledge.md)

**bindRule**  
Substitute covered binds into a rule, leaving uncovered tokens (partial resolution). *Region:* [Running, validating and typing rules](json-rules-runtime/knowledge.md)

**bindWhere**  
Template email helper binding required values into a where-condition rule. *Region:* [Template rules and rule references](json-rules/knowledge.md)

**Biome**  
Linter and formatter configured from @inixiative/config/biome/base.json (+ react.json). *Region:* [Scripts, lint and build tooling](dx-tools/knowledge.md)

**blessed version**  
The lane's mutually verified version every repo's ecosystem dependency must admit. *Region:* [Config package (toolchain, train)](lib-config/knowledge.md)

**BOM**  
Bill of materials; one config version names one coherent ecosystem state. *Region:* [Config package (toolchain, train)](lib-config/knowledge.md)

**bracket notation**  
Nested query params like searchFields[price][gte]=100, parsed by prepareRequest / parseBracketNotation. *Region:* [List filtering and search](filtering-search/knowledge.md)

**bracketQuery**  
Encodes list filters as bracket query notation (filter[field]=…) the API parses. *Region:* [API client, SDK and query hooks](api-client/knowledge.md)

**bracketQuery**  
The parsed bracket-notation object on context, c.get('bracketQuery'); read it instead of re-parsing the URL. *Region:* [List filtering and search](filtering-search/knowledge.md)

**bracketQuery**  
Context var holding the parsed bracket-notation query (?searchFields[role]=admin becomes a nested object). *Region:* [Request context and errors](request-context-errors/knowledge.md)

**breadcrumbLabel**  
NavItem function naming a record page's crumb. *Region:* [Navigation config and tenant context](navigation/knowledge.md)

**bridge**  
A declared cross-source join between two endpoint models, each with an on field. *Region:* [Lens option sources and bridges](lens-sources/knowledge.md)

**bridge key**  
The fieldMap:Model property (e.g. salesforce:Contact) under which foreign rows are embedded. *Region:* [Lens option sources and bridges](lens-sources/knowledge.md)

**bridge key**  
The fieldMap:Model address (e.g. salesforce:Contact) by which paths cross sources. *Region:* [Using a lens: build, gate, fetch](lens-usage/knowledge.md)

**Bridges**  
Cross-source edges between two fieldMaps that a rel walk may cross; traversed synthetically, never hydrated. *Region:* [Permissions library (ReBAC engine)](lib-permissions/knowledge.md)

**Bridges**  
Cross-source relation walks in the schema; far-side rows are passed only when a bridge hop reads far fields. *Region:* [ReBAC, owner-polymorphic and row permissions](permissions-rebac/knowledge.md)

**build-tooling**  
Class: Turborepo tasks, watch mode, codegen, build presets, hot reload. *Region:* [Scripts, lint and build tooling](dx-tools/knowledge.md)

**buildAAD**  
Registry callback producing the AAD string; only immutable fields such as id and organizationId. *Region:* [Encryption and secrets](encryption/knowledge.md)

**builderSource**  
Serialize a lens into a RuleBuilderSource a server ships to the builder. *Region:* [Rule builder: template usage](rules-builder/knowledge.md)

**buildJobData**  
Resolves the lane once: request, enqueue option, handler default, then fast. *Region:* [Job lanes and overflow outbox](job-lanes-outbox/knowledge.md)

**buildJobData**  
Builds the job envelope every producer uses and resolves its lane. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**buildJsonWhere**  
Filters inside a JSON column path (path, string_contains, equals, ...), dialect-specific. *Region:* [List filtering and search](filtering-search/knowledge.md)

**buildKeysetWhere**  
The Prisma where that fetches rows after a keyset cursor position over a sort chain. *Region:* [Offset and cursor pagination](pagination/knowledge.md)

**buildOrderBy**  
Merges caller and client sort requests into Prisma orderBy entries. *Region:* [List filtering and search](filtering-search/knowledge.md)

**buildPermissionRulesSchema**  
Builds the route-schema validator for permissionRules from rebacSchema's action keys. *Region:* [ReBAC, owner-polymorphic and row permissions](permissions-rebac/knowledge.md)

**buildPrismaMapV6**  
Builds a PrismaMap from a Prisma 6 generated client (schema.prisma). *Region:* [Prisma-map and schema introspection](lib-prisma-map/knowledge.md)

**buildPrismaMapV7**  
Builds a PrismaMap from a Prisma 7 generated client (internal/class.ts). *Region:* [Prisma-map and schema introspection](lib-prisma-map/knowledge.md)

**buildScope**  
Builds the scope key an ordered list keeps dense positions within. *Region:* [Mutation hooks, immutable fields, ordered lists](mutation-hooks/knowledge.md)

**buildWhereClause**  
Combines search, searchFields, filters and lens root wheres into one Prisma where after whitelist validation; paginate() calls it. *Region:* [List filtering and search](filtering-search/knowledge.md)

**buildWhereClause**  
The paginate step that ANDs the root lens clauses with the request filters. *Region:* [Template lenses](lenses/knowledge.md)

**buildX**  
Factory variant that builds the entity in memory with no DB write. *Region:* [Test factories, cleanup and test rules](test-factories-rules/knowledge.md)

**BullBoard**  
Local web UI for inspecting job queues and job states. *Region:* [Dev setup and worktrees](dx-setup/knowledge.md)

**BullBoard**  
Web UI for inspecting, retrying and cleaning queued jobs; basic auth outside local. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**BullBoard**  
Admin job-monitoring dashboard at /admin/queues. *Region:* [Tenancy and Superadmin](tenancy/knowledge.md)

**bun run check**  
The full gate: lint, typecheck, test, test:fe and run-ci-rules.sh. *Region:* [Scripts, lint and build tooling](dx-tools/knowledge.md)

**bun run check**  
The full gate: lint, typecheck, backend and frontend tests, CI rules. *Region:* [Environments, env vars and deploy](environments-deploy/knowledge.md)

**bun run docs:toc**  
Regenerates TOCs between toc:start/toc:end markers (scripts/docs/regenToc.ts). *Region:* [Engineering process and docs](engineering-process-docs/knowledge.md)

**bun run init**  
Interactive Ink TUI entry (init/index.tsx); the only front end today for Vercel, Resend, Cloudflare Pages, Railway buckets/Postgres, bouncer and launch. *Region:* [Init script architecture and direction](init-architecture/knowledge.md)

**bun run init / init:agent**  
Once-per-fork provisioning (interactive Ink TUI / headless agent run); owned by the init-architecture / init-tasks region. *Region:* [Dev setup and worktrees](dx-setup/knowledge.md)

**bun run init:agent**  
Headless runner (init/agent.ts) calling the same tasks without the TUI; the direction init is being cut over to. *Region:* [Init script architecture and direction](init-architecture/knowledge.md)

**bun run lint / lint:fix / format**  
Report only / apply lint and format fixes / formatting only. *Region:* [Scripts, lint and build tooling](dx-tools/knowledge.md)

**bun run local**  
Starts api, web, admin, superadmin and the worker under turbo watch so workspace package changes hot-reload consumers. *Region:* [Dev setup and worktrees](dx-setup/knowledge.md)

**bun run local:db / stop:db**  
docker-compose up -d --wait / docker-compose down for Postgres, Redis and MinIO; start:db is an alias of local:db. *Region:* [Dev setup and worktrees](dx-setup/knowledge.md)

**bun run reset:db**  
Full local DB reset: compose down, up, db:push, db:seed --prime. *Region:* [Dev setup and worktrees](dx-setup/knowledge.md)

**bun run setup**  
Per-developer bring-up: prerequisites, sync env, install, Docker, Prisma generate, db push, seed. *Region:* [Dev setup and worktrees](dx-setup/knowledge.md)

**bun test**  
Bun's test runner; from apps/api it injects .env.test via with-env; root bun run test runs the suites. *Region:* [Test harness, request helpers and VCR](test-harness/knowledge.md)

**Bun workspaces**  
Root package.json `workspaces: ["packages/*", "apps/*"]`. *Region:* [Monorepo layout and architecture](monorepo-architecture/knowledge.md)

**buttonVariants**  
CVA class generator to style a link or other element like a Button. *Region:* [UI components and shared pages](ui-components/knowledge.md)

**bypass**  
Enqueue option that keeps a latency-critical adhoc job out of the outbox. *Region:* [Job lanes and overflow outbox](job-lanes-outbox/knowledge.md)

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
The shared preference gate for email and messaging: system passes, otherwise the kind must be accepted. *Region:* [Email delivery and preferences](email-delivery/knowledge.md)

**canDeliver**  
Shared gate: system always delivers; otherwise the kind must be in contact.acceptedKinds (and customerRef.acceptedKinds when given). *Region:* [Messaging and contacts](messaging-contacts/knowledge.md)

**candidate**  
A published version newer than the blessed one, waiting for dependents to adopt it. *Region:* [Config package (toolchain, train)](lib-config/knowledge.md)

**canSubscribe**  
Authorizes a channel subscribe by probing the channel's HTTP route with the socket's credentials; only 2xx grants. *Region:* [WebSocket connections](ws-connections/knowledge.md)

**captureTraceContext / withRemoteTrace**  
Serialize the active trace into a carrier and resume it in another process. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**CAS claim**  
Atomic compare-and-set queued → sending before a send; a sibling that loses it bails. *Region:* [Email delivery and preferences](email-delivery/knowledge.md)

**Cascade resolution**  
Owner-tier walk that picks the winning row: user chain (SpaceUser → OrganizationUser → User → default) or org chain (Space → Organization → default). *Region:* [Email templates and components](email-templates/knowledge.md)

**CASCADE_EXEMPT**  
Relations a model references but does not own, skipped by the tombstone cascade. *Region:* [Audit log and soft delete](audit-soft-delete/knowledge.md)

**cassette**  
Recorded, sanitized provider response keyed by call and version; status >= 400 replays as a thrown error. *Region:* [Test harness, request helpers and VCR](test-harness/knowledge.md)

**Change Checklist**  
ENTRYPOINT §13: confirm nearby pattern, minimal fix with existing utilities, aliases, remove stale code, validate, summarize. *Region:* [Engineering process and docs](engineering-process-docs/knowledge.md)

**channelKey**  
Builds a channel or stream name from operation id and path params, dropping query, headers and body; parseChannelKey reverses it. *Region:* [WebSocket channels and refetch hints](ws-channels/knowledge.md)

**check**  
Evaluate a rule against data in memory; returns true or the failing error string. *Region:* [Running, validating and typing rules](json-rules-runtime/knowledge.md)

**check**  
Read-only drift gate over pins, lockfile, scripts, lefthook, stubs and ecosystem ranges; exits non-zero. *Region:* [Config package (toolchain, train)](lib-config/knowledge.md)

**check**  
check(permix, schema, { resource, record, data? }, action): evaluates rebac, abac and role rules on a hydrated record; cycles throw. *Region:* [Permissions library (ReBAC engine)](lib-permissions/knowledge.md)

**check**  
The ReBAC evaluator over a hydrated record; merges row permissionRules additively. *Region:* [ReBAC, owner-polymorphic and row permissions](permissions-rebac/knowledge.md)

**check-finder-duplicates**  
Fails on Finder/sync-conflict copies such as 'routeTree.gen 2.ts'. *Region:* [Scripts, lint and build tooling](dx-tools/knowledge.md)

**check-generated-files**  
Fails when the Prisma client or OpenAPI SDK is out of date. *Region:* [Scripts, lint and build tooling](dx-tools/knowledge.md)

**check-generated-files.sh**  
Fails when the Prisma client or OpenAPI SDK is out of date. *Region:* [Environments, env vars and deploy](environments-deploy/knowledge.md)

**check-import-aliases**  
Fails on relative internal imports that should use #/ or @template/. *Region:* [Scripts, lint and build tooling](dx-tools/knowledge.md)

**checkContextPermission**  
Tries current context, then the space's organization, user, public; switches to the first that allows the page. *Region:* [Navigation config and tenant context](navigation/knowledge.md)

**checkFlow**  
Re-evaluates steps from step 0 as the caller; computes stepStates and currentStep; deletes the flow when done. *Region:* [Guided flows](flows/knowledge.md)

**checkPath**  
The single-edge kernel returning true or a PathReason. *Region:* [Transitions library (lifecycle guards)](lib-transitions/knowledge.md)

**checkPermission**  
Plain-function frontend check (permissions-roles / permissions-rebac, model, record, action); false when the record is missing. *Region:* [Roles, actions and permission checks](permissions-roles/knowledge.md)

**checkTransition**  
Guard a proposed update: returns true or a Reason covering every path tried. *Region:* [Transitions library (lifecycle guards)](lib-transitions/knowledge.md)

**ci-deploy**  
Class: CI/CD pipelines, the full check, deploy environments and scripts. *Region:* [Environments, env vars and deploy](environments-deploy/knowledge.md)

**circuit breaker**  
A subscription auto-disables (isActive = false) after 5 consecutive failed events. *Region:* [App events and webhooks](app-events-webhooks/knowledge.md)

**Circuit breaker**  
ENTRYPOINT §3: stop and ask when scope grows, >3 files, >2 failed attempts or a new abstraction is needed. *Region:* [Engineering process and docs](engineering-process-docs/knowledge.md)

**claimLane**  
Writes jobId as the holder of a Redis lane with a TTL; the last claim wins. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**claimSlotOrRequeue**  
Job-start check: parks slow jobs over the slot share, moves line-jumping prioritized jobs back to their band. *Region:* [Job lanes and overflow outbox](job-lanes-outbox/knowledge.md)

**clamp**  
A layer's where: a row is hidden unless it holds, so a clamp only narrows and never grants. *Region:* [The lens model](lens-model/knowledge.md)

**clampLens**  
AND clamps into a lens's first narrowing, where they may read the whole schema; later layers kept. *Region:* [The lens model](lens-model/knowledge.md)

**clampLens**  
ANDs a scope into a lens's first narrowing, where it may read the whole schema. *Region:* [Template lenses](lenses/knowledge.md)

**CLAUDE.gloss.md**  
The agent guidance snippet gloss setup installs into CLAUDE.md: the three comment forms, writing, reading, epistemics, never delete to go green. *Region:* [Gloss (margin comments)](lib-gloss/knowledge.md)

**Clean status list**  
All steps rendered upfront with done / spinner / pending markers instead of streaming logs. *Region:* [Writing an init task](init-tasks/knowledge.md)

**cleanStaleData**  
Singleton cron handler that hard-deletes rows idle past a retention window. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**cleanupTouchedTables**  
afterAll truncation of only the tables written during the suite. *Region:* [Test factories, cleanup and test rules](test-factories-rules/knowledge.md)

**clearKey**  
Delete an exact cache key or a wildcard pattern via SCAN. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**clientIp**  
Non-null caller IP from the trusted x-forwarded-for hop, IPv6 bucketed to /64. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**clientIp / clientAddress**  
Bucketed, never-null client key for rate limits vs the exact address that may be missing. *Region:* [Request context and errors](request-context-errors/knowledge.md)

**ClientSlice**  
Holds the TanStack QueryClient and ApiWebsocket so they are reachable outside React. *Region:* [Frontend store (Zustand slices)](frontend-store/knowledge.md)

**cn**  
clsx + tailwind-merge helper for conditional class names. *Region:* [UI components and shared pages](ui-components/knowledge.md)

**code-style**  
Class: formatting, no comments, TypeScript rules, imports. *Region:* [Naming and code style](conventions/knowledge.md)

**coerceRule**  
Stamp each field rule with its field's coerceType from the lens. *Region:* [Using a lens: build, gate, fetch](lens-usage/knowledge.md)

**coerceType**  
A rule stamp letting a string literal compare to a number or Boolean field; coerceRule sets it from a lens. *Region:* [Writing a json-rules rule](json-rules-shapes/knowledge.md)

**color-mix shades**  
--primary-1..4 derived by mixing with white (light) or black (dark) unless a space overrides them. *Region:* [Layout system and theme](theme-layout/knowledge.md)

**columnName**  
Resolves a scalar or enum field's DB column, honoring @map. *Region:* [Prisma-map and schema introspection](lib-prisma-map/knowledge.md)

**communication-preferences**  
Class: CommunicationKind opt-in/opt-out via acceptedKinds and canDeliver, plus unsubscribe links. *Region:* [Email delivery and preferences](email-delivery/knowledge.md)

**CommunicationKind**  
system (always delivered), platform and activity (opt-out), marketing (opt-in). *Region:* [Email delivery and preferences](email-delivery/knowledge.md)

**CommunicationLog**  
Per-recipient delivery ledger and dedup fence (idempotencyKey @unique), grouped by sendKey; stores settled MJML, variables and renderIssues. *Region:* [Email delivery and preferences](email-delivery/knowledge.md)

**CommunicationReasonCode**  
Why a failed row failed, e.g. not_found, render_failed, ambiguous_timeout, quota_exceeded, unsubscribe_unavailable. *Region:* [Email delivery and preferences](email-delivery/knowledge.md)

**CommunicationStatus**  
queued → sending → sent, or failed / suppressed / undeliverable; only queued is open to delivery. *Region:* [Email delivery and preferences](email-delivery/knowledge.md)

**companion zone column**  
A not-built design: a per-field sibling column naming the zone a datetime was authored in. *Region:* [json-rules dates, windows and verbs](json-rules-dates/knowledge.md)

**component expectations**  
Field paths a component's MJML needs (deriveComponentExpectations), checked against the lens with warnings for unprovided or opaque paths. *Region:* [The email lens](email-lens/knowledge.md)

**Component-less redirect parent**  
A route segment with children is a grouping with an index page, never a component parent above its children. *Region:* [Frontend apps, routes and layouts](frontend-apps-routing/knowledge.md)

**{{#component:slug}}**  
Inline block markup that marks a reusable component inside authored MJML. *Region:* [Email templates and components](email-templates/knowledge.md)

**componentRefs**  
Pre-computed, slug-keyed list of components a body references; resolved through the cascade at read time, never stored as ids. *Region:* [Email templates and components](email-templates/knowledge.md)

**componentVersions**  
AuditLog map of slug → child snapshot id, forming the version tree. *Region:* [Email templates and components](email-templates/knowledge.md)

**composedWhere**  
A source query's node where AND the source eligibility, narrowed as a rule is. *Region:* [Lens option sources and bridges](lens-sources/knowledge.md)

**composeNarrowed**  
Builds the narrowed lens the builder gates against. *Region:* [The email lens](email-lens/knowledge.md)

**composeNarrowed**  
Compute a source's narrowed lens so the builder gates choices against it. *Region:* [Rule builder: template usage](rules-builder/knowledge.md)

**composeTemplate**  
Phase 1: resolve a template by slug through the cascade and expand its components; returns the winning owner. *Region:* [Email compose, render and save](email-render/knowledge.md)

**composition**  
Pure intersection across layers: picks intersect, omits union, wheres AND at their anchor. *Region:* [The lens model](lens-model/knowledge.md)

**concept**  
A class:name tag (feature:tenancy, infrastructure:redis) defined in the repo's registry. *Region:* [Atlas code map (library + template usage)](lib-atlas/knowledge.md)

**concept class**  
The repo-defined prefix of a concept (feature, primitive, infrastructure); atlas hardcodes none. *Region:* [Atlas code map (library + template usage)](lib-atlas/knowledge.md)

**ConceptRegistry**  
The type of .atlas/concepts.ts: concept -> constituent folders and docs, structure only. *Region:* [Atlas code map (library + template usage)](lib-atlas/knowledge.md)

**CONCEPTS**  
The template's registry export in .atlas/concepts.ts: class:name -> { module?, package?, docs? }. *Region:* [Atlas code map (library + template usage)](lib-atlas/knowledge.md)

**concurrency-limits**  
Class tag: in-process coordination with serialized queues, getConcurrency caps and resolveAll bounded batches. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**ConcurrencyType**  
Resource classes with caps: db, redis, queue, socket, integration, etc. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**Condition**  
The json-rules rule AST type every stored rule is. *Region:* [Template rules and rule references](json-rules/knowledge.md)

**Condition**  
The rule AST: Rule, AggregateRule, ArrayRule, DateRule, All, Any, IfThenElse or boolean. *Region:* [Writing a json-rules rule](json-rules-shapes/knowledge.md)

**Condition**  
The json-rules rule AST the builder owns and emits. *Region:* [rules-builder library README](lib-rules-builder/knowledge.md)

**Condition**  
The json-rules rule AST the builder owns and emits. *Region:* [Rule builder: template usage](rules-builder/knowledge.md)

**conditions**  
The json-rules rule every segment carries; a hand-picked audience is a static rule over customer-ref ids. *Region:* [Customers and segments](customers-segments/knowledge.md)

**config sync / config check**  
Apply versions.json pins and presets locally / verify them read-only. *Region:* [Scripts, lint and build tooling](dx-tools/knowledge.md)

**config train**  
@inixiative/config release command (--lane=primitives|agentic) that publishes ecosystem packages in dependency order from the default branch. *Region:* [Environments, env vars and deploy](environments-deploy/knowledge.md)

**config.timeZone**  
`string | ValueSourceOf<string>` (TimeZoneConfig); a `{ path }` source throws because the zone is per evaluation, not per row. *Region:* [json-rules dates, windows and verbs](json-rules-dates/knowledge.md)

**ConfigProvider**  
Root context in init/utils/configState.tsx; the single source of config for every TUI view. *Region:* [Init script architecture and direction](init-architecture/knowledge.md)

**connection registry**  
Indexes of open sockets by id, user, channel and stream (byId, byUser, byChannel, byStream; addConnection, removeConnection). *Region:* [WebSocket connections](ws-connections/knowledge.md)

**@constructs**  
The factory output a constructor file builds. *Region:* [Atlas code map (library + template usage)](lib-atlas/knowledge.md)

**consumers**  
Private repos (template, kingdom, oracle) that follow the blessed sets but never publish. *Region:* [Config package (toolchain, train)](lib-config/knowledge.md)

**Contact**  
One false-polymorphic table (User / Organization / Space owner) for phone, email, website and social handles, ordered by position. *Region:* [Messaging and contacts](messaging-contacts/knowledge.md)

**Contact.deliverability**  
Cached Bouncer verdict (30 days); undeliverable addresses are skipped pre-send. *Region:* [Email delivery and preferences](email-delivery/knowledge.md)

**ContactRegistry**  
Maps each ContactType to its ContactTypeDef; the entry point for parsing and validating any contact. *Region:* [Messaging and contacts](messaging-contacts/knowledge.md)

**contactRules**  
Before-mutation hook that validates and canonicalizes every Contact write through the registry. *Region:* [Messaging and contacts](messaging-contacts/knowledge.md)

**contacts**  
Class: the Contact model, its per-type registry, URL/handle parsers and contact rules. *Region:* [Messaging and contacts](messaging-contacts/knowledge.md)

**ContactType**  
Prisma enum of contact channels and handle networks (email, phone, website, linkedin, github, …). *Region:* [Messaging and contacts](messaging-contacts/knowledge.md)

**ContactTypeDef**  
Per-type def: inputSchema, parseInput, valueSchema, toValueKey, subtype, uniqueness, display. *Region:* [Messaging and contacts](messaging-contacts/knowledge.md)

**contentSchema**  
Zod schema for the type-specific payload stored in inquiry.content on create and update. *Region:* [Inquiry model and handlers](inquiry-handlers/knowledge.md)

**context**  
Factory result map of created related entities keyed by camelCase accessor names; passed back in to reuse them. *Region:* [Test factories, cleanup and test rules](test-factories-rules/knowledge.md)

**Context fallback**  
When the current context cannot view a route, useAuthenticatedRouting tries space → organization → user → public before Unauthorized. *Region:* [Navigation config and tenant context](navigation/knowledge.md)

**Context queries**  
makeContextQueries: one list query defined once for user, organization and space contexts; throws for a missing context. *Region:* [API client, SDK and query hooks](api-client/knowledge.md)

**ContextSelector**  
AppShell control for switching Personal/Organization/Space; reads tenant and auth from the store. *Region:* [Navigation config and tenant context](navigation/knowledge.md)

**Core Engineering Standards**  
ENTRYPOINT §7: reuse utilities/types, avoid signature churn, single-source logic, secure defaults, no any. *Region:* [Engineering process and docs](engineering-process-docs/knowledge.md)

**CountryCodeSchema / CurrencyCodeSchema / LanguageCodeSchema / TimezoneIdSchema**  
Zod schemas for reference codes in request schemas; is* guards narrow outside zod. *Region:* [Schema conventions and reference data](data-modeling/knowledge.md)

**Create and see**  
Start a flow without pre-checking; if every step already holds it returns complete and is never stored. *Region:* [Guided flows](flows/knowledge.md)

**createApiWebsocket**  
Client socket that reconnects and replays identity, then subscribes, then stream opens, tracking last seq per stream. *Region:* [WebSocket connections](ws-connections/knowledge.md)

**createAppQueryClient**  
Builds each app's QueryClient with global error handling and registers it in the client slice. *Region:* [API client, SDK and query hooks](api-client/knowledge.md)

**createAuthorize**  
Adapter binding @inixiative/permissions-roles / permissions-rebac' rebac check to the authorize seam for one resource; fails closed on cycles. *Region:* [Transitions library (lifecycle guards)](lib-transitions/knowledge.md)

**createBearerToken**  
Mints an API token for a test request that should authenticate as a token rather than a session. *Region:* [Test harness, request helpers and VCR](test-harness/knowledge.md)

**createEncryption**  
Low-level encrypt/decrypt service built from a keyring; feature code uses encryptField/decryptField instead. *Region:* [Encryption and secrets](encryption/knowledge.md)

**createFactory**  
Defines a typed build/create factory for a Prisma model with defaults and only non-inferable dependencies. *Region:* [Test factories, cleanup and test rules](test-factories-rules/knowledge.md)

**createFlow / meCreateFlow**  
Service and route (POST /api/v1/me/flows) that start a flow from flowKey and bindings. *Region:* [Guided flows](flows/knowledge.md)

**createFrontendLogger**  
Scoped, level-controlled consola logger for browser apps (FrontendScope). *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**createHydrator**  
Loads a record's to-one FK parent chain (ownership closure) via injected parents and load; de-dupes and breaks cycles within one call. *Region:* [Permissions library (ReBAC engine)](lib-permissions/knowledge.md)

**createInquiry / sendInquiry / resolveInquiry**  
The lifecycle services: create a draft, send it (then autoApprove), resolve it under a row lock. *Region:* [Inquiry model and handlers](inquiry-handlers/knowledge.md)

**createLens**  
Build a lens from field maps and bridges, anchored at mapName and model; stitches bridges itself. *Region:* [Using a lens: build, gate, fetch](lens-usage/knowledge.md)

**createLock**  
Single-node Redis lock with heartbeat lease renewal and fenced release; only one process owns a resource. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**createManyAndReturn / updateManyAndReturn**  
The bulk writes hooks support; plain createMany/updateMany throw. *Region:* [Mutation hooks, immutable fields, ordered lists](mutation-hooks/knowledge.md)

**createOnly**  
SeedFile flag: create missing records, never update existing ones. *Region:* [Database scripts and seeding](database-tooling/knowledge.md)

**createOptimisticListTarget**  
Builds a create/update/delete optimistic target for a list query from variables.path.id and variables.body. *Region:* [API client, SDK and query hooks](api-client/knowledge.md)

**CreateOrganizationModal**  
Collects a new org's name and an auto-derived, uniqueness-checked slug. *Region:* [Tenancy and Superadmin](tenancy/knowledge.md)

**createPermissions**  
Creates a typed permix instance for role-based action checks. *Region:* [Permissions library (ReBAC engine)](lib-permissions/knowledge.md)

**createRebacCheck**  
Builds check from an injected resolveRelation; generic over the resource union. *Region:* [Permissions library (ReBAC engine)](lib-permissions/knowledge.md)

**createRebacCheck / createHydrator**  
The @inixiative/permissions-roles / permissions-rebac engine: build the check from the schema, hydrate the ownership closure, then evaluate. *Region:* [ReBAC, owner-polymorphic and row permissions](permissions-rebac/knowledge.md)

**createRedisConnection**  
Open a dedicated connection, e.g. for BullMQ queue and worker. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**createResendClient / createConsoleClient**  
Real Resend client with a caller-supplied key; dev/test client that logs instead of sending. *Region:* [Email delivery and preferences](email-delivery/knowledge.md)

**createRoute**  
Route template for inserting a record (many: true for createMany); imported from #/lib/routeTemplates, never from @hono/zod-openapi. *Region:* [API routes, controllers and modules](api-routes/knowledge.md)

**createS3Client**  
Provider factory building the memoized S3-backed StorageClient from typed config. *Region:* [Adapters, integrations and storage](adapters-integrations/knowledge.md)

**createSerializedQueue**  
In-process promise chain; each run(fn) waits for the previous to settle. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**createTestApp**  
Builds the API app for route tests with mockUser, mockOrganizationUsers, mockSpaceUsers and mount; returns fetch and db. *Region:* [Test harness, request helpers and VCR](test-harness/knowledge.md)

**createTestSocket**  
Fakes a WebSocket handle with WSData for socket handler tests. *Region:* [Test harness, request helpers and VCR](test-harness/knowledge.md)

**createTestStore**  
Isolated app store with a retry-free query client for UI tests; testStore is the shared default. *Region:* [Test harness, request helpers and VCR](test-harness/knowledge.md)

**createTestWorker**  
Runs a job handler in tests with a mock job and worker context; createMockJob for just a Job object. *Region:* [Test harness, request helpers and VCR](test-harness/knowledge.md)

**createView**  
Build a view over a lens or narrowing in hand, with sourceValues. *Region:* [Rule builder: template usage](rules-builder/knowledge.md)

**createX**  
Factory variant that persists the entity and its dependencies. *Region:* [Test factories, cleanup and test rules](test-factories-rules/knowledge.md)

**cron**  
Class: DB-stored CronJob schedules, BullMQ repeatables, manual trigger and retention cleanup. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**CronJob**  
Model for a recurring job: name, jobId, UTC pattern, handler, payload, enabled, maxAttempts, backoffMs. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**cronJobSync**  
Hook that moves a BullMQ repeatable when a CronJob row is created, updated or deleted inside db.txn. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**ctx.enqueueChildJob**  
Adds a child to the running staged job (only inside a stage); never pass parent to enqueueJob. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**ctx.log**  
Logs to both stdout and the job's BullBoard log. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**ctx.log**  
Job-handler logger that dual-writes to the facade and BullBoard. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**ctx.signal**  
Cooperative abort signal a superseding job checks to stop work. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**cursorPaginate**  
Keyset pagination returning items with nextCursor and hasMore, no totals; for large or live-changing lists. *Region:* [Offset and cursor pagination](pagination/knowledge.md)

**CustomerModel**  
Discriminator for the customer side of a CustomerRef. *Region:* [Customers and segments](customers-segments/knowledge.md)

**CustomerRef**  
A customer (User, Organization or Space) linked to the provider (User, Organization or Space) serving it; the segment rule root. *Region:* [Customers and segments](customers-segments/knowledge.md)

**customerRefLens**  
Lens declaring the CustomerRef fields and relations a segment rule may read (contacts, tags, communications, segment memberships). *Region:* [Customers and segments](customers-segments/knowledge.md)

**customerRefLens**  
The CustomerRef rule root lens segments validate against; resolvedCustomerRefLens binds it to one provider. *Region:* [Template lenses](lenses/knowledge.md)

**customers**  
Class tag: CustomerRef customer/provider pairs, provider routes and the customer-ref lens. *Region:* [Customers and segments](customers-segments/knowledge.md)

## D

**dagger**  
Content-free marker: // gloss above a declaration or // gloss:file at the top; trailing content is a lint error. *Region:* [Gloss (margin comments)](lib-gloss/knowledge.md)

**Data hooks layering**  
makeDataConfig → useDataFilters → usePaginatedData / useInfiniteData → Table / Pagination / any renderer. *Region:* [Offset and cursor pagination](pagination/knowledge.md)

**data narrowing**  
A where clause: which rows are in scope; the field stays visible. *Region:* [The lens model](lens-model/knowledge.md)

**Data stream**  
A live view of one read route's default response: open → snapshot → appends → close, with a per-stream seq. *Region:* [WebSocket data streams](ws-data-streams/knowledge.md)

**{ data } envelope**  
Every response is wrapped in { data }; pagination and other metadata ride alongside. *Region:* [API routes, controllers and modules](api-routes/knowledge.md)

**data-modeling**  
Class: schema conventions such as split schema, UUIDv7 and typed IDs, enum naming, FK typing and false polymorphism. *Region:* [Schema conventions and reference data](data-modeling/knowledge.md)

**DataConfig**  
Frontend config from makeDataConfig(operationId): searchable/orderable fields, enum filters, default order, read from the OpenAPI spec. *Region:* [List filtering and search](filtering-search/knowledge.md)

**DataConfig**  
Frontend config from makeDataConfig(operationId) fed to usePaginatedData or useInfiniteData. *Region:* [Offset and cursor pagination](pagination/knowledge.md)

**datasource provider**  
prismaOptions.datasource.provider: decides whether toPrisma emits mode: 'insensitive'. *Region:* [Compiling rules to Prisma and SQL](json-rules-backends/knowledge.md)

**dayIn / dayNotIn**  
Weekday operators, computed in the evaluation timezone, never host-local. *Region:* [json-rules dates, windows and verbs](json-rules-dates/knowledge.md)

**db**  
The shared Prisma client from `@template/db`; inside an open transaction `db.<model>` routes to it. *Region:* [Database client and transactions](database-client/knowledge.md)

**db-client**  
Class: the transaction-aware Prisma client `db` and its scope, transaction and callback methods plus the delegate query helpers. *Region:* [Database client and transactions](database-client/knowledge.md)

**db-scripts**  
Class: the `bun run db:*` commands (generate, push, migrate, deploy, studio, dump, restore, clone) and scripts/db/. *Region:* [Database scripts and seeding](database-tooling/knowledge.md)

**db.findForUpdate**  
SELECT … FOR UPDATE inside db.txn; with upserting: true it fences a not-yet-existing key with a Redis lock. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**db.findForUpdate**  
SELECT ... FOR UPDATE inside db.txn; `{ upserting: true }` fences a not-yet-existing row with a Redis lock. *Region:* [Database client and transactions](database-client/knowledge.md)

**db.isInTxn**  
Reports whether the current scope is inside a transaction. *Region:* [Database client and transactions](database-client/knowledge.md)

**db.onCommit**  
Defers a callback until the surrounding transaction commits; emitAppEvent and the webhook hook use it. *Region:* [App events and webhooks](app-events-webhooks/knowledge.md)

**db.onCommit**  
Queues callbacks to run only after the surrounding transaction commits; throws outside db.txn. *Region:* [Database client and transactions](database-client/knowledge.md)

**db.onFinally**  
Queues callbacks for when the transaction ends, commit or rollback. *Region:* [Database client and transactions](database-client/knowledge.md)

**db.parallel**  
Runs tasks in their own database-client / data-modeling async scopes; with resolution allSettled each may fail alone and the failures are thrown after settlement. *Region:* [App events and webhooks](app-events-webhooks/knowledge.md)

**db.raw**  
The raw client: bypasses the current transaction and the mutation hooks. *Region:* [Database client and transactions](database-client/knowledge.md)

**db.raw**  
Client that bypasses transactions and hooks; only for deliberate hook skipping. *Region:* [Mutation hooks, immutable fields, ordered lists](mutation-hooks/knowledge.md)

**db.scope**  
Opens an AsyncLocalStorage scope (request id or `job:name:id`) carrying transaction state. *Region:* [Database client and transactions](database-client/knowledge.md)

**db.scope**  
AsyncLocalStorage scope keyed by request UUID or job ID; read with db.getScopeId() and db.getScopeContext(). *Region:* [Request context and errors](request-context-errors/knowledge.md)

**db.txn**  
Opens a transaction, or merges into the outermost one already open in this scope. *Region:* [Database client and transactions](database-client/knowledge.md)

**db.withDeleted**  
The single bypass of soft-delete scoping; must be awaited inside; mounted for admin routes by validateSuperadmin. *Region:* [Audit log and soft delete](audit-soft-delete/knowledge.md)

**db:clone**  
Copies a remote database-client / data-modeling to local and truncates webhook subscriptions so production webhooks don't fire. *Region:* [Database scripts and seeding](database-tooling/knowledge.md)

**db:deploy**  
Runs pending migrations; the CI and production path. *Region:* [Database scripts and seeding](database-tooling/knowledge.md)

**db:dump / db:restore**  
Export the database-client / data-modeling to a file and import it back. *Region:* [Database scripts and seeding](database-tooling/knowledge.md)

**db:generate**  
Regenerates the Prisma client and zod schemas; does not touch the database-client / data-modeling. *Region:* [Database scripts and seeding](database-tooling/knowledge.md)

**db:migrate**  
Creates a migration file to review and commit. *Region:* [Database scripts and seeding](database-tooling/knowledge.md)

**db:push**  
Pushes the schema to the database-client / data-modeling with no migration file; documented as dev only. *Region:* [Database scripts and seeding](database-tooling/knowledge.md)

**db:push:dev**  
Pushes the schema to the local dev database-client / data-modeling via the dev push script. *Region:* [Database scripts and seeding](database-tooling/knowledge.md)

**db:push:force**  
Push that accepts destructive (data-loss) changes. *Region:* [Database scripts and seeding](database-tooling/knowledge.md)

**db:studio**  
Opens Prisma Studio to browse and edit rows. *Region:* [Database scripts and seeding](database-tooling/knowledge.md)

**db:truncate:webhooks**  
Clears webhook subscriptions; local and test only. *Region:* [Database scripts and seeding](database-tooling/knowledge.md)

**DbIdentifier / DbValue**  
Branded strings for resolved DB names and stored values, so raw Prisma names fail to compile in SQL builders. *Region:* [Prisma-map and schema introspection](lib-prisma-map/knowledge.md)

**dbName**  
Sparse physical name from @@map / @map; absent means the Prisma name is the DB identifier. *Region:* [Prisma-map and schema introspection](lib-prisma-map/knowledge.md)

**debounce**  
Class tag: debouncing values and callbacks before they hit the backend (useDebounce). *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**Decomposition by Default**  
ENTRYPOINT §0.2: split distinct concerns, lifecycles and owners into separate records/functions. *Region:* [Engineering process and docs](engineering-process-docs/knowledge.md)

**Decoration**  
Presentational layer that hoists lens paths to the root selector as named facets and relabels fields and values. *Region:* [rules-builder library README](lib-rules-builder/knowledge.md)

**Decoration**  
Presentational layer that hoists lens paths to the root selector as named facets and relabels fields and values. *Region:* [Rule builder: template usage](rules-builder/knowledge.md)

**decryptField**  
Decrypts a registered key from a record with the current or previous key of its keyring. *Region:* [Encryption and secrets](encryption/knowledge.md)

**Deep clone mutable batch context**  
Each sub-request gets structuredClone copies of user, session, memberships and token; only read-only values like app are shared. *Region:* [Batch API](batch/knowledge.md)

**DEFAULT_RECIPIENT_NARROWING**  
The default User narrowing the recipient slot is built over. *Region:* [The email lens](email-lens/knowledge.md)

**DEFAULT_ZONE**  
'UTC', defined once in dateExpr.ts; the fallback when nothing sets a zone. *Region:* [json-rules dates, windows and verbs](json-rules-dates/knowledge.md)

**defaultExpirationDays**  
Days until a sent inquiry expires, via computeExpiresAt; omit for no expiry. *Region:* [Inquiry model and handlers](inquiry-handlers/knowledge.md)

**defaultRecipientNarrowing**  
By default a sender sees only its own level's memberships; platform and admin see both. *Region:* [The email lens](email-lens/knowledge.md)

**Deferral list**  
Redis sorted set job:<queue>:slow:deferred of parked or delayed slow jobs, so the lane's depth counts them. *Region:* [Job lanes and overflow outbox](job-lanes-outbox/knowledge.md)

**defineConfig**  
Type-checks the .atlas/config.ts object. *Region:* [Atlas code map (library + template usage)](lib-atlas/knowledge.md)

**defineStream**  
Declares a stream family with kind, ordering, params schema and audience. *Region:* [WebSocket data streams](ws-data-streams/knowledge.md)

**degraded rule**  
A stored rule with a missing binding, a lens that no longer admits it, or a dead reference; never matches, never stored as such. *Region:* [Template rules and rule references](json-rules/knowledge.md)

**Degraded segment**  
A segment whose rule (or a segment it depends on) is broken; keeps members and is skipped by reconciliation and sweep. *Region:* [Customers and segments](customers-segments/knowledge.md)

**delegation**  
A string ActionRule: the action is granted when another action on the same resource is (manage: 'own'). *Region:* [Permissions library (ReBAC engine)](lib-permissions/knowledge.md)

**deletedAt**  
Soft-delete timestamp; its presence makes a model soft-deletable. *Region:* [Audit log and soft delete](audit-soft-delete/knowledge.md)

**deleteRoute**  
Route template for deleting a record by id; its controller answers respond.noContent(). *Region:* [API routes, controllers and modules](api-routes/knowledge.md)

**deliverability**  
Cached address validity on Contact; distinct from preference (acceptedKinds) and channel ownership (verifiedAt). *Region:* [Messaging and contacts](messaging-contacts/knowledge.md)

**deliverEmail**  
Per-recipient job (body in deliverEmailMessage) that settles, gates, renders, claims, sends and records one email. *Region:* [Email delivery and preferences](email-delivery/knowledge.md)

**deliverEmailHandoffs**  
Email bridge that enqueues sendEmail for handoffs with deterministic planner job ids. *Region:* [Email delivery and preferences](email-delivery/knowledge.md)

**dependencies**  
Class: third-party dependency inventory and tech stack. *Region:* [Monorepo layout and architecture](monorepo-architecture/knowledge.md)

**DEPENDENCIES.md**  
Third-party package inventory by area, with the Planned table for packages not yet added. *Region:* [Monorepo layout and architecture](monorepo-architecture/knowledge.md)

**Dependency direction**  
apps → @template/permissions-roles / permissions-rebac, @template/email → @template/db, @template/shared; web → shared, ui. *Region:* [Monorepo layout and architecture](monorepo-architecture/knowledge.md)

**deploy.sh**  
scripts/deployment/deploy.sh behind `bun run deploy`; wait-for-api.sh polls the API health check. *Region:* [Environments, env vars and deploy](environments-deploy/knowledge.md)

**Deployment flow**  
Local → pr (feature branch) → staging (main) → prod (manual promotion); the intended model in ENVIRONMENTS.md. *Region:* [Environments, env vars and deploy](environments-deploy/knowledge.md)

**derived staleness**  
Header computed from git at read time (note written vs symbol changed since); nothing is stored. *Region:* [Gloss (margin comments)](lib-gloss/knowledge.md)

**describe**  
Builds a human-readable message from a Reason. *Region:* [Transitions library (lifecycle guards)](lib-transitions/knowledge.md)

**describe-and-validate vs deny**  
Classify and gate a rule up front; execution still denies whatever the lens refuses. *Region:* [Using a lens: build, gate, fetch](lens-usage/knowledge.md)

**describeRule**  
A rule's sources, bridges crossed, supportedTargets and gate errors — for routing and UX, not security. *Region:* [Using a lens: build, gate, fetch](lens-usage/knowledge.md)

**describeRuleSources**  
The literal values a rule names at each source a lens declares; dynamic: true when they cannot be enumerated. *Region:* [Lens option sources and bridges](lens-sources/knowledge.md)

**descriptor tree**  
The headless tree of GroupNode / LeafNode / ArrayNode a renderer draws (buildRoot, buildActionRoot, useRuleBuilder). *Region:* [rules-builder library README](lib-rules-builder/knowledge.md)

**descriptor tree**  
The headless tree of GroupNode / LeafNode / ArrayNode a renderer draws (buildRoot, buildActionRoot, useRuleBuilder). *Region:* [Rule builder: template usage](rules-builder/knowledge.md)

**DetailPanel / MasterDetailLayout**  
Scrolling detail view with fixed header; list pane beside detail pane. *Region:* [Layout system and theme](theme-layout/knowledge.md)

**dev-setup**  
Class: setup, local run, sanctioned scripts, Docker services, debugging. *Region:* [Dev setup and worktrees](dx-setup/knowledge.md)

**Direction section**  
Forthcoming INIT_SCRIPT_PATTERNS.md section on the headless cut-over; this region will be rebuilt from it. *Region:* [Init script architecture and direction](init-architecture/knowledge.md)

**directives**  
package.json gloss.directives: regex sources extending the recognized machine-comment set. *Region:* [Gloss (margin comments)](lib-gloss/knowledge.md)

**disabledText**  
Button/Input/DropdownMenuItem prop that disables the element and shows why. *Region:* [UI components and shared pages](ui-components/knowledge.md)

**dispatchMessage**  
Client entry that routes each inbound WSEvent to handlers[category][action]. *Region:* [WebSocket connections](ws-connections/knowledge.md)

**Doc alignment review**  
Agent-driven pass comparing each doc to code: dead code, orphaned, outdated, missing docs, unwired code. *Region:* [Engineering process and docs](engineering-process-docs/knowledge.md)

**docs-process**  
Class: docs workflow: read before, update after, doc structure and alignment review, doc routing. *Region:* [Engineering process and docs](engineering-process-docs/knowledge.md)

**Dot-path relation delegation**  
{ rel: 'a.b', action } checks the ancestor directly, skipping intermediate delegation; stricter than single-hop. *Region:* [ReBAC, owner-polymorphic and row permissions](permissions-rebac/knowledge.md)

**Dual-key rotation**  
Current and previous keys both decrypt during the rotation window, so no request fails mid-rotation. *Region:* [Encryption and secrets](encryption/knowledge.md)

**dynamic reference**  
An id source whose rows cannot be known at save (bind, path, contains, between); save refuses it. *Region:* [Template rules and rule references](json-rules/knowledge.md)

## E

**{{#each}}**  
Loop block over a collection; rules inside it become array rules (scopedRule). *Region:* [Email compose, render and save](email-render/knowledge.md)

**eligibility where**  
A source's where: a clamp on the options, narrowed under the whole lens as a rule is. *Region:* [Lens option sources and bridges](lens-sources/knowledge.md)

**eligible**  
Compiles an action into json-rules' Prisma plan selecting every record currently eligible for it. *Region:* [Transitions library (lifecycle guards)](lib-transitions/knowledge.md)

**email handoff**  
What an app-event handler returns to request a templated email: template slug plus binding data, never recipients. *Region:* [Email delivery and preferences](email-delivery/knowledge.md)

**email-delivery**  
Class: email sending through the sendEmail planner, deliverEmail, senders and provider adapters. *Region:* [Email delivery and preferences](email-delivery/knowledge.md)

**email-lens**  
Class: the email lens and email rule blocks: sender/recipient/data/system lenses, recipient variables, rule references on templates, packages/email/src/rules. *Region:* [The email lens](email-lens/knowledge.md)

**email-render**  
Class tag: the compose / render / save pipeline for email content. *Region:* [Email compose, render and save](email-render/knowledge.md)

**email-templates**  
Class: email templates and components, MJML, component refs, the owner cascade, compose/render/save pipeline, versioning. *Region:* [Email templates and components](email-templates/knowledge.md)

**EMAIL_SLOW_LANE_MIN_RECIPIENTS**  
Recipient count above which the deliver fan-out runs on the slow lane. *Region:* [Email delivery and preferences](email-delivery/knowledge.md)

**emailAddressSchema**  
Zod check that a bare string is an email address. *Region:* [Messaging and contacts](messaging-contacts/knowledge.md)

**EmailComponent**  
Prisma model for a reusable MJML fragment (header, footer, button) referenced by slug. *Region:* [Email templates and components](email-templates/knowledge.md)

**EmailEntry**  
Registry entry per slug: entity, sender, recipients, cc, bcc and data as lenses, plus render policy. *Region:* [Email delivery and preferences](email-delivery/knowledge.md)

**EmailHandoff**  
{ template, data } returned by a handler's email selector; recipients and sender come from the email registry, never to/cc/bcc on the handoff. *Region:* [App events and webhooks](app-events-webhooks/knowledge.md)

**EmailLens**  
Four lenses, one per scope root (sender, recipient, data, system), with no bridges between them. *Region:* [The email lens](email-lens/knowledge.md)

**EmailLens**  
The four per-root email lenses; members are listed here but the region is email-lens. *Region:* [Template lenses](lenses/knowledge.md)

**emailLensFor**  
Builds a slug's owner-scoped email lens from the registry entry, the default recipient narrowing and the row's stored slots; at send also takes the sender. *Region:* [The email lens](email-lens/knowledge.md)

**EmailOwnerModel**  
Owner discriminator for email rows: default, admin, Organization, Space, User, OrganizationUser, SpaceUser. *Region:* [Email templates and components](email-templates/knowledge.md)

**emailRegistry / defaultEmailClient**  
Registry of provider client adapters; the first registered client for a single send. *Region:* [Email delivery and preferences](email-delivery/knowledge.md)

**emailRuleReferences**  
The rows an email rule names. *Region:* [The email lens](email-lens/knowledge.md)

**emailRuleViolations**  
Vocabulary check: whether a rule may read its paths under the lens. *Region:* [The email lens](email-lens/knowledge.md)

**emailSurface**  
Composes the four slot surfaces under a presentation root Email for the rule-builder route. *Region:* [The email lens](email-lens/knowledge.md)

**emailSurfaceSourceValues**  
Keys fetched Tag and Segment options onto the email surface map. *Region:* [The email lens](email-lens/knowledge.md)

**EmailTemplate**  
Prisma model for a whole sendable MJML message with slug, locale, subject, kind, componentRefs and owner. *Region:* [Email templates and components](email-templates/knowledge.md)

**emailTemplateAuditLogId**  
CommunicationLog column pinning the template snapshot that was sent. *Region:* [Email templates and components](email-templates/knowledge.md)

**emailTokenPathKind**  
Classifies a token path under an email lens. *Region:* [The email lens](email-lens/knowledge.md)

**emailVerifier**  
Address verification via Bouncer (createBouncerVerifier), or no-op without a key. *Region:* [Email delivery and preferences](email-delivery/knowledge.md)

**emailVersioning**  
Hook that stamps AuditLog.componentVersions and backpropagates fresh snapshots to ancestors when a component changes. *Region:* [Email templates and components](email-templates/knowledge.md)

**emitAppEvent**  
emitAppEvent(name, data): builds the actor envelope and runs the registered handler, after commit when inside db.txn(). *Region:* [App events and webhooks](app-events-webhooks/knowledge.md)

**emitFromCassette**  
Replays recorded cassette events onto an emitter for event-stream providers. *Region:* [Test harness, request helpers and VCR](test-harness/knowledge.md)

**EmptyState**  
Icon/title/description/action block; Table renders it automatically for empty data. *Region:* [UI components and shared pages](ui-components/knowledge.md)

**ENCRYPTED_MODELS**  
Registry of models and their encrypted keys (envPrefix + buildAAD); registering a key is the only step to encrypt a field. *Region:* [Encryption and secrets](encryption/knowledge.md)

**EncryptedFieldData**  
The payload { ciphertext, version, iv, authTag }, split across the three columns. *Region:* [Encryption and secrets](encryption/knowledge.md)

**encryptField**  
encryptField(model, key, record) returns the three column values to persist; type-checked per model and key. *Region:* [Encryption and secrets](encryption/knowledge.md)

**encryption**  
Class tag: field-level encryption (AES-256-GCM), keyrings, key rotation, CI version validation. *Region:* [Encryption and secrets](encryption/knowledge.md)

**encryptionEnv**  
Env schema builder for every registered prefix; validates integer versions and 256-bit base64 keys at boot. *Region:* [Encryption and secrets](encryption/knowledge.md)

**engineering-process**  
Class: how agents work here: why-first, decomposition, YAGNI both ways, verification, reuse what exists. *Region:* [Engineering process and docs](engineering-process-docs/knowledge.md)

**engineGlobals**  
Process-wide engine defaults by dotted path; with() scopes a synchronous override, reset() restores defaults. *Region:* [Running, validating and typing rules](json-rules-runtime/knowledge.md)

**enqueueJob**  
The one way to queue a job by handler name with options (delay, attempts, type, lane, bypass); inline in tests. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**ensureProdEncryptionKeys / ensureStagingEncryptionKeys**  
Init Infisical steps that seed each prefix's keyring at version 1 in prod and staging. *Region:* [Encryption and secrets](encryption/knowledge.md)

**Entitlements**  
JSON boolean grants on OrganizationUser or Token, merged over role actions as an allow override. *Region:* [Roles, actions and permission checks](permissions-roles/knowledge.md)

**enum narrowing**  
Allowed enum values intersected from five sources, per field and per path. *Region:* [The lens model](lens-model/knowledge.md)

**Enum suffix naming**  
Prisma enums end in Model / Type / Status (e.g. `TokenOwnerModel`). *Region:* [Schema conventions and reference data](data-modeling/knowledge.md)

**EnumField**  
kind 'enum' field with ordered values and sparse valueDbNames from @map on members. *Region:* [Prisma-map and schema introspection](lib-prisma-map/knowledge.md)

**enumOmits**  
Hides enum values from the SDK type surface; paired with root.where for server enforcement. *Region:* [List filtering and search](filtering-search/knowledge.md)

**env schema**  
Zod schema in apps/<app>/src/config/env.ts; the one place env vars are declared, coerced and defaulted. *Region:* [Environments, env vars and deploy](environments-deploy/knowledge.md)

**env-config**  
Class: environment names and detection, env files, Infisical, with-env composition, adding env vars. *Region:* [Environments, env vars and deploy](environments-deploy/knowledge.md)

**.env.*.example**  
Committed templates listing every variable; the source sync-env copies from. *Region:* [Environments, env vars and deploy](environments-deploy/knowledge.md)

**.env.local / .env.test**  
Uncommitted local and test env files at the root, with optional per-app overrides that load second. *Region:* [Environments, env vars and deploy](environments-deploy/knowledge.md)

**{ENV_PREFIX}_ENCRYPTION_KEY_CURRENT**  
Base64 32-byte key used to encrypt; generate with openssl rand -base64 32. *Region:* [Encryption and secrets](encryption/knowledge.md)

**{ENV_PREFIX}_ENCRYPTION_KEY_PREVIOUS**  
Prior key kept so old rows still decrypt during rotation; required when version > 1. *Region:* [Encryption and secrets](encryption/knowledge.md)

**{ENV_PREFIX}_ENCRYPTION_VERSION**  
Integer current key version (not "v2"); the previous version is current - 1. *Region:* [Encryption and secrets](encryption/knowledge.md)

**Environment**  
'local' | 'test' | 'pr' | 'staging' | 'prod' from @template/shared/utils. *Region:* [Encryption and secrets](encryption/knowledge.md)

**Environment**  
Type of the canonical environment names: local, test, pr, staging, prod. *Region:* [Environments, env vars and deploy](environments-deploy/knowledge.md)

**ENVIRONMENT**  
The env var that names the running environment; the is* flags are derived from it. *Region:* [Environments, env vars and deploy](environments-deploy/knowledge.md)

**envPrefix**  
A registry key's env var prefix, e.g. AUTH_PROVIDER_SECRETS. *Region:* [Encryption and secrets](encryption/knowledge.md)

**errorHandlerMiddleware**  
app.onError handler mapping ZodError, Prisma errors, ResponseValidationError, AppError and raw Error to responses. *Region:* [Request context and errors](request-context-errors/knowledge.md)

**errorReporter**  
The adapter that reports errors to the configured provider; app code never imports the provider SDK. *Region:* [Adapters, integrations and storage](adapters-integrations/knowledge.md)

**errorReporter**  
Adapter singleton: Sentry (createSentryReporter) when enabled with a DSN, console reporter otherwise. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**errors**  
Class: makeError/AppError, the global errorHandlerMiddleware, HTTP_ERROR_MAP and the status conventions. *Region:* [Request context and errors](request-context-errors/knowledge.md)

**escapeLikePattern**  
Escapes backslash, % and _ so user text matches literally in contains / startsWith / endsWith. *Region:* [List filtering and search](filtering-search/knowledge.md)

**estimateSegmentReach**  
Counts customers matching unsaved conditions with the same admission checks as save (the reach endpoint). *Region:* [Customers and segments](customers-segments/knowledge.md)

**evaluateScopedRule**  
Evaluates a loop-scoped rule against the collection pinned to the element in scope (narrowToElements). *Region:* [The email lens](email-lens/knowledge.md)

**evaluation timezone**  
The one IANA zone an evaluation or compile runs in; resolved once by resolveDateConfig. *Region:* [json-rules dates, windows and verbs](json-rules-dates/knowledge.md)

**.events.jsonl**  
Machine-local harvester state under .gloss/, gitignored by setup. *Region:* [Gloss (margin comments)](lib-gloss/knowledge.md)

**exclude**  
package.json gloss.exclude: path prefixes for vendored or foreign trees, applied to every surface. *Region:* [Gloss (margin comments)](lib-gloss/knowledge.md)

**execAsync**  
promisify(exec) wrapper every init/api CLI call uses; execSync there is a bug. *Region:* [Init script architecture and direction](init-architecture/knowledge.md)

**execAsync**  
promisify(exec) wrapper every init/api CLI call uses; execSync there is a bug. *Region:* [Writing an init task](init-tasks/knowledge.md)

**executeBatch**  
Runs a batch request's rounds under its strategy and returns results. *Region:* [Batch API](batch/knowledge.md)

**executePrismaPlan**  
Run a plan's groupBy steps and field references and return the final where — the only way to read it. *Region:* [Compiling rules to Prisma and SQL](json-rules-backends/knowledge.md)

**executePrismaPlan**  
json-rules function that resolves a plan's field and step references against the client and returns the where. *Region:* [Transitions library (lifecycle guards)](lib-transitions/knowledge.md)

**executeRequest**  
Dispatches one sub-request through the Hono app with tracing. *Region:* [Batch API](batch/knowledge.md)

**Execution contract**  
ENTRYPOINT §2: patch plan before edits, smallest patch, agreed validations, report files and output. *Region:* [Engineering process and docs](engineering-process-docs/knowledge.md)

**expectStreamAudience**  
Test helper that fails when differently privileged callers get different snapshots of a shared stream. *Region:* [WebSocket data streams](ws-data-streams/knowledge.md)

**extremal windowing**  
The only windowed rule toPrisma compiles: take 1, one orderBy, a monotonic aligned condition (or a filter alone). *Region:* [Compiling rules to Prisma and SQL](json-rules-backends/knowledge.md)

## F

**Facet**  
A named root-selector entry: a leaf, a collection (array node) or a branch (scoped group). *Region:* [rules-builder library README](lib-rules-builder/knowledge.md)

**Facet**  
A named root-selector entry: a leaf, a collection (array node) or a branch (scoped group). *Region:* [Rule builder: template usage](rules-builder/knowledge.md)

**FacetCondition**  
A Condition whose rules may carry variable slots; the type preset facets are built from. *Region:* [rules-builder library README](lib-rules-builder/knowledge.md)

**facetId**  
Facet identity computed ignoring defaults and defaultWhere, so cosmetic changes do not make a new facet. *Region:* [rules-builder library README](lib-rules-builder/knowledge.md)

**factory**  
createX / buildX from @template/db/test: (overrides?, context?) => Promise<{ entity, context }>. *Region:* [Test factories, cleanup and test rules](test-factories-rules/knowledge.md)

**fail open**  
When Redis is down, rate limits allow the request (warn and report) and cache reads fall through. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**failOnRound**  
Strategy: no transactions; stops after the first round containing a failure. *Region:* [Batch API](batch/knowledge.md)

**False polymorphism**  
A discriminator enum plus one nullable typed FK per kind, instead of a `type` + `id` pair; gives real FK constraints and typed includes. *Region:* [Schema conventions and reference data](data-modeling/knowledge.md)

**False polymorphism**  
Polymorphic relations as one nullable FK per possible type, with PolymorphismRegistry for constraints and resolution. *Region:* [Monorepo layout and architecture](monorepo-architecture/knowledge.md)

**fanOutLane**  
sendEmail's per-enqueue lane choice: slow above EMAIL_SLOW_LANE_MIN_RECIPIENTS recipients. *Region:* [Job lanes and overflow outbox](job-lanes-outbox/knowledge.md)

**FEATURES.md / COMPARISONS.md**  
Subsystem inventory and comparisons to consult before concluding something is missing. *Region:* [Engineering process and docs](engineering-process-docs/knowledge.md)

**FEATURES.md / COMPARISONS.md**  
Status-marked subsystem inventory and comparisons; check before concluding something is missing. *Region:* [Monorepo layout and architecture](monorepo-architecture/knowledge.md)

**fetchAllPages**  
Walks every page of a paginated source and returns all rows, capped; the cap hit throws. *Region:* [Offset and cursor pagination](pagination/knowledge.md)

**fetchAndHydrateMe**  
Loads /me into the store and runs permissions-roles / permissions-rebac.setup. *Region:* [Frontend Authentication](frontend-auth/knowledge.md)

**fetchLens**  
Loads every row a lens matches (packages/db). *Region:* [Template lenses](lenses/knowledge.md)

**fetchOne**  
Fetch one hydrated record by identifier, cached in Redis with a TTL. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**{ __field } reference**  
The sentinel a Prisma column comparison carries, resolved to prisma.<model>.fields.<column> by executePrismaPlan. *Region:* [Compiling rules to Prisma and SQL](json-rules-backends/knowledge.md)

**FieldDefault**  
A field's @default as { kind: 'literal', value } or { kind: 'generated', expression }; generated ones are never injected. *Region:* [Prisma-map and schema introspection](lib-prisma-map/knowledge.md)

**fieldErrors**  
Per-field messages on 422 errors; Zod issues map onto it for forms. *Region:* [Request context and errors](request-context-errors/knowledge.md)

**FieldKind**  
A field type key (Int, String, DateTime, …) the operator catalog is keyed by. *Region:* [Writing a json-rules rule](json-rules-shapes/knowledge.md)

**FieldKind**  
json-rules field type classification used to pick operators (getOperatorsForKind). *Region:* [Rule builder: template usage](rules-builder/knowledge.md)

**FieldMap / FieldMapSet**  
A source's { models, enums? }; a FieldMapSet groups several maps plus the bridges between them. *Region:* [Using a lens: build, gate, fetch](lens-usage/knowledge.md)

**fieldSearchOperator**  
The Prisma search clause for one scalar field (contains or equals by field type). *Region:* [List filtering and search](filtering-search/knowledge.md)

**file-based routing**  
TanStack Router scans app/routes and generates a type-safe route tree (bun run generate:routes). *Region:* [Frontend apps, routes and layouts](frontend-apps-routing/knowledge.md)

**filing rule**  
If deleting a gloss entry could change correct behavior, it was misfiled and belongs in // why:. *Region:* [Gloss (margin comments)](lib-gloss/knowledge.md)

**filter-first**  
Under an all array rule narrowRule puts the clamp in the window filter, so out-of-scope rows never participate. *Region:* [The lens model](lens-model/knowledge.md)

**filtering-search**  
List filtering, search and orderBy: bracket query notation, buildWhereClause, searchable and orderable fields. *Region:* [List filtering and search](filtering-search/knowledge.md)

**filterLens**  
Route-template arg that applies a lens to a list read so callers only see rows they may read. *Region:* [API routes, controllers and modules](api-routes/knowledge.md)

**filterLens**  
A list route's LensNarrowing over lensFor(Model) that controls which fields can be filtered and sorted, not the response shape. *Region:* [List filtering and search](filtering-search/knowledge.md)

**filterLens**  
A route's LensNarrowing over lensFor(Model) controlling accepted filters and sorting, not response shape. *Region:* [Template lenses](lenses/knowledge.md)

**filterLens**  
The route's filter whitelist paginate() reads from context; its rules live in the filtering-search region. *Region:* [Offset and cursor pagination](pagination/knowledge.md)

**FindForUpdateLockTimeoutError**  
Thrown when the create-if-missing fence is not acquired within waitMs (default 3000ms), rolling back the transaction. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**FindForUpdateLockTimeoutError**  
Thrown when an `upserting` fence can't get its Redis lock within waitMs (default 3000ms); rolls the transaction back. *Region:* [Database client and transactions](database-client/knowledge.md)

**findRoute / findRouteAcrossContexts**  
Match a path to its nav item within one context, or across contexts. *Region:* [Navigation config and tenant context](navigation/knowledge.md)

**fixed window**  
A counter per scope, window and identity: limit:{scope}:{windowMs}:{identity}. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**FK auto-inference**  
Factories infer dependencies from {modelName}Id fields; non-standard or composite FKs need a dependencies entry. *Region:* [Test factories, cleanup and test rules](test-factories-rules/knowledge.md)

**Flow**  
Row holding a user's active guided flow: flowKey, stored steps and returnUrl; hard-deleted when done. *Region:* [Guided flows](flows/knowledge.md)

**FlowBanner**  
The Continue/Finish button mounted once per app in __root.tsx. *Region:* [Guided flows](flows/knowledge.md)

**FlowKey**  
Enum naming each registered flow, e.g. setUpOrganization. *Region:* [Guided flows](flows/knowledge.md)

**flowNext**  
The single rule deciding Finish, Continue to the step's page, or nothing. *Region:* [Guided flows](flows/knowledge.md)

**flowRead / flowDelete**  
GET and DELETE /api/v1/flow/:id: recheck (404 once dropped or finished) and explicit end. *Region:* [Guided flows](flows/knowledge.md)

**flowRegistry**  
Map from FlowKey to its FlowDefinition (bindingsSchema and steps), one file per flow. *Region:* [Guided flows](flows/knowledge.md)

**flows**  
Class: guided in-app flows: registry, server-checked steps and the FlowBanner client. *Region:* [Guided flows](flows/knowledge.md)

**FlowStep**  
key, label, to, advance, readPath and a json-rules rule over { data }. *Region:* [Guided flows](flows/knowledge.md)

**flushOutbox**  
Shutdown drain of the accumulator, with retries, after intake stops. *Region:* [Job lanes and overflow outbox](job-lanes-outbox/knowledge.md)

**flushRedis**  
Clears the in-memory Redis mock between tests; throws outside tests. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**followFlow / dropFlow**  
Act on flowNext's result vs abandon the flow without navigating. *Region:* [Guided flows](flows/knowledge.md)

**Four-Context Architecture**  
User, Organization, Space and Public contexts, each with its own navigation, routes and permissions-roles / permissions-rebac. *Region:* [Tenancy and Superadmin](tenancy/knowledge.md)

**from: 'mapDefaults' pointer**  
A path source that offers every row the model's own source admits, linked or not. *Region:* [Lens option sources and bridges](lens-sources/knowledge.md)

**fromFields / toFields**  
A relation's FK columns and referenced columns; empty arrays on back-relations. *Region:* [Prisma-map and schema introspection](lib-prisma-map/knowledge.md)

**frontend-auth**  
Class: the auth slice, login/signup forms, OAuth callback and guards. *Region:* [Frontend Authentication](frontend-auth/knowledge.md)

**frontend-routing**  
Class: the three frontend apps, their file routes, layouts and app shells. *Region:* [Frontend apps, routes and layouts](frontend-apps-routing/knowledge.md)

**frontend-store**  
Class: the shared Zustand store, its six slices, access patterns and how to add or remove a slice. *Region:* [Frontend store (Zustand slices)](frontend-store/knowledge.md)

**frozen-lockfile**  
CI install mode that kills the stale-lockfile class. *Region:* [Config package (toolchain, train)](lib-config/knowledge.md)

**_fullscreen**  
Layout route: requireAuth + FullscreenLayout without AppShell, for invoices, previews, print, embeds, focused flows. *Region:* [Frontend apps, routes and layouts](frontend-apps-routing/knowledge.md)

## G

**.gen. files**  
Template-owned generated files, ignored by git, lint, search and turbo task inputs. *Region:* [Scripts, lint and build tooling](dx-tools/knowledge.md)

**.gen. files**  
Template-owned generated artifacts (routeTree.gen.ts, prismaMap.gen.ts, openapi.local.gen.json), ignored by git, lint and search. *Region:* [Monorepo layout and architecture](monorepo-architecture/knowledge.md)

**generate:openapi**  
Turbo task that produces the OpenAPI spec from the API routes; the SDK is generated from it. *Region:* [Request schemas and OpenAPI](api-schemas-openapi/knowledge.md)

**generate:sdk**  
Script that regenerates @template/sdk from openapi.gen.json; SDK_ENVIRONMENT targets a non-local env. *Region:* [API client, SDK and query hooks](api-client/knowledge.md)

**generated zod schemas**  
packages/db/src/generated/zod/, produced by prisma-zod-generator on db:generate, e.g. UserCreateInputObjectZodSchema. *Region:* [Request schemas and OpenAPI](api-schemas-openapi/knowledge.md)

**Generation chain**  
turbo dependsOn ordering db:generate → generate:openapi → generate:sdk, then app restarts. *Region:* [Scripts, lint and build tooling](dx-tools/knowledge.md)

**get / post / patch / del / json**  
Request builders and typed response parser from #tests/utils/request; jsonError for error bodies. *Region:* [Test harness, request helpers and VCR](test-harness/knowledge.md)

**getConcurrency**  
Returns the tightest predefined cap across the ConcurrencyType resources touched. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**getContextParams**  
Turns tenant context into [model, record] for permissions-roles / permissions-rebac.check in access rules. *Region:* [Navigation config and tenant context](navigation/knowledge.md)

**getContextParams**  
Returns [model, record] for the current organization, space or user context. *Region:* [Roles, actions and permission checks](permissions-roles/knowledge.md)

**getEncryptedFieldsByModel**  
Lists every encrypted column per model from the registry for redactFields / ignore lists. *Region:* [Encryption and secrets](encryption/knowledge.md)

**getFieldNames**  
Derives a key's column triplet: encrypted{Key}, encrypted{Key}Metadata, encrypted{Key}KeyVersion. *Region:* [Encryption and secrets](encryption/knowledge.md)

**getModelRelations / getAccessorRelations**  
A model's relations with relation name and target, keyed by model name or by accessor. *Region:* [Prisma-map and schema introspection](lib-prisma-map/knowledge.md)

**getNextSeq**  
Incrementing number for unique test values. *Region:* [Test factories, cleanup and test rules](test-factories-rules/knowledge.md)

**getPolymorphismConfig**  
Returns a model's `{ typeField, fkMap }` from PolymorphismRegistry, or null if it isn't polymorphic. *Region:* [Schema conventions and reference data](data-modeling/knowledge.md)

**getProjectConfig**  
Reads project.config.ts via a timestamp-busted dynamic import so repeat reads are fresh. *Region:* [Init script architecture and direction](init-architecture/knowledge.md)

**getRedisClient**  
The shared main connection for all non-blocking commands. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**getRedisSub / getRedisPub**  
The dedicated subscriber connection (SUBSCRIBE blocks) and the publisher client. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**getRelations**  
Lists a model's relations with targetModel, isList, collapsed foreignKey and annotations. *Region:* [Prisma-map and schema introspection](lib-prisma-map/knowledge.md)

**getResource**  
Reads the record resourceContextMiddleware loaded for the route's :id, typed by generic. *Region:* [Request context and errors](request-context-errors/knowledge.md)

**getSecretAsync / setSecretAsync**  
Read or store a secret in Infisical by project, environment and path (the doc's getSecret / setSecret); the source for secrets on resume. *Region:* [Writing an init task](init-tasks/knowledge.md)

**getState()**  
useAppStore.getState(): reads state or calls actions outside React components and in handlers. *Region:* [Frontend store (Zustand slices)](frontend-store/knowledge.md)

**getValidatedBody / getValidatedQuery**  
Typed validated body/query for code that only has a generic Context<AppEnv>. *Region:* [Request context and errors](request-context-errors/knowledge.md)

**getValidOperators / isValidOperatorForField**  
Which filter operators a model field's type allows; the SDK schema is generated from the same list. *Region:* [List filtering and search](filtering-search/knowledge.md)

**GLOBAL_IMMUTABLE_FIELDS**  
id, createdAt and every FK: stripped from every update unless an override excludes them. *Region:* [Mutation hooks, immutable fields, ordered lists](mutation-hooks/knowledge.md)

**gloss**  
A margin note for a source file, read only when the code confuses you. *Region:* [Gloss (margin comments)](lib-gloss/knowledge.md)

**gloss check**  
Bidirectional dagger <-> section audit; blocking in CI; detects renames, moves and orphans. *Region:* [Gloss (margin comments)](lib-gloss/knowledge.md)

**gloss fix**  
Repairs what check found; the required response to a red check. *Region:* [Gloss (margin comments)](lib-gloss/knowledge.md)

**gloss harvest --staged**  
The pre-commit harvest path. *Region:* [Gloss (margin comments)](lib-gloss/knowledge.md)

**gloss history**  
Per-section changelog scoped from git log -p. *Region:* [Gloss (margin comments)](lib-gloss/knowledge.md)

**gloss lint**  
Flags source comments that are not // why:, a dagger, or a directive. *Region:* [Gloss (margin comments)](lib-gloss/knowledge.md)

**gloss markers**  
<!-- gloss:begin --> / <!-- gloss:end --> around the CLAUDE.md block; re-running gloss setup replaces what is between them. *Region:* [Gloss (margin comments)](lib-gloss/knowledge.md)

**gloss read**  
Prints a file's gloss with a derived staleness header per section. *Region:* [Gloss (margin comments)](lib-gloss/knowledge.md)

**gloss setup**  
Creates .gloss/ and installs or upgrades the CLAUDE.md block between gloss markers. *Region:* [Gloss (margin comments)](lib-gloss/knowledge.md)

**gloss watch**  
Opt-in, debounced harvest on save. *Region:* [Gloss (margin comments)](lib-gloss/knowledge.md)

**.gloss/**  
Committed mirrored tree at the repo root; src/foo.ts glosses to .gloss/src/foo.ts.md. *Region:* [Gloss (margin comments)](lib-gloss/knowledge.md)

**// gloss:file**  
Dagger saying a file-level preamble exists in the gloss. *Region:* [Gloss (margin comments)](lib-gloss/knowledge.md)

**Guest user**  
A User created by findUserOrCreateGuest for an email with no account yet. *Region:* [Auth middleware, validators and users](auth-middleware-users/knowledge.md)

**guidance**  
UI behaviour hint in the error body: fixInput, reauthenticate, requestPermission, tryAgain, refreshAndRetry, contactSupport. *Region:* [Request context and errors](request-context-errors/knowledge.md)

## H

**handleApiError / describeError**  
Frontend helpers turning an unknown error into a user-facing message (onError toast vs inline display). *Region:* [Request context and errors](request-context-errors/knowledge.md)

**handleApprove**  
The handler's side effect when an inquiry is approved. *Region:* [Inquiry model and handlers](inquiry-handlers/knowledge.md)

**handlers/index.ts**  
Registry of JobHandlerName, JobPayloads and jobHandlers; every new handler is added here. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**happy-dom**  
DOM for frontend tests via @happy-dom/global-registrator preloaded from bunfig.toml. *Region:* [Test harness, request helpers and VCR](test-harness/knowledge.md)

**HARD_DELETE_ON_TOMBSTONE**  
Ephemeral grant models (Session, Token, WebhookSubscription) hard-deleted on cascade so a revive can't restore them. *Region:* [Audit log and soft delete](audit-soft-delete/knowledge.md)

**harvester**  
Moves non-directive, non-why, non-dagger comments into the enclosing symbol's gloss section and plants the dagger. *Region:* [Gloss (margin comments)](lib-gloss/knowledge.md)

**health route**  
apps/api/src/routes/health answers process health checks. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**heartbeat**  
Self-scheduling timer that runs the next beat only after the previous settles; returns stop(). *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**heartbeat**  
Client ping every 30s, reconnect if no pong in 5s; ping is answered before the per-connection queue. *Region:* [WebSocket connections](ws-connections/knowledge.md)

**heldAppends**  
Appends that arrive during the snapshot read, sent after it and dropped by seq if the snapshot already holds them. *Region:* [WebSocket data streams](ws-data-streams/knowledge.md)

**Hierarchical token scopes**  
A token acts within its owner scope: a Space token cannot reach its Organization; user-shaped tokens act as that user. *Region:* [Authentication: sessions, providers, tokens](authentication/knowledge.md)

**Hierarchical Tokens**  
Tokens scoped to User (cross-org), Organization (all spaces) or Space (one space). *Region:* [Tenancy and Superadmin](tenancy/knowledge.md)

**HOOK_IGNORE_FIELDS**  
Shared ignore registry: fields excluded from webhook payloads, stripped from audit diffs and treated as no-op updates; composes encrypted and ordered-list fields. *Region:* [App events and webhooks](app-events-webhooks/knowledge.md)

**HookTiming / DbAction**  
Enums naming when a hook runs (before/after) and on which operations (create, update, deleteMany, ...). *Region:* [Mutation hooks, immutable fields, ordered lists](mutation-hooks/knowledge.md)

**HTTP_ERROR_MAP**  
Single source in @template/shared of each status's label, message and default guidance. *Region:* [Request context and errors](request-context-errors/knowledge.md)

**hydrate**  
Loads a record's schema relations recursively with deduplicated fetches, instead of hand-written includes. *Region:* [Prisma-map and schema introspection](lib-prisma-map/knowledge.md)

## I

**idempotencyKey**  
Event-anchored, hash-last key: planner {event}:{template}:{hash(data)}; deliver adds sender, email and contents hashes. *Region:* [Email delivery and preferences](email-delivery/knowledge.md)

**Idempotent create**  
Create call that treats 'already exists' as success and returns the existing id (createRailwayConnection, createRailwaySync, ensureRailwayConnection). *Region:* [Writing an init task](init-tasks/knowledge.md)

**Idempotent rotation**  
updateManyAndReturn with the old version in the where clause, so a rerun or a racing worker never double-encrypts. *Region:* [Encryption and secrets](encryption/knowledge.md)

**identity**  
The function keying a bucket: userIdentity, principalIdentity, spaceIdentity, organizationIdentity, ipIdentity. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**{{#if rule=…}}**  
Conditional block whose json-rules condition is checked at save and evaluated through the lens at render. *Region:* [Email compose, render and save](email-render/knowledge.md)

**immutable-fields**  
Class: silent stripping of id, createdAt, FKs and configured fields from update data. *Region:* [Mutation hooks, immutable fields, ordered lists](mutation-hooks/knowledge.md)

**ImmutableFieldsOverrides**  
Per-model include/exclude adjustments to the default immutable set (id, createdAt, all FKs). *Region:* [Mutation hooks, immutable fields, ordered lists](mutation-hooks/knowledge.md)

**includeCustomer**  
Prisma include for the customer side, used when a provider lists its customers. *Region:* [Customers and segments](customers-segments/knowledge.md)

**includeInquirySent / includeInquiryReceived / includeInquiryResponse**  
Prisma includes matched to the acting side: targets only, sources only, or all six relations. *Region:* [Inquiry API and frontend](inquiry-routes-ui/knowledge.md)

**includeProvider**  
Prisma include for the provider side, used when a customer lists its providers. *Region:* [Customers and segments](customers-segments/knowledge.md)

**index route**  
Where a page moves when its segment gains children (bots/index.tsx + bots/$id.tsx). *Region:* [Frontend apps, routes and layouts](frontend-apps-routing/knowledge.md)

**indexBridges**  
Pre-index foreign rows by a bridge's on field so they can be embedded under each anchor row. *Region:* [Lens option sources and bridges](lens-sources/knowledge.md)

**Infisical**  
Secret store for the pr, staging and prod environments; .infisical.json marks a project as configured. *Region:* [Encryption and secrets](encryption/knowledge.md)

**Infisical**  
Secret store for pr, staging and prod; configured by init, `.infisical.json` marks it set up. *Region:* [Environments, env vars and deploy](environments-deploy/knowledge.md)

**INFRA-003 / INFRA-005**  
Tickets tracking template CI/CD and the platform baseline; template commits no CI workflow today. *Region:* [Environments, env vars and deploy](environments-deploy/knowledge.md)

**inheritToSpaces**  
Flag letting a Space resolve its Organization's template or component in the cascade. *Region:* [Email templates and components](email-templates/knowledge.md)

**init-architecture**  
Class tag: the init TUI's state architecture, layout and direction. *Region:* [Init script architecture and direction](init-architecture/knowledge.md)

**init-tasks**  
Class tag: the patterns one init task follows. *Region:* [Writing an init task](init-tasks/knowledge.md)

**initGracefulShutdown**  
Installs signal handling that runs onShutdown handlers within a timeout; called once. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**initializeTelemetry**  
Starts process telemetry once from readTelemetryConfig('api'|'worker'). *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**initializeWorker**  
Starts the BullMQ worker; skipped in the test environment. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**InquiriesPage**  
The base list page (sent / received, type filters) every typed inquiry page wraps. *Region:* [Inquiry API and frontend](inquiry-routes-ui/knowledge.md)

**Inquiry**  
A source-to-target request with type, status, content, resolution, sentAt and expiresAt. *Region:* [Inquiry model and handlers](inquiry-handlers/knowledge.md)

**inquiry-handlers**  
Class tag: the Inquiry model, handlers and services. *Region:* [Inquiry model and handlers](inquiry-handlers/knowledge.md)

**inquiry-routes-ui**  
Class tag: inquiry endpoints, schemas and frontend. *Region:* [Inquiry API and frontend](inquiry-routes-ui/knowledge.md)

**InquiryHandler**  
Per-type definition of sources, targets, schemas, validate, handleApprove, autoApprove, unique, expiry and appEvents. *Region:* [Inquiry model and handlers](inquiry-handlers/knowledge.md)

**InquiryResourceModel**  
The party enum on both ends: admin, User, OrganizationUser, Organization, Space, SpaceUser, Integration, Token. *Region:* [Inquiry model and handlers](inquiry-handlers/knowledge.md)

**InquirySourceControls / InquiryTargetControls**  
The two sides' action controls, gated by useInquiryPermission. *Region:* [Inquiry API and frontend](inquiry-routes-ui/knowledge.md)

**InquiryStatus**  
draft, sent, changesRequested, approved, denied, canceled. *Region:* [Inquiry model and handlers](inquiry-handlers/knowledge.md)

**inquiryTerminalStatuses**  
Backend closed states (approved, denied, canceled) for notIn queries. *Region:* [Inquiry model and handlers](inquiry-handlers/knowledge.md)

**InquiryType**  
Enum of inquiry kinds: inviteOrganizationUser, createSpace, updateSpace, transferSpace. *Region:* [Inquiry model and handlers](inquiry-handlers/knowledge.md)

**inScope**  
Gate ① rebac scope check in deliver; a pass-through stub today (COMM-005). *Region:* [Email delivery and preferences](email-delivery/knowledge.md)

**inStreamOrder**  
Per-stream in-process serialized queue for WebSocket publish ordering. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**Integration**  
A named provider connection owned by a user, organization, OrganizationUser, space or SpaceUser. *Region:* [Adapters, integrations and storage](adapters-integrations/knowledge.md)

**IntegrationRecord**  
Links an Integration to a synced CustomerRef, with poisonedAt for repeated rejections. *Region:* [Adapters, integrations and storage](adapters-integrations/knowledge.md)

**integrations**  
Class: owner Integrations (provider connections) and the IntegrationRecords they sync. *Region:* [Adapters, integrations and storage](adapters-integrations/knowledge.md)

**internal verb owner**  
The single module allowed to implement an internal verb (traverse, own, scope, walk, dateExpr, operatorCatalog…), enforced by test/verbs.test.ts. *Region:* [json-rules dates, windows and verbs](json-rules-dates/knowledge.md)

**interpolate**  
Phase 2 per recipient: evaluate conditions and substitute tokens, narrowed to the lens, reporting issues to a sink. *Region:* [Email compose, render and save](email-render/knowledge.md)

**interpolation**  
<<roundIndex.requestIndex.bodyPath>> in a later round's path, body or headers, resolved from an earlier response. *Region:* [Batch API](batch/knowledge.md)

**Interrogate before proposing**  
ENTRYPOINT §0.4: for shape-finding work, ask and surface forks before a closed proposal. *Region:* [Engineering process and docs](engineering-process-docs/knowledge.md)

**intersectEntitlements**  
Keeps only entitlement keys true in both the membership and the token. *Region:* [Roles, actions and permission checks](permissions-roles/knowledge.md)

**isComplete**  
init/utils/progressTracking.ts check for a finished step (the doc calls it isProgressComplete). *Region:* [Init script architecture and direction](init-architecture/knowledge.md)

**isEmailContentError**  
Tells content errors (render, parse, MJML, token, condition) apart so they fail without retry. *Region:* [Email delivery and preferences](email-delivery/knowledge.md)

**isNoOpUpdate**  
Shared no-op detection: an update touching only ignored fields skips cache clearing. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**isNoOpUpdate / NOOP_FIELDS / HOOK_IGNORE_FIELDS**  
Shared registry of noise fields (updatedAt, lastLoginAt, positions) whose change alone is a no-op for audit, cache and webhooks. *Region:* [Mutation hooks, immutable fields, ordered lists](mutation-hooks/knowledge.md)

**isRequired**  
FieldMapEntry nullability; isRequired: false licenses toPrisma to add NULL and to-one hop arms. *Region:* [Compiling rules to Prisma and SQL](json-rules-backends/knowledge.md)

**isSerializable**  
Tells whether a transition uses only keyword merge strategies. *Region:* [Transitions library (lifecycle guards)](lib-transitions/knowledge.md)

**isSuperadmin**  
Inline check that the context user has the superadmin platform role. *Region:* [Tenancy and Superadmin](tenancy/knowledge.md)

**isTerminalInquiry**  
Frontend terminal check that also treats a past expiresAt as terminal. *Region:* [Inquiry API and frontend](inquiry-routes-ui/knowledge.md)

**isTest / isLocal / isPR / isStaging / isProd**  
Flags from packages/shared/src/utils/env.ts, one per Environment value. *Region:* [Environments, env vars and deploy](environments-deploy/knowledge.md)

**isUniqueConstraintError / isWriteConflictError**  
Detect Prisma P2002 duplicate keys vs P2034 write conflicts/deadlocks. *Region:* [Request context and errors](request-context-errors/knowledge.md)

## J

**job-lanes**  
Class: fast/slow lanes via withLanePriority, the slow slot share and the lane-divided depth budget. *Region:* [Job lanes and overflow outbox](job-lanes-outbox/knowledge.md)

**job-outbox**  
Class: the JobOutbox overflow buffer and its spill, accumulator and drain loop. *Region:* [Job lanes and overflow outbox](job-lanes-outbox/knowledge.md)

**jobAuditActor**  
The audit actor a background job writes under (the job and its integration), set around processJob. *Region:* [Audit log and soft delete](audit-soft-delete/knowledge.md)

**JobData.lane**  
The lane field on the envelope; the worker reads only this, and a missing lane means fast. *Region:* [Job lanes and overflow outbox](job-lanes-outbox/knowledge.md)

**jobHandlers**  
The job registry the messaging jobs are not yet registered in. *Region:* [Messaging and contacts](messaging-contacts/knowledge.md)

**JobLane**  
fast or slow; a label on the job envelope (JobData.lane), defaulting to fast. *Region:* [Job lanes and overflow outbox](job-lanes-outbox/knowledge.md)

**JobOutbox**  
DB table holding spilled adhoc job intent (handlerName, jobId, dedupeKey, lane, data, options, attempts). *Region:* [Job lanes and overflow outbox](job-lanes-outbox/knowledge.md)

**jobs**  
Class: BullMQ background jobs, i.e. the makeJob wrappers, handler registry, enqueueJob and the worker. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**jobs.slow.idle_ms**  
Gauge of how long slow work has been queued without a slow job finishing; climbing means a stuck lane. *Region:* [Job lanes and overflow outbox](job-lanes-outbox/knowledge.md)

**JOBS_MAX_QUEUE_DEPTH**  
Shared depth budget (default 10000) that trips overflow; low-water is 0.8 of it. *Region:* [Job lanes and overflow outbox](job-lanes-outbox/knowledge.md)

**JOBS_SLOW_QUEUE_DEPTH_FRACTION**  
Share of the depth budget slow jobs may fill before spilling. *Region:* [Job lanes and overflow outbox](job-lanes-outbox/knowledge.md)

**JobType**  
adhoc (one-off), cron (repeater) or cronTrigger (manual cron run). *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**Json boundary**  
Path resolution stops at a visible Json column; sub-paths below it are accepted and compared untyped. *Region:* [Using a lens: build, gate, fetch](lens-usage/knowledge.md)

**json-rules**  
Class tag: the @inixiative/json-rules engine as the template calls it — the shared gate, binding, email rule scoping, RulesRegistry. *Region:* [Template rules and rule references](json-rules/knowledge.md)

**json-rules-runtime**  
Class tag: running, validating, binding and typing rules. *Region:* [Running, validating and typing rules](json-rules-runtime/knowledge.md)

**json-rules-shapes**  
Class tag: the rule shapes, operators, paths and dates a rule is written with. *Region:* [Writing a json-rules rule](json-rules-shapes/knowledge.md)

## K

**Keep Docs Honest**  
Remove outdated information, mark stubs, never document aspirational features as existing. *Region:* [Engineering process and docs](engineering-process-docs/knowledge.md)

**keepClampColumns**  
projectRows option keeping hidden clamp columns for an in-memory re-check; never returned to a viewer. *Region:* [Using a lens: build, gate, fetch](lens-usage/knowledge.md)

**keyHash**  
SHA-256 hash of an API key; the plaintext is shown once at creation and never stored. *Region:* [Authentication: sessions, providers, tokens](authentication/knowledge.md)

**keyof typeof**  
Derive a union type from a const object so values live in one place. *Region:* [Naming and code style](conventions/knowledge.md)

**Keyring**  
One envPrefix's current key, optional previous key and integer version, read from env. *Region:* [Encryption and secrets](encryption/knowledge.md)

**keyset cursor**  
An opaque cursor packing sort chain, last-row values and filter hash (encodeCursor / decodeCursor / buildKeysetWhere). *Region:* [Offset and cursor pagination](pagination/knowledge.md)

**@kind**  
The file's role(s) from the closed kinds vocab (controller, route, entrypoint); never a layer. *Region:* [Atlas code map (library + template usage)](lib-atlas/knowledge.md)

**kind**  
How a stream folds and which ops it accepts: list (upsert, remove) or log (append). *Region:* [WebSocket data streams](ws-data-streams/knowledge.md)

**KINDS**  
The template's @kind vocabulary in .atlas/kinds.ts: [...DEFAULT_KINDS], extendable. *Region:* [Atlas code map (library + template usage)](lib-atlas/knowledge.md)

## L

**label / groupBy**  
A source's display column and grouping axes; a dotted one crosses only relations shown. *Region:* [Lens option sources and bridges](lens-sources/knowledge.md)

**lane**  
A release cascade with its own blessed set: primitives first, agentic built on it. *Region:* [Config package (toolchain, train)](lib-config/knowledge.md)

**laneKey**  
Builds the lane key from (handlerName, dedupeKey). *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**LaunchView / launch.ts**  
Launch preflight and confirmation that sets the launched flag; TUI-only today. *Region:* [Init script architecture and direction](init-architecture/knowledge.md)

**Layers only get darker**  
Each layer may only narrow what the layers above show, so adding a layer can only take away. *Region:* [The lens model](lens-model/knowledge.md)

**LeafNode**  
A scalar field condition row; exposes valid plus field.valid / value.valid and its reachable scopes. *Region:* [rules-builder library README](lib-rules-builder/knowledge.md)

**LeafNode**  
A scalar field condition row; exposes valid plus field.valid / value.valid and its reachable scopes. *Region:* [Rule builder: template usage](rules-builder/knowledge.md)

**leave**  
Self action ({ self: 'userId' }) letting a user remove their own membership or token. *Region:* [Roles, actions and permission checks](permissions-roles/knowledge.md)

**lefthook**  
Pre-commit hooks from @inixiative/config/lefthook/base.yml running typecheck and Biome on staged files. *Region:* [Scripts, lint and build tooling](dx-tools/knowledge.md)

**Lens**  
A FieldMapSet anchored at (mapName, model); schema only, no data. *Region:* [The lens model](lens-model/knowledge.md)

**Lens**  
A FieldMapSet anchored at (mapName, model); schema only. The lens-model region defines it. *Region:* [Template lenses](lenses/knowledge.md)

**{ lens } compile**  
toPrisma / toSql with { lens }: gate, narrow and compile against the base lens; never combined with map / model. *Region:* [Compiling rules to Prisma and SQL](json-rules-backends/knowledge.md)

**{ lens } compile**  
toPrisma(rule, { lens }) / toSql(rule, { lens }): gate, narrow and compile in one call; never combined with map / model. *Region:* [Using a lens: build, gate, fetch](lens-usage/knowledge.md)

**lenses**  
Class tag: the template's lenses and narrowings over data — lensFor, composeLens, filterLens, scopeNarrowing and the lens builders. *Region:* [Template lenses](lenses/knowledge.md)

**lensFor**  
A base lens over a Prisma model's columns from the schema map; the start point for route filter lenses. *Region:* [Template lenses](lenses/knowledge.md)

**lensFromOperation**  
Derive a frontend filter lens from an OpenAPI operationId; lensFromSchema takes a raw schema. *Region:* [Template lenses](lenses/knowledge.md)

**LensNarrowing**  
A layer with a parent (a Lens or another narrowing), a root ModelNarrowing and per-map mapDefaults; it only narrows. *Region:* [The lens model](lens-model/knowledge.md)

**LensNarrowing**  
A layer over a parent lens that can only narrow; the lens-model region defines it. *Region:* [Template lenses](lenses/knowledge.md)

**lensPathFields**  
The template's walkLensPath variant returning only the field entries along a path. *Region:* [Template lenses](lenses/knowledge.md)

**LensRefusal**  
What the lens itself cannot do (a clamp a later layer may not read, a source a compile can't hold); carries a `code`. *Region:* [json-rules dates, windows and verbs](json-rules-dates/knowledge.md)

**LensRefusal**  
Thrown when the lens itself cannot do something; carries a code. *Region:* [Running, validating and typing rules](json-rules-runtime/knowledge.md)

**LensRefusal**  
What every runtime posture throws for what the lens itself cannot do; validateNarrowing reports the same refusal. *Region:* [The lens model](lens-model/knowledge.md)

**LensScope**  
The scope a lens binds rule conditions to; lensScopeSurface lists its values and to-many loop portals. *Region:* [Rule builder: template usage](rules-builder/knowledge.md)

**lensVisit**  
One visit as projectLens would give it, resolved on demand at a relation path; null when not shown. *Region:* [Using a lens: build, gate, fetch](lens-usage/knowledge.md)

**lensWhere**  
Folds a lens's non-root narrowing clauses into a composed Prisma where across relations. *Region:* [Template lenses](lenses/knowledge.md)

**lib-atlas**  
The @inixiative/atlas library: the code-map CLI, annotation model and .atlas/ config. *Region:* [Atlas code map (library + template usage)](lib-atlas/knowledge.md)

**lib-ci.yml**  
inixiative/config's shared CI workflow that ecosystem library repos call: pinned bun, frozen install, config check, repo check. *Region:* [Environments, env vars and deploy](environments-deploy/knowledge.md)

**lib-ci.yml**  
The shared reusable CI workflow: bun from .bun-version, frozen-lockfile install, config check, bun run check. *Region:* [Config package (toolchain, train)](lib-config/knowledge.md)

**lib-config**  
The @inixiative/config package: shared toolchain presets, versions.json, ports.json, and the check / sync / scan / train / ports CLI. *Region:* [Config package (toolchain, train)](lib-config/knowledge.md)

**lib-gloss**  
The @inixiative/gloss library: margin commentary in a mirrored .gloss/ tree instead of in source. *Region:* [Gloss (margin comments)](lib-gloss/knowledge.md)

**lib-json-rules-backends**  
Class tag: compiling rules to backends — Prisma query planning, PostgreSQL SQL generation, the backend support matrix. *Region:* [Compiling rules to Prisma and SQL](json-rules-backends/knowledge.md)

**lib-json-rules-dates**  
Class tag: date, window and verb semantics of @inixiative/json-rules (VERBS.md, TIMEZONE.md). *Region:* [json-rules dates, windows and verbs](json-rules-dates/knowledge.md)

**lib-json-rules-lens**  
Class tag: the json-rules Lens model — why lenses exist, two kinds of narrowing, anchor layers, filter-first, composition, defaults, enum narrowing, the type shape (LENS.md §1–8). *Region:* [The lens model](lens-model/knowledge.md)

**lib-json-rules-lens-sources**  
Class tag: multi-source data under a lens — option sources, source queries, bridged sources and evaluating across bridges. *Region:* [Lens option sources and bridges](lens-sources/knowledge.md)

**lib-json-rules-lens-usage**  
Class tag: building and using a lens — validate, narrowRule, projectLens, walkLensPath, fetching rows under a lens, describe-and-validate vs deny, migration, worked example. *Region:* [Using a lens: build, gate, fetch](lens-usage/knowledge.md)

**lib-permissions**  
The @inixiative/permissions-roles / permissions-rebac library: permix wrapper plus the ReBAC check engine the template's permissions-roles / permissions-rebac build on. *Region:* [Permissions library (ReBAC engine)](lib-permissions/knowledge.md)

**lib-prisma-map**  
The @inixiative/prisma-map library: runtime Prisma schema maps and DB name resolution. *Region:* [Prisma-map and schema introspection](lib-prisma-map/knowledge.md)

**lib-rules-builder**  
Class tag: the rules-builder library itself — quick start, sourced fields, collection filtering, array rules, decoration, serialization, API (README). *Region:* [rules-builder library README](lib-rules-builder/knowledge.md)

**lib-transitions**  
The @inixiative/transitions library: stateless lifecycle guard and affordance layer over json-rules. *Region:* [Transitions library (lifecycle guards)](lib-transitions/knowledge.md)

**lint-rules**  
Class: Biome, custom lint scripts and the CI rule runner that enforce style. *Region:* [Scripts, lint and build tooling](dx-tools/knowledge.md)

**List page shape**  
Page with a create action, a Table, and optimistic create and delete: the one shape every list page follows. *Region:* [UI components and shared pages](ui-components/knowledge.md)

**List state persistence**  
readInitialState / writeToHistoryState / writeToHistoryStateAndUrl keep list state in history.state, or the URL when shareable. *Region:* [API client, SDK and query hooks](api-client/knowledge.md)

**List state persistence**  
page, pageSize, search, orderBy and scroll position kept in history.state per view key (data:<id>, scroll:<id>). *Region:* [Offset and cursor pagination](pagination/knowledge.md)

**listBindings**  
The bind names a rule reads, sorted; { required: true } drops optional ones. *Region:* [Running, validating and typing rules](json-rules-runtime/knowledge.md)

**listBindings**  
The bind names one rule reads; listLensBindings covers a lens chain. *Region:* [Lens option sources and bridges](lens-sources/knowledge.md)

**[:] literal segment**  
Bracket marker passing a real null, true or false instead of a string. *Region:* [List filtering and search](filtering-search/knowledge.md)

**LIVE_QUERIES**  
Derived from WS_CHANNELS; gates which mounted queries subscribe over the socket. *Region:* [WebSocket channels and refetch hints](ws-channels/knowledge.md)

**liveWhere / liveIncludes**  
Helpers that add the deletedAt: null scope to a where or include built by hand. *Region:* [Audit log and soft delete](audit-soft-delete/knowledge.md)

***Local senders**  
sendToChannelLocal, sendToUserLocal, sendToStreamLocal, broadcastLocal, sendTo: delivery on this instance only. *Region:* [WebSocket connections](ws-connections/knowledge.md)

**lockedTargetStates**  
Locks the rows a rule references (in model-name order) and reads their state inside the transaction. *Region:* [Template rules and rule references](json-rules/knowledge.md)

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

**LoginForm**  
Login form with provider buttons and email fields; LoginPage wraps it. *Region:* [Frontend Authentication](frontend-auth/knowledge.md)

**logScope / LogScope**  
Display-only scope prefix; LogScope.worker etc. are the predefined scopes. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**loop portal**  
A to-many relation exposed by a scope surface as an entry into a nested element scope. *Region:* [rules-builder library README](lib-rules-builder/knowledge.md)

**lua-in-queries**  
CI rule: each Redis Lua script lives with its eval function in the module's queries/ folder. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

## M

**machine directive**  
Comments read by tools (biome-ignore, @ts-expect-error, shebangs, license headers); stay inline. *Region:* [Gloss (margin comments)](lib-gloss/knowledge.md)

**make* / validate***  
Prefixes for factories and currying (makeController) and for middleware guards (not require*). *Region:* [Naming and code style](conventions/knowledge.md)

**makeAdapterRegistry**  
Select one adapter implementation by key, as opposed to by environment (router) or all at once (broadcast). *Region:* [Adapters, integrations and storage](adapters-integrations/knowledge.md)

**makeAdapterRouter**  
Picks the provider for process.env.ENVIRONMENT with a default; the standard adapter wrapper. *Region:* [Adapters, integrations and storage](adapters-integrations/knowledge.md)

**makeAppEvent**  
Defines an event handler { email, websocket, cb } whose tasks run isolated with allSettled and aggregated failures. *Region:* [App events and webhooks](app-events-webhooks/knowledge.md)

**makeBroadcastRegistry**  
Registers providers by name and runs an operation on all of them via Promise.allSettled. *Region:* [Adapters, integrations and storage](adapters-integrations/knowledge.md)

**makeContextQueries**  
Maps user/organization/space contexts to one query each for a list shown in several contexts; missing context throws. *Region:* [API client, SDK and query hooks](api-client/knowledge.md)

**makeController**  
Binds a handler to a route, exposing only the responders the route declares and validating the response payload. *Region:* [API routes, controllers and modules](api-routes/knowledge.md)

**makeError**  
Factory for a throwable AppError with status, message, guidance and fieldErrors; apps/api only. *Region:* [Request context and errors](request-context-errors/knowledge.md)

**makeJob**  
Basic typed job wrapper; with stages it becomes a staged fan-out-and-wait job. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**makeSingletonJob**  
Job wrapper that takes a createLock before running so only one run happens at a time across workers. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**makeSingletonJob**  
Wrapper whose Redis lock (5 min TTL, 1 min heartbeat) lets only one run execute at a time. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**makeSupersedingJob**  
Job wrapper where a newer job with the same dedupe key supersedes older runs. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**makeSupersedingJob**  
Wrapper where a newer job with the same dedupe key supersedes the older one via ctx.signal; cooperative, does not kill. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**makeUnrefInterval**  
Recurring in-process tick that starts once, stops cleanly and never blocks exit. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**Mandatory task intake**  
ENTRYPOINT §1: restate mode, scope, goal, non-goals, pattern, abstractions, validation, stop condition. *Region:* [Engineering process and docs](engineering-process-docs/knowledge.md)

**MAP.md**  
The generated concept overview; a projection of the code, never hand-edited. *Region:* [Atlas code map (library + template usage)](lib-atlas/knowledge.md)

**mapDefaults**  
Per-map narrowing applied wherever a model or enum appears: the home of 'everywhere' clamps such as soft delete. *Region:* [The lens model](lens-model/knowledge.md)

**mapDefaults**  
Per-map narrowing applied wherever a model appears; what redactLens and omitForeignKeys ride. *Region:* [Template lenses](lenses/knowledge.md)

**mapName**  
Names which map of a FieldMapSet or lens to compile against; a set without it throws. *Region:* [Compiling rules to Prisma and SQL](json-rules-backends/knowledge.md)

**mapRefs**  
Extracts component blocks from MJML, deduplicating identical variants and indexing different ones (:0, :1). *Region:* [Email compose, render and save](email-render/knowledge.md)

**markComplete**  
Persists a named provider step as done in project config progress. *Region:* [Init script architecture and direction](init-architecture/knowledge.md)

**markComplete**  
Persists a named provider step as done in project config progress. *Region:* [Writing an init task](init-tasks/knowledge.md)

**matchFacet / presetSeed**  
Recognize which facet a saved node matches (rehydration) / insert a preset node with each slot's default. *Region:* [Rule builder: template usage](rules-builder/knowledge.md)

**materializeSourceQuery**  
Turn one source query's fetched rows into option values; with { lens } re-checks bridged candidates. *Region:* [Lens option sources and bridges](lens-sources/knowledge.md)

**materializeSources**  
Compute every sourced field options in memory from rows already fetched under the lens. *Region:* [Lens option sources and bridges](lens-sources/knowledge.md)

**--max-concurrency=1**  
Required for DB-backed test scripts so files don't truncate each other's tables. *Region:* [Test factories, cleanup and test rules](test-factories-rules/knowledge.md)

**--max-concurrency=1**  
Required for DB-backed test scripts so files don't truncate each other's tables. *Region:* [Test harness, request helpers and VCR](test-harness/knowledge.md)

**merge**  
to.merge strategy producing the resulting record: spread (default), deepMerge, append, appendUnique, or a callback. *Region:* [Transitions library (lifecycle guards)](lib-transitions/knowledge.md)

**messageContact**  
Messaging job: pre-rendered content to one Contact after canDeliver. *Region:* [Messaging and contacts](messaging-contacts/knowledge.md)

**MessageContent**  
{ text?, html?, mediaUrls?, data? }; text and html may hold recipient/data/sender tokens interpolated before dispatch. *Region:* [Messaging and contacts](messaging-contacts/knowledge.md)

**MessageProviderAdapter**  
(contact, content, kind, options) => Promise<void>: the per-ContactType channel sender. *Region:* [Messaging and contacts](messaging-contacts/knowledge.md)

**messageProviderRegistry**  
Broadcast registry of adapters keyed by ContactType; getMessageProviderAdapter reads it. *Region:* [Messaging and contacts](messaging-contacts/knowledge.md)

**messageUser**  
Messaging job: users matched by a json-rules rule through the sender's recipient lens, rendered and sent to each accepting contact. *Region:* [Messaging and contacts](messaging-contacts/knowledge.md)

**messaging**  
Class: non-email channels dispatched through per-ContactType message provider adapters. *Region:* [Messaging and contacts](messaging-contacts/knowledge.md)

**migration (3.0 / 3.4)**  
3.4: relations off until turned on, context replaced by binds; 3.0: applyLens → narrowRule, checkRuleAgainstLens → validateRuleInLens. *Region:* [Using a lens: build, gate, fetch](lens-usage/knowledge.md)

**MinIO**  
Local S3 container with ephemeral buckets: minio-init.sh creates the base buckets, minio-provision.sh adds per-slot ones. *Region:* [Dev setup and worktrees](dx-setup/knowledge.md)

**Modal**  
Dialog with size and dismissOnBackdrop; its close button continues an active flow. *Region:* [Layout system and theme](theme-layout/knowledge.md)

**model-default tree**  
mapDefaults relation turn-ons followed breadth-first from each spelled node, each model once at its nearest reach. *Region:* [The lens model](lens-model/knowledge.md)

**<Model>ScalarSchema**  
Generated zod schema of a Prisma model's scalar fields from @template/db; the default response schema. *Region:* [Request schemas and OpenAPI](api-schemas-openapi/knowledge.md)

**ModelField**  
Union of ScalarField, EnumField and RelationField; narrow before resolving names. *Region:* [Prisma-map and schema introspection](lib-prisma-map/knowledge.md)

**modelFields / lookupField**  
A model's whole field map, versus one field resolved by dotted path across relations. *Region:* [Prisma-map and schema introspection](lib-prisma-map/knowledge.md)

**ModelNames / AccessorNames**  
PascalCase model names (`User`) versus camelCase client accessors (`user`), each with a list, an is* guard and a to* converter. *Region:* [Prisma-map and schema introspection](lib-prisma-map/knowledge.md)

**ModelNarrowing**  
Narrowing for a model at one traversal path: picks, omits, enum picks, where, sources, relations. *Region:* [The lens model](lens-model/knowledge.md)

**Modular Prisma schema**  
packages/db/prisma/schema/ with one .prisma file per model, concatenated before generation. *Region:* [Monorepo layout and architecture](monorepo-architecture/knowledge.md)

**Modules**  
Type-safe registry of model names used as route-template model/submodel values. *Region:* [API routes, controllers and modules](api-routes/knowledge.md)

**monorepo-layout**  
Class: workspaces, packages, path aliases, import direction, where things live. *Region:* [Monorepo layout and architecture](monorepo-architecture/knowledge.md)

**Mutation lifecycle**  
Hook stage between controllers and the DB: rules, immutable fields, cache, webhooks. *Region:* [Monorepo layout and architecture](monorepo-architecture/knowledge.md)

**mutation-hooks**  
Class: the hook registry and mutationLifeCycle extension, hook-safe bulk writes and model write rules. *Region:* [Mutation hooks, immutable fields, ordered lists](mutation-hooks/knowledge.md)

**mutationLifeCycle**  
The Prisma extension that wraps every mutation in a transaction and runs before/after hooks. *Region:* [Database client and transactions](database-client/knowledge.md)

**mutationLifeCycle**  
Prisma extension wrapping every mutation in a transaction with before/after hooks and `previous`. *Region:* [Mutation hooks, immutable fields, ordered lists](mutation-hooks/knowledge.md)

## N

**naive value**  
A date-only or zoneless datetime string; anchored in the evaluation's timezone (date-only becomes midnight there). *Region:* [json-rules dates, windows and verbs](json-rules-dates/knowledge.md)

**_name / __name**  
Single underscore = unused binding; double underscore = private/internal (class members, brands, module state). *Region:* [Naming and code style](conventions/knowledge.md)

**naming**  
Class: naming conventions for identifiers, files, routes, schema names, polymorphic side names, vocabulary. *Region:* [Naming and code style](conventions/knowledge.md)

**Narrow selector**  
useAppStore(s => s.tenant.organizationId): select the smallest value a component needs so it re-renders only on that change. *Region:* [Frontend store (Zustand slices)](frontend-store/knowledge.md)

**narrowRule**  
Compose a gated rule with the lens clamps at their anchors before executing it. *Region:* [Using a lens: build, gate, fetch](lens-usage/knowledge.md)

**narrowToElements**  
Pins each looped collection in scope to the element being rendered. *Region:* [Template rules and rule references](json-rules/knowledge.md)

**narrowVariables / prune**  
Render-time projection: drops hidden list elements and nulls hidden relations and roots before tokens read them. *Region:* [The email lens](email-lens/knowledge.md)

**NavConfig**  
Per-app map of context type (user, organization, space, public) to NavItem[]. *Region:* [Navigation config and tenant context](navigation/knowledge.md)

**navigatePreserving**  
Imperative navigation keeping context ('context'), spoof ('spoof') or every param ('all'). *Region:* [Frontend Authentication](frontend-auth/knowledge.md)

**navigatePreserving**  
navigation slice call: navigate keeping 'context' (org/space+spoof+flow), 'spoof' (spoof+flow) or 'all' params. *Region:* [Navigation config and tenant context](navigation/knowledge.md)

**navigation**  
Class: nav config, permission-gated items, tenant context switching and URL context. *Region:* [Navigation config and tenant context](navigation/knowledge.md)

**NavigationSlice**  
Stored router navigate, navConfig, currentRouteMatch, flowId and navigatePreserving. *Region:* [Frontend store (Zustand slices)](frontend-store/knowledge.md)

**NavItem**  
label, path, icon, title, description, access, alias, breadcrumbLabel, items. *Region:* [Navigation config and tenant context](navigation/knowledge.md)

**negated date operators**  
`notBetween`, `dayNotIn` and other negations match NULL columns on every rail; positive operators don't. *Region:* [json-rules dates, windows and verbs](json-rules-dates/knowledge.md)

**negative caching**  
Caching a null/undefined result briefly (1 minute) to stop thundering herds. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**nextCursor / hasMore**  
The cursorPaginate response fields a client uses to ask for the next page. *Region:* [Offset and cursor pagination](pagination/knowledge.md)

**No comments**  
Hard rule: code self-documents; only the @atlas block and a rare one-line non-obvious why. *Region:* [Naming and code style](conventions/knowledge.md)

**No TS enum**  
Use an `as const` object or a Prisma enum instead of the enum keyword. *Region:* [Naming and code style](conventions/knowledge.md)

**no-create-race-machinery**  
CI rule that fails a change adding a bare .upsert( or a unique-violation catch. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**no-create-race-machinery**  
CI rule: blocks new bare `.upsert(` and unique-violation catches; use db.findForUpdate with `upserting: true`. *Region:* [Database client and transactions](database-client/knowledge.md)

**no-inline-env-coercion**  
CI rule forbidding casting or defaulting process.env outside the central env schema. *Region:* [Environments, env vars and deploy](environments-deploy/knowledge.md)

**no-lens-spread**  
CI rule (scripts/ci/rules/no-lens-spread.sh) forbidding spreading lens objects. *Region:* [Template lenses](lenses/knowledge.md)

**no-module-mocks**  
CI rule: no mock.module or fake provider clients in tests; record the real provider with VCR instead. *Region:* [Test factories, cleanup and test rules](test-factories-rules/knowledge.md)

**no-prisma-maps**  
CI rule banning field @map and model @@map so Prisma names equal DB identifiers. *Region:* [Naming and code style](conventions/knowledge.md)

**no-prisma-maps**  
Template CI rule banning field @map and model @@map, so Prisma names equal DB identifiers. *Region:* [Prisma-map and schema introspection](lib-prisma-map/knowledge.md)

**no-radix**  
CI rule forbidding Radix UI imports (menus/selects use Ariakit). *Region:* [UI components and shared pages](ui-components/knowledge.md)

**no-raw-transaction**  
CI rule: `$transaction` is allowed only in packages/db/src/client.ts; use db.txn. *Region:* [Database client and transactions](database-client/knowledge.md)

**node**  
tsup preset for Node/server packages: `export default node({ entry })`. *Region:* [Config package (toolchain, train)](lib-config/knowledge.md)

**normalizeEmail**  
Lowercases and trims an email before storing or comparing. *Region:* [Auth middleware, validators and users](auth-middleware-users/knowledge.md)

**normalizeGroups**  
Converts stored conditions and filters into the builder's group shape when reading a template back. *Region:* [rules-builder library README](lib-rules-builder/knowledge.md)

**now**  
The instant a relative date expression is evaluated against; an option the caller must pass, with no wall-clock fallback. *Region:* [json-rules dates, windows and verbs](json-rules-dates/knowledge.md)

**now contract**  
now is an explicit evaluator input; check / toPrisma / toSql throw on a relative expression without it. *Region:* [Writing a json-rules rule](json-rules-shapes/knowledge.md)

**NULL arm**  
The explicit `OR col IS NULL` / `{ equals: null }` a compiler adds so a negation matches NULL as check() does. *Region:* [Compiling rules to Prisma and SQL](json-rules-backends/knowledge.md)

**NULL semantics**  
Negations and notBefore / notAfter / notWithin / notBetween / dayNotIn match NULL; positive operators never do. *Region:* [Writing a json-rules rule](json-rules-shapes/knowledge.md)

## O

**oauthHandoffPlugins**  
BetterAuth plugins that mint the one-time token and move it onto the callback as #ott. *Region:* [Authentication: sessions, providers, tokens](authentication/knowledge.md)

**object-storage**  
Class: the env-routed S3 storage client behind the storage adapter, and its buckets. *Region:* [Adapters, integrations and storage](adapters-integrations/knowledge.md)

**observeRegistry**  
Broadcasts every envelope to the structured log and database-client / data-modeling adapters; best-effort, not a retry queue; no per-handler observe selector. *Region:* [App events and webhooks](app-events-webhooks/knowledge.md)

**offset**  
A value source ({ value }, { path }, { bind }) that moves the comparison value: a number, or a rolling date shift. *Region:* [Writing a json-rules rule](json-rules-shapes/knowledge.md)

**omitForeignKeys**  
mapDefaults wrapper that omits every FK column prismaMap knows, so references go by id. *Region:* [Template lenses](lenses/knowledge.md)

**One rule AST, three targets**  
The same Condition runs in memory (check), as a Prisma where (toPrisma) and as SQL (toSql). *Region:* [Writing a json-rules rule](json-rules-shapes/knowledge.md)

**One-time token (ott)**  
Single-use, 1-minute token in the OAuth callback fragment, verified atomically via Redis GETDEL. *Region:* [Authentication: sessions, providers, tokens](authentication/knowledge.md)

**onIssue**  
Registry render policy: platform (default, unbranded fallback), fail (retry then DLQ), or degrade (send with empty blocks). *Region:* [Email compose, render and save](email-render/knowledge.md)

**onLockLost**  
createLock callback fired when the lease is lost so the holder can stop its critical work. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**onShutdown**  
Registers a cleanup handler for graceful shutdown. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**onStepComplete**  
Callback a task awaits after each step; the TUI passes syncConfig, init:agent passes a logger. *Region:* [Init script architecture and direction](init-architecture/knowledge.md)

**OPAQUE_SLOT**  
The opaque data bag, addressable at any depth as beneath-Json. *Region:* [The email lens](email-lens/knowledge.md)

**opaqueLoopIssue**  
Refuses a rule inside a loop over opaque data that reads a lens-backed root, at save and render. *Region:* [The email lens](email-lens/knowledge.md)

**openapi**  
Class: file-based route registration and OpenAPI 3.1 spec generation from the route definitions. *Region:* [Request schemas and OpenAPI](api-schemas-openapi/knowledge.md)

**OpenAPIHono**  
The Hono router class every module router (userRouter, adminUserRouter) is an instance of. *Region:* [Request schemas and OpenAPI](api-schemas-openapi/knowledge.md)

**openDataStream**  
Resolves the stream route, reads the seq, runs the route in-process for the snapshot and subscribes the socket; closeDataStream ends it. *Region:* [WebSocket data streams](ws-data-streams/knowledge.md)

**operationId**  
Generated name in the resourceActionSubresource pattern (userCreate, organizationReadManySpaces, adminOrganizationReadMany). *Region:* [API routes, controllers and modules](api-routes/knowledge.md)

**operator catalog**  
getOperatorsForKind, getArrayOperators, getAggregateOperators, getValueShape and the FieldKind / RuleTarget / ValueShape constants. *Region:* [Running, validating and typing rules](json-rules-runtime/knowledge.md)

**operator catalog**  
getOperatorsForKind, getArrayOperators, getAggregateOperators, getValueShape and the FieldKind / RuleTarget / ValueShape constants. *Region:* [Writing a json-rules rule](json-rules-shapes/knowledge.md)

**orderBy**  
?orderBy[]=field:direction sort parameter, auto-injected as an enum for lens routes. *Region:* [List filtering and search](filtering-search/knowledge.md)

**orderByRequestSchema / parseOrderBy**  
The manual orderBy query schema and parser for a route without a filterLens. *Region:* [List filtering and search](filtering-search/knowledge.md)

**ordered-lists**  
Class: dense 1..N position columns kept by the orderedList hook from orderedListRegistry. *Region:* [Mutation hooks, immutable fields, ordered lists](mutation-hooks/knowledge.md)

**orderedListRegistry**  
Declares a model's ordered field and the scope keys partitioning it into independent lists. *Region:* [Mutation hooks, immutable fields, ordered lists](mutation-hooks/knowledge.md)

**ordering**  
List-stream upsert precedence: 'updatedAt' (default, newer wins) or 'arrival' (last to arrive wins, for rows with no version). *Region:* [WebSocket data streams](ws-data-streams/knowledge.md)

**Organization**  
Top-level tenant, fully isolated from other organizations. *Region:* [Tenancy and Superadmin](tenancy/knowledge.md)

**OrganizationUser**  
A user's membership in one organization, with role and entitlements. *Region:* [Tenancy and Superadmin](tenancy/knowledge.md)

**organize by domain**  
Components go in the folder of the domain that uses them (settings/CreateTokenModal), not components/modals/. *Region:* [UI components and shared pages](ui-components/knowledge.md)

**OrgSelector**  
Reusable org/workspace picker component; its onCancel prop is required. *Region:* [Writing an init task](init-tasks/knowledge.md)

**OTEL_SERVICE_NAME**  
Base service name; processes append -api, -worker, -web, -admin, -superadmin. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**OTLP**  
OpenTelemetry protocol; OTEL_EXPORTER_OTLP_ENDPOINT base URL, per-signal endpoints are complete URLs. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**Overflow flag**  
Per-lane Redis key (job:overflow, job:overflow:slow) set NX with a drain-renewed TTL. *Region:* [Job lanes and overflow outbox](job-lanes-outbox/knowledge.md)

**own-property read**  
Field maps, paths and bindings are read with own-property checks only (own.ts, scope.ts, Object.hasOwn), never `key in`. *Region:* [json-rules dates, windows and verbs](json-rules-dates/knowledge.md)

**ownerActions**  
Generates own/manage/operate/read fan-out across user, organization and space owner FKs. *Region:* [ReBAC, owner-polymorphic and row permissions](permissions-rebac/knowledge.md)

**ownership closure**  
Every FK-backed to-one relation reachable from a record, loaded so a missing relation can only mean a null FK. *Region:* [Permissions library (ReBAC engine)](lib-permissions/knowledge.md)

## P

**Page**  
Standard page body: title, description?, actions?, children. *Region:* [Layout system and theme](theme-layout/knowledge.md)

**page / pageSize**  
Offset query params; defaults page=1, pageSize=10, max 10000. *Region:* [Offset and cursor pagination](pagination/knowledge.md)

**paginate**  
Offset pagination helper: reads query, bracket search and filterLens from context, returns data plus page/pageSize/total/totalPages. *Region:* [Offset and cursor pagination](pagination/knowledge.md)

**paginate: true**  
The readRoute flag that wires paginate() and the pagination schemas for a list route. *Region:* [Offset and cursor pagination](pagination/knowledge.md)

**paginateRequestSchema / cursorPaginateRequestSchema**  
The query schemas for offset (page, pageSize) and cursor (cursor, limit) list routes. *Region:* [Offset and cursor pagination](pagination/knowledge.md)

**pagination**  
Offset and cursor pagination: paginate(), cursorPaginate(), response metadata and the frontend pagination hooks. *Region:* [Offset and cursor pagination](pagination/knowledge.md)

**Pagination**  
UI component rendering numbered page buttons with ellipsis, first/last/prev/next, page-size selector and "Showing X–Y of Z". *Region:* [Offset and cursor pagination](pagination/knowledge.md)

**pagination metadata**  
{ page, pageSize, total, totalPages } passed as respond.ok(data, { pagination }). *Region:* [Offset and cursor pagination](pagination/knowledge.md)

**parent:name**  
How a layer reads a bind its ancestor declares, instead of re-declaring it. *Region:* [The lens model](lens-model/knowledge.md)

**parent:name**  
How a layer reads a bind its ancestor declares, instead of re-declaring it. *Region:* [Using a lens: build, gate, fetch](lens-usage/knowledge.md)

**ParentRelation**  
{ field, model, fk }: one to-one, FK-owning relation the hydrator follows. *Region:* [Permissions library (ReBAC engine)](lib-permissions/knowledge.md)

**Parking**  
Moving a refused slow job to delayed for 2 s up to JOBS_SLOW_PARK_MAX_MS without using a retry. *Region:* [Job lanes and overflow outbox](job-lanes-outbox/knowledge.md)

**parseAtlasBlock**  
Parses an @atlas annotation block from source or docs. *Region:* [Atlas code map (library + template usage)](lib-atlas/knowledge.md)

**parseSimpleHandleUrl / canonicalUrl / splitUrl**  
Shared URL parsers: handle from a single-host profile URL; normalized URL; path segments. *Region:* [Messaging and contacts](messaging-contacts/knowledge.md)

**parseTagClasses**  
Parses @tagClass(key: value) annotations from doc-comment text. *Region:* [Prisma-map and schema introspection](lib-prisma-map/knowledge.md)

**@partOf**  
Membership: the class:name concepts this file composes; several is normal. *Region:* [Atlas code map (library + template usage)](lib-atlas/knowledge.md)

**partOfFor**  
Stamp-rule helper assigning @partOf from a module or package path capture. *Region:* [Atlas code map (library + template usage)](lib-atlas/knowledge.md)

**Pass the delegate**  
Hand `db.user` to a generic helper (`query.findMany(db.user, args)`) so types infer, instead of `db[toAccessor(model)]`. *Region:* [Database client and transactions](database-client/knowledge.md)

**PasswordInput**  
Input with a show/hide toggle for secrets. *Region:* [UI components and shared pages](ui-components/knowledge.md)

**path**  
Compare against another value on the row instead of a literal; a bare path reads the root row. *Region:* [Writing a json-rules rule](json-rules-shapes/knowledge.md)

**path source**  
A source down a relation path, offering only the rows reachable from there. *Region:* [Lens option sources and bridges](lens-sources/knowledge.md)

**Pattern discovery**  
ENTRYPOINT §4: find 2-3 similar modules and extract their patterns before implementing. *Region:* [Engineering process and docs](engineering-process-docs/knowledge.md)

**permission**  
A per-side @inixiative/permissions-roles / permissions-rebac ActionRule; absent = open, null or false = terminal deny. *Region:* [Transitions library (lifecycle guards)](lib-transitions/knowledge.md)

**permissionRules**  
Per-record JSON field of action -> ActionRule, merged additively (OR) with the schema rule; widens, never revokes. *Region:* [Permissions library (ReBAC engine)](lib-permissions/knowledge.md)

**permissionRules**  
Optional JSON column of row-level ActionRules that only widen access. *Region:* [ReBAC, owner-polymorphic and row permissions](permissions-rebac/knowledge.md)

**permissions-rebac**  
Class tag: ReBAC schema and engine, owner-polymorphic and row-level permissions-roles / permissions-rebac. *Region:* [ReBAC, owner-polymorphic and row permissions](permissions-rebac/knowledge.md)

**permissions-roles**  
Class tag: roles, actions, Permix setup and checks. *Region:* [Roles, actions and permission checks](permissions-roles/knowledge.md)

**PermissionsSlice**  
Permix instance with setup(me), check(model, record, action) and clear(). *Region:* [Frontend store (Zustand slices)](frontend-store/knowledge.md)

**permix**  
The grant holder: role-derived grants keyed by resource or resource:id, a superadmin bypass, and the actor id. *Region:* [Permissions library (ReBAC engine)](lib-permissions/knowledge.md)

**permix**  
Per-request grant holder created in prepareRequest: setup loads grants, check answers them, setSuperadmin bypasses. *Region:* [Roles, actions and permission checks](permissions-roles/knowledge.md)

**permix**  
The per-request Permix permission checker, empty until auth middleware sets it up. *Region:* [Request context and errors](request-context-errors/knowledge.md)

**permix.setSuperadmin**  
Makes every permix check pass for a superadmin. *Region:* [Tenancy and Superadmin](tenancy/knowledge.md)

**permix.setup**  
Loads role-derived grants into permix. *Region:* [Permissions library (ReBAC engine)](lib-permissions/knowledge.md)

**permix.setUserId**  
Sets the actor id that { self } rules compare against. *Region:* [Permissions library (ReBAC engine)](lib-permissions/knowledge.md)

**PermixLike**  
The grant-reading slice of permix the check engine consumes. *Region:* [Permissions library (ReBAC engine)](lib-permissions/knowledge.md)

**pg-init.sh**  
Mounted Postgres init script that creates template_test on first container creation. *Region:* [Dev setup and worktrees](dx-setup/knowledge.md)

**picks**  
The columns a filterLens makes filterable; columns only, a relation name there is a wrong_kind error. *Region:* [List filtering and search](filtering-search/knowledge.md)

**Pinned compose project name**  
docker-compose.yml `name: ${PROJECT_NAME:-template}` so every worktree reuses the same containers; isolation is per-slot DB names and buckets. *Region:* [Dev setup and worktrees](dx-setup/knowledge.md)

**pinoLogger**  
Native Pino instance for third-party SDKs only; bypasses the OTLP/broadcast pipeline. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**#pkg filter**  
turbo task suffix that runs a task for one package (local#api, local:worker#api). *Region:* [Scripts, lint and build tooling](dx-tools/knowledge.md)

**Platform providers**  
Social providers enabled by env vars, listed by getPlatformProviders; not rows. *Region:* [Authentication: sessions, providers, tokens](authentication/knowledge.md)

**PlatformRole**  
System-wide role on User: user or superadmin; superadmin bypasses every permix check. *Region:* [Roles, actions and permission checks](permissions-roles/knowledge.md)

**PlatformRole**  
System-wide role on User: user or superadmin. *Region:* [Tenancy and Superadmin](tenancy/knowledge.md)

**poisoned record**  
IntegrationRecord.poisonedAt set after 3 receiver rejections (400/422) while other records deliver; later deliveries skip it. *Region:* [Adapters, integrations and storage](adapters-integrations/knowledge.md)

**poisoned record**  
On an integration subscription, a record with 3 rejections (400/422) since its last success while another record delivered gets IntegrationRecord.poisonedAt set; later deliveries skip it (services in adapters-integrations). *Region:* [App events and webhooks](app-events-webhooks/knowledge.md)

**Polymorphic side names**  
`owner` for tenancy only, `source`/`target` for directed edges, `resource` for one-sided slots, `subject` for what a record is about, `actor` for who acted; never `referenced*`. *Region:* [Schema conventions and reference data](data-modeling/knowledge.md)

**Polymorphic sides**  
owner (tenancy), source/target (edge ends), resource, subject, actor as `<side>Model` plus side-prefixed FKs and relations; never referenced*. *Region:* [Naming and code style](conventions/knowledge.md)

**polymorphicIs**  
Rule-condition helper matching a polymorphic owner kind and FK; values bound by polymorphicBindings. *Region:* [ReBAC, owner-polymorphic and row permissions](permissions-rebac/knowledge.md)

**polymorphicTarget / polymorphicKeyColumn**  
Read which kind and id a row's polymorphic axis points at, or the key column for one kind. *Region:* [Prisma-map and schema introspection](lib-prisma-map/knowledge.md)

**PolymorphismRegistry**  
Single declaration of each model's polymorphic axes (typeField → fkMap); read via getPolymorphismConfig. *Region:* [Schema conventions and reference data](data-modeling/knowledge.md)

**ports**  
CLI command printing a project's local ports from ports.json. *Region:* [Config package (toolchain, train)](lib-config/knowledge.md)

**ports.json**  
@inixiative/config port registry: each project gets the service default + 100 x its block; `config ports` prints them. *Region:* [Dev setup and worktrees](dx-setup/knowledge.md)

**ports.json**  
Registry of per-project port blocks: service default + 100 x block, reserved ports skipped. *Region:* [Config package (toolchain, train)](lib-config/knowledge.md)

**POST /api/admin/job**  
Admin route that enqueues a one-off ad-hoc job. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**POST /api/v1/batch/execute**  
The Batch API endpoint: { strategy, requests: rounds[][], headers? } answered 200 with batch results and a summary. *Region:* [Batch API](batch/knowledge.md)

**Post-transaction job queue**  
Jobs enqueued inside db.txn are held and dispatched after commit. *Region:* [Database client and transactions](database-client/knowledge.md)

**posture**  
A way of using a lens — reason (gate, compile), fetch, read — all filtered by every layer. *Region:* [The lens model](lens-model/knowledge.md)

**PR environment**  
Intended ephemeral pr deployment per pull request with its own DB branch, previews and Infisical secrets; the pipeline is not built yet. *Region:* [Environments, env vars and deploy](environments-deploy/knowledge.md)

**predicate**  
A json-rules Condition giving legality; from reads the current record, to reads the merged record. *Region:* [Transitions library (lifecycle guards)](lib-transitions/knowledge.md)

**Preflight**  
Pre-send content checks (subject, image alt, preheader, spam phrases, unresolved lens paths) via runPreflight / emailTemplatePreflight. *Region:* [Email compose, render and save](email-render/knowledge.md)

**prepareRequest**  
First middleware: sets db, requestId, bracketQuery, a fresh permix, nulls auth/resource vars, wraps the request in db.scope; minimal setup for /api/batch. *Region:* [Request context and errors](request-context-errors/knowledge.md)

**Prerequisites**  
First TUI view: CLI and session checks via checkPrerequisites before any task runs. *Region:* [Init script architecture and direction](init-architecture/knowledge.md)

**preset**  
A shared config export (tsconfig base/node/react, biome base/react, tsup node/react, lefthook base) a repo extends. *Region:* [Config package (toolchain, train)](lib-config/knowledge.md)

**preset facet**  
A facet that seeds a fixed reusable rule, optionally with tunable Variables. *Region:* [rules-builder library README](lib-rules-builder/knowledge.md)

**preset facet**  
A facet that seeds a fixed reusable rule, optionally with tunable Variables. *Region:* [Rule builder: template usage](rules-builder/knowledge.md)

**preventHardDelete**  
Hook blocking delete/deleteMany on models that may only be soft-deleted. *Region:* [Audit log and soft delete](audit-soft-delete/knowledge.md)

**previous**  
The pre-mutation row(s), fetched automatically for update, upsert and delete and passed to hooks. *Region:* [Mutation hooks, immutable fields, ordered lists](mutation-hooks/knowledge.md)

**Previous ∪ Result**  
Invalidation clears keys derived from both the old and new row so value keys (email, slug) don't go stale. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**Prime data**  
Records marked `prime: true`: dev-only users, org, space and tokens, loaded with `db:seed --prime`, skipped in production. *Region:* [Database scripts and seeding](database-tooling/knowledge.md)

**Prime development data**  
Seed users (super@, owner@, customer@inixiative.com) and local_user/orgUser/spaceUser API tokens from db:seed --prime. *Region:* [Dev setup and worktrees](dx-setup/knowledge.md)

**primitives**  
packages/ui/src/components/primitives: Shadcn-based base UI (Button, Input, Card, Table, Select, ...). *Region:* [UI components and shared pages](ui-components/knowledge.md)

**primitives lane**  
json-rules, permissions-roles / permissions-rebac, transitions, rules-builder, prisma-map, atlas, gloss. *Region:* [Config package (toolchain, train)](lib-config/knowledge.md)

**PrismaMap**  
Record of model name -> { dbName, fields, indexes } read at runtime instead of hand-declared model metadata. *Region:* [Prisma-map and schema introspection](lib-prisma-map/knowledge.md)

**prismaMap.gen.ts**  
The template's generated map in packages/db, written by generatePrismaMap.ts. *Region:* [Prisma-map and schema introspection](lib-prisma-map/knowledge.md)

**Probe**  
A health or auth check request (isAuthProbe, isSystemProbe) that bypasses the normal gates. *Region:* [Auth middleware, validators and users](auth-middleware-users/knowledge.md)

**process-lifecycle**  
Class: graceful shutdown handlers, health checks, connection draining, unref intervals. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**processJob**  
The worker's per-job processor (slot claim, scopes, tracing); never called to schedule work. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**ProfileFormCard**  
Name/slug form shared by the three profile pages; showThemeToggle adds the theme picker. *Region:* [UI components and shared pages](ui-components/knowledge.md)

**progress flag**  
One persisted boolean per externally verifiable provider fact; never an umbrella flag over several remote writes. *Region:* [Init script architecture and direction](init-architecture/knowledge.md)

**progress flag**  
One persisted boolean per externally verifiable provider fact; never an umbrella flag over several remote writes. *Region:* [Writing an init task](init-tasks/knowledge.md)

**project.config.ts**  
Project config file holding project metadata and per-provider progress flags. *Region:* [Init script architecture and direction](init-architecture/knowledge.md)

**projectLens**  
The projected form: what a lens exposes, by path or by model; a view, not a gate. *Region:* [The lens model](lens-model/knowledge.md)

**projectLens**  
Path-keyed projection (Record<dottedPath, ProjectedVisit>); with { by: model } a leak-safe Lens surface. *Region:* [Using a lens: build, gate, fetch](lens-usage/knowledge.md)

**projectRows**  
Cut fetched rows to what a lens shows: hidden columns and off relations removed, clamped rows dropped. *Region:* [Using a lens: build, gate, fetch](lens-usage/knowledge.md)

**prompt()**  
init/utils/prompts.ts helper composing keyboard hint text from commands in a fixed order. *Region:* [Writing an init task](init-tasks/knowledge.md)

**ProviderModel**  
Discriminator for the provider side of a CustomerRef, and for a Segment's owner. *Region:* [Customers and segments](customers-segments/knowledge.md)

**_public**  
Layout route for unauthenticated pages (login, signup, auth.callback). *Region:* [Frontend apps, routes and layouts](frontend-apps-routing/knowledge.md)

**publishMembershipChanges**  
Emits segment.membersAdded/Removed and customerRef.segmentsAdded/Removed for non-empty diffs. *Region:* [Customers and segments](customers-segments/knowledge.md)

## Q

**query**  
Delegate helper object (findMany, findUnique, update, del, ...) typed from the delegate you pass. *Region:* [Database client and transactions](database-client/knowledge.md)

**query key**  
The SDK-generated key (e.g. organizationReadQueryKey) that every apiQuery must be paired with. *Region:* [API client, SDK and query hooks](api-client/knowledge.md)

**query plan / steps**  
toPrisma's output: where steps plus groupBy steps for counts and relation aggregates. *Region:* [Compiling rules to Prisma and SQL](json-rules-backends/knowledge.md)

**Query-refetch hint**  
{ category: 'query', action: 'refetch', key: { _id, path? } }: the client invalidates that key and refetches over HTTP. *Region:* [WebSocket channels and refetch hints](ws-channels/knowledge.md)

**queueDepths**  
Cached (~1 s) probe returning { total, slow, slowDeferred }; fresh = true bypasses the cache. *Region:* [Job lanes and overflow outbox](job-lanes-outbox/knowledge.md)

**Quick Doc Routing**  
ENTRYPOINT §11 table mapping task type to the docs/claude file to read first. *Region:* [Engineering process and docs](engineering-process-docs/knowledge.md)

## R

**rail**  
One of the three ways a rule runs: check() in memory, toSql, toPrisma; they must agree. *Region:* [json-rules dates, windows and verbs](json-rules-dates/knowledge.md)

**rate-limiting**  
Fixed-window rate limits keyed by user, space, organization or IP, answering 429 with Retry-After. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**rateLimit**  
Middleware that ANDs fixed-window rules and 429s with Retry-After when any bucket is over its max. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**rateLimitMax**  
The single seam resolving a tier's max (for subscriptions / feature flags), never a column. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**rawView**  
A view over a raw record with every relation on, for permissions-roles / permissions-rebac and transitions rules. *Region:* [Rule builder: template usage](rules-builder/knowledge.md)

**react**  
tsup preset for React/UI packages: `export default react({ entry })`. *Region:* [Config package (toolchain, train)](lib-config/knowledge.md)

**readAllAsCaller**  
Reads every page of a list endpoint in-process as the caller, capped by pages. *Region:* [Batch API](batch/knowledge.md)

**readAsCaller**  
Reads one API path in-process with the caller's session, permissions-roles / permissions-rebac and tenancy. *Region:* [Batch API](batch/knowledge.md)

**readLensValue**  
One value off a row as the lens shows it, clamps checked per row; for template interpolation. *Region:* [Using a lens: build, gate, fetch](lens-usage/knowledge.md)

**readPath**  
The API read a step checks, built with apiPath(operationId, pathParams, query). *Region:* [Guided flows](flows/knowledge.md)

**readRoute**  
Route template for a single read or (many: true) a list, with optional paginate, search, ordering and filterLens. *Region:* [API routes, controllers and modules](api-routes/knowledge.md)

**ready / WITH GAPS**  
worktree:create outcome: green when every step landed, yellow listing what to rerun. *Region:* [Dev setup and worktrees](dx-setup/knowledge.md)

**Reason**  
{ paths: PathReason[] }, each with separate from/to SideReason predicate and permission messages. *Region:* [Transitions library (lifecycle guards)](lib-transitions/knowledge.md)

**ReBAC**  
Relationship-walking authorization over the real data graph, in @template/permissions-roles / permissions-rebac. *Region:* [Monorepo layout and architecture](monorepo-architecture/knowledge.md)

**ReBAC**  
Relationship-based access: actions delegate along relations (space → organization) instead of per-row grants. *Region:* [ReBAC, owner-polymorphic and row permissions](permissions-rebac/knowledge.md)

**RebacSchema**  
{ bridges?, permissions-roles / permissions-rebac }: maps each (map-qualified) resource to { actions: { name -> ActionRule } }. *Region:* [Permissions library (ReBAC engine)](lib-permissions/knowledge.md)

**rebacSchema**  
Per-model table of ActionRules the app enforces (packages/permissions-roles / permissions-rebac/src/rebac/schema.ts). *Region:* [ReBAC, owner-polymorphic and row permissions](permissions-rebac/knowledge.md)

**receivedWebhooks**  
In-memory capture of POST /test/webhook deliveries; clearReceivedWebhooks resets it. *Region:* [Test harness, request helpers and VCR](test-harness/knowledge.md)

**recheck**  
On a bridged source query, the conjuncts the database-client / data-modeling could not decide; its rows are candidates, not options. *Region:* [Lens option sources and bridges](lens-sources/knowledge.md)

**recomposeSnapshot**  
Rebuilds the as-sent composition by splicing pinned component snapshots into the template snapshot. *Region:* [Email templates and components](email-templates/knowledge.md)

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
Registries for sensitive values (shown as [REDACTED]) versus noise fields (dropped before diffing). *Region:* [Audit log and soft delete](audit-soft-delete/knowledge.md)

**redactLens**  
mapDefaults wrapper that strips redacted fields wherever a model appears. *Region:* [Template lenses](lenses/knowledge.md)

**redactLogValue / stringifyLogValue**  
Redact sensitive fields and URLs from a value, as structure or as string. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**redactUser**  
Anonymizes a user's PII on account deletion (redacted email, 'Redacted User') and keeps the row. *Region:* [Auth middleware, validators and users](auth-middleware-users/knowledge.md)

**redirectPreservingContext**  
Throws a beforeLoad redirect keeping org, space and spoof params. *Region:* [Frontend apps, routes and layouts](frontend-apps-routing/knowledge.md)

**redirectPreservingContext**  
Throws a beforeLoad redirect keeping org, space and spoof. *Region:* [Frontend Authentication](frontend-auth/knowledge.md)

**redirectTo**  
Search param the guard sets so login/signup return the user to the original path. *Region:* [Frontend apps, routes and layouts](frontend-apps-routing/knowledge.md)

**redirectTo**  
Search param naming where to return after auth; preserved across login ↔ signup. *Region:* [Frontend Authentication](frontend-auth/knowledge.md)

**redis**  
Redis connections, key namespaces and built-in key uses. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**REDIS_BULLMQ_URL**  
Optional dedicated Redis for queues; falls back to REDIS_URL. *Region:* [Environments, env vars and deploy](environments-deploy/knowledge.md)

**redisNamespace**  
The reserved key prefixes: bull, cache, job, ws, otp, session, limit, lock, lane. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**reference-data**  
Class: static ISO country, currency, language and IANA timezone lists with lookups and zod schemas. *Region:* [Schema conventions and reference data](data-modeling/knowledge.md)

**refetch**  
Builds the query-refetch hint for a message handoff. *Region:* [WebSocket channels and refetch hints](ws-channels/knowledge.md)

**refreshUserContext**  
Reloads the user's memberships and permissions-roles / permissions-rebac mid-request after membership or role changes. *Region:* [Request context and errors](request-context-errors/knowledge.md)

**REGENERATE_ON_REVIVE**  
Columns recomputed when a tombstoned row is revived. *Region:* [Audit log and soft delete](audit-soft-delete/knowledge.md)

**registerBatch / unregisterBatch**  
Put a batch's db and base context in the in-memory registry, and remove it when the batch ends. *Region:* [Batch API](batch/knowledge.md)

**registerCronJobs**  
Worker-startup sync of enabled CronJob rows to BullMQ repeatables, removing orphans. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**registerDbHook**  
Attaches a named before/after handler to given DbActions on a model or '*'. *Region:* [Mutation hooks, immutable fields, ordered lists](mutation-hooks/knowledge.md)

**registerHooks**  
Installs all application hooks at startup; called from both API and worker entry points. *Region:* [Mutation hooks, immutable fields, ordered lists](mutation-hooks/knowledge.md)

**registerInquiryType**  
Registers a type's label and its source/target summary, detail, compose and review components. *Region:* [Inquiry API and frontend](inquiry-routes-ui/knowledge.md)

**registerTestTracker**  
Starts tracking touched tables; the db client registers it, tests do not call it. *Region:* [Test factories, cleanup and test rules](test-factories-rules/knowledge.md)

**registry**  
apps/api/src/lib/email/registry.ts: per-slug entry declaring lenses, sender, recipients and render policy. *Region:* [Email compose, render and save](email-render/knowledge.md)

**rehydration**  
Recognizing a saved raw rule as its named facet again (matchFacet, lockedLeading, hoist). *Region:* [Rule builder: template usage](rules-builder/knowledge.md)

**rel**  
{ rel, action }: walk a relation on the record (dot-paths for multi-hop) and check the action on the target. *Region:* [Permissions library (ReBAC engine)](lib-permissions/knowledge.md)

**relation-node where**  
root.relations[R]…where: applies only when a rule descends through R. *Region:* [The lens model](lens-model/knowledge.md)

**RelationField**  
kind 'object' field with target type, isList, relationName, fromFields and toFields. *Region:* [Prisma-map and schema introspection](lib-prisma-map/knowledge.md)

**relationForeignKey**  
Collapses one relation's FK into a field name, a { referencedField: localField } map, or null. *Region:* [Prisma-map and schema introspection](lib-prisma-map/knowledge.md)

**relations**  
The filterLens key that turns a relation on for filtering; relations are off until enabled. *Region:* [List filtering and search](filtering-search/knowledge.md)

**relations (turning on)**  
Relations are fields, off by default; only the first narrowing turns one on, through its relation object. *Region:* [The lens model](lens-model/knowledge.md)

**relative date expression**  
A rule value such as `this month` or an `ago` rolling shift, resolved from `now` in the evaluation zone. *Region:* [json-rules dates, windows and verbs](json-rules-dates/knowledge.md)

**relative date expression**  
Serializable date values: points ({ ago }, { ahead }, { start }, { end }) and ranges ({ this }, { last }, { next }). *Region:* [Writing a json-rules rule](json-rules-shapes/knowledge.md)

**removeRepeatable**  
BullMQ call whose job id is the third argument; a jobId inside repeat is overwritten. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**renderForRecipient**  
Per-recipient render shared by email and messaging; variables come from recipientVariables. *Region:* [Email compose, render and save](email-render/knowledge.md)

**renderForRecipient**  
The one rendering primitive both lanes share, fed by recipientVariables. *Region:* [Messaging and contacts](messaging-contacts/knowledge.md)

**RenderIssue**  
Typed render-time issue (kind rule | token | each, path, detail) recorded instead of throwing. *Region:* [Email compose, render and save](email-render/knowledge.md)

**Renovate**  
Owns non-toolchain dependency bumps and bumping @inixiative/config itself; fenced off the toolchain. *Region:* [Config package (toolchain, train)](lib-config/knowledge.md)

**Request context (AppEnv)**  
Per-request db, user, org, space and permissions-roles / permissions-rebac scoped through AsyncLocalStorage; no global state. *Region:* [Monorepo layout and architecture](monorepo-architecture/knowledge.md)

**request-context**  
Class: the per-request AppEnv context, the middleware that fills it, and the getters handlers read it with. *Region:* [Request context and errors](request-context-errors/knowledge.md)

**request-schemas**  
Class: request/response zod schemas, mostly generated from Prisma (ScalarSchema, CreateInput) and narrowed with sanitize helpers. *Region:* [Request schemas and OpenAPI](api-schemas-openapi/knowledge.md)

**requestId**  
UUID per request, returned as the request-id header and stamped on every error body. *Region:* [Request context and errors](request-context-errors/knowledge.md)

**requireAuth**  
Guard redirecting unauthenticated users to /login?redirectTo=…, carrying org, space and spoof. *Region:* [Frontend Authentication](frontend-auth/knowledge.md)

**requireAuth / requirePublic**  
Route-level markers for whether the auth chain must have produced an actor. *Region:* [Auth middleware, validators and users](auth-middleware-users/knowledge.md)

**requireAuth / requirePublic**  
beforeLoad guards from @template/ui/guards built by createAuthGuards; both run auth.initialize() first. *Region:* [Frontend apps, routes and layouts](frontend-apps-routing/knowledge.md)

**requirePublic**  
Guard redirecting authenticated users away from login and signup. *Region:* [Frontend Authentication](frontend-auth/knowledge.md)

**requires**  
Side metadata naming relations to load; ignored by the kernel today. *Region:* [Transitions library (lifecycle guards)](lib-transitions/knowledge.md)

**reset:db**  
Local clean slate: down + up + push + seed. *Region:* [Database scripts and seeding](database-tooling/knowledge.md)

**resolutionInputSchema**  
What the resolver submits; declared fields (except explanation) may override content. *Region:* [Inquiry model and handlers](inquiry-handlers/knowledge.md)

**resolutionSchema**  
The full stored resolution shape, including fields computed by handleApprove. *Region:* [Inquiry model and handlers](inquiry-handlers/knowledge.md)

**resolveAll**  
Promise.all over thunks with an optional cap; results in input order. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**resolveDateConfig**  
The single resolver seam (src/date.ts): zone from a name, a value source, or 'UTC'. *Region:* [json-rules dates, windows and verbs](json-rules-dates/knowledge.md)

**resolvedContent**  
inquiry.content merged with the resolver's declared override fields, passed to handleApprove. *Region:* [Inquiry model and handlers](inquiry-handlers/knowledge.md)

**resolvedCustomerRefLens**  
customerRefLens bound to one provider owner (ownerModel, ownerId). *Region:* [Customers and segments](customers-segments/knowledge.md)

**resolveIdentity**  
Authenticates socket headers into anonymous, user or failure. *Region:* [WebSocket connections](ws-connections/knowledge.md)

**resolveInquirySource / resolveInquiryTarget**  
Infer the source from the route context; resolve the target from ids, slugs or targetEmail. *Region:* [Inquiry model and handlers](inquiry-handlers/knowledge.md)

**resolveOperation**  
Looks up an operationId's route and fills path params for in-process callers. *Region:* [Request schemas and OpenAPI](api-schemas-openapi/knowledge.md)

**resolveRelation**  
The injected, ORM-specific function returning the model a relation segment points at. *Region:* [Permissions library (ReBAC engine)](lib-permissions/knowledge.md)

**resolveSender**  
Loads the sending row through its lens as the sender variable; identity only, not branding. *Region:* [Email delivery and preferences](email-delivery/knowledge.md)

**resolveUsers**  
Compiles a json-rules Condition through the recipient lens into a Prisma query for recipients at job time. *Region:* [Messaging and contacts](messaging-contacts/knowledge.md)

**resource**  
A schema key, map-qualified as map:Model (db:User) when bridges are used; bare keys for single-source schemas. *Region:* [Permissions library (ReBAC engine)](lib-permissions/knowledge.md)

**resource**  
Map-qualified key (map:Model, e.g. db:Inquiry), the same convention @inixiative/permissions-roles / permissions-rebac uses. *Region:* [Transitions library (lifecycle guards)](lib-transitions/knowledge.md)

**Resource naming**  
Railway resources named {project}-{env}-{app} from project.config.ts; Vercel omits env; never hardcoded. *Region:* [Init script architecture and direction](init-architecture/knowledge.md)

**resourceActionSubresource**  
Route/operationId pattern: userCreate, organizationReadManySpaces, adminOrganizationReadMany. *Region:* [Naming and code style](conventions/knowledge.md)

**resourceContextArgs**  
Per-model include map deciding which relations resourceContextMiddleware loads. *Region:* [Request context and errors](request-context-errors/knowledge.md)

**resourceContextMiddleware**  
Loads the :id resource into context; 404 for none, 409 for several; supports ?lookup= on unique fields. *Region:* [Request context and errors](request-context-errors/knowledge.md)

**respond**  
The responder object a makeController handler receives: respond.ok (200), respond.created (201), respond.noContent (204). *Region:* [API routes, controllers and modules](api-routes/knowledge.md)

**respond500**  
Wraps a raw Error into the standard 500 envelope; handlers never call it directly. *Region:* [Request context and errors](request-context-errors/knowledge.md)

**responseSchema**  
The route's response shape, independent of filterLens. *Region:* [List filtering and search](filtering-search/knowledge.md)

**ResponsiveDrawer**  
Right drawer at or above breakpoint (default md), Modal below; recommended for detail views. *Region:* [Layout system and theme](theme-layout/knowledge.md)

**Resume tests**  
init/tasks/tests/*Resume.test.ts using bun:test, mock.module and VCR cassettes queued per init/api client; run with bun run test:init. *Region:* [Writing an init task](init-tasks/knowledge.md)

**retryable error**  
{ type: 'error', action, stream?, channel?, retryable: true }: transient failure the client re-sends with backoff. *Region:* [WebSocket connections](ws-connections/knowledge.md)

**retryWithTimeout**  
init/utils/retry.ts loop retrying only on specific not-ready errors with a delay and a timeout message. *Region:* [Init script architecture and direction](init-architecture/knowledge.md)

**retryWithTimeout**  
init/utils/retry.ts loop retrying only on specific not-ready errors with a delay and a timeout message. *Region:* [Writing an init task](init-tasks/knowledge.md)

**returnUrl**  
Optional in-app binding (appPathSchema) where the flow ends; default /dashboard. *Region:* [Guided flows](flows/knowledge.md)

**revive**  
Restores soft-deleted rows by clearing deletedAt; cascade revive matches the shared timestamp. *Region:* [Audit log and soft delete](audit-soft-delete/knowledge.md)

**Role**  
Per-membership and per-token role: owner, admin, member, viewer, ordered by roleHierarchy. *Region:* [Roles, actions and permission checks](permissions-roles/knowledge.md)

**roleHierarchy**  
['viewer','member','admin','owner']; higher index means more permissions-roles / permissions-rebac. *Region:* [Roles, actions and permission checks](permissions-roles/knowledge.md)

**rolling window**  
An `ago`-shaped date expression (`rollingShift`, `rollingExpr` in dateExpr.ts) that moves with `now`. *Region:* [json-rules dates, windows and verbs](json-rules-dates/knowledge.md)

**__root**  
Root route: registers nav config (useRegisterNavigation), page meta, theme, websocket and FlowBanner once. *Region:* [Frontend apps, routes and layouts](frontend-apps-routing/knowledge.md)

**Root component app hooks**  
Hooks the app root runs once: theme persistence, language, nav registration, websocket. *Region:* [Layout system and theme](theme-layout/knowledge.md)

**root-array rule**  
A fieldless ArrayRule tree evaluated by check() over an array of rows; check-only. *Region:* [Running, validating and typing rules](json-rules-runtime/knowledge.md)

**root.where**  
A static server-enforced row filter on the route, AND-merged into every query. *Region:* [List filtering and search](filtering-search/knowledge.md)

**root.where**  
Clamp at the lens anchor visit: scopes the lens's root model. *Region:* [The lens model](lens-model/knowledge.md)

**root.where**  
A clamp at the lens anchor: a static route-wide filter on the root rows. *Region:* [Template lenses](lenses/knowledge.md)

**rotateEncryptionKeys**  
Singleton job enqueued at worker startup that re-encrypts rows still on the previous key version. *Region:* [Encryption and secrets](encryption/knowledge.md)

**round**  
An array of sub-requests that run in parallel; rounds run in sequence. *Region:* [Batch API](batch/knowledge.md)

**route-templates**  
Class: the route factories in #/lib/routeTemplates and the makeController responders that every endpoint is built from. *Region:* [API routes, controllers and modules](api-routes/knowledge.md)

**routeAccessOf**  
Classifies a status: 2xx granted, 429/5xx retryable, anything else rejected (openRejected). *Region:* [WebSocket data streams](ws-data-streams/knowledge.md)

**routeRow**  
Parses an upsert row with the route's responseSchema and brands it; raw models do not typecheck. *Region:* [WebSocket data streams](ws-data-streams/knowledge.md)

**routes/api vs routes/internal**  
Public tenant endpoints mount under apps/api/src/routes/api; non-public service calls under routes/internal. *Region:* [API routes, controllers and modules](api-routes/knowledge.md)

**routes/api vs routes/internal**  
Public tenant endpoints mount under apps/api/src/routes/api; non-public service calls under routes/internal. *Region:* [Request schemas and OpenAPI](api-schemas-openapi/knowledge.md)

**Row**  
A plain record object the engine reads relation fields and predicate fields from. *Region:* [Permissions library (ReBAC engine)](lib-permissions/knowledge.md)

**rowShape**  
materializeSourceQuery's row form: prisma (nested labels) or sql (flat __label / __group_i). *Region:* [Lens option sources and bridges](lens-sources/knowledge.md)

**Rule error**  
A rule own error message, returned by check() when the rule fails. *Region:* [Writing a json-rules rule](json-rules-shapes/knowledge.md)

**Rule health**  
Whether a segment's rule is sound, derived from its RuleReference edges and their dependency closure. *Region:* [Customers and segments](customers-segments/knowledge.md)

**rule-references**  
Class tag: RuleReference edges for the rows a stored rule names, their sync on save, and rule health / degradation. *Region:* [Template rules and rule references](json-rules/knowledge.md)

**rule-violations fixtures**  
scripts/ci/rule-violations/<rule>/pass and /fail cases; protected along with the rules. *Region:* [Scripts, lint and build tooling](dx-tools/knowledge.md)

**RULE_REFERENCEABLE_MODELS**  
The targetModel axis of PolymorphismRegistry.RuleReference: which models a rule may name (Tag, Organization, Space, Segment). *Region:* [Template rules and rule references](json-rules/knowledge.md)

**RuleBuilderSource**  
The serializable source a self-contained app stores or a server sends; resolved client-side into a view. *Region:* [Rule builder: template usage](rules-builder/knowledge.md)

**RuleDegradedError**  
Signals a stored rule cannot be evaluated correctly, naming the degraded reference. *Region:* [Template rules and rule references](json-rules/knowledge.md)

**RuleErrorSink**  
Callback (issue: RenderIssue) => void that collects render issues. *Region:* [Email compose, render and save](email-render/knowledge.md)

**RuleEvaluationError**  
Wraps a failure thrown while evaluating a rule; not a degraded rule. *Region:* [Template rules and rule references](json-rules/knowledge.md)

**ruleIssues**  
Rule health issues included on owner reads of a segment; hidden from customer-facing membership reads. *Region:* [Customers and segments](customers-segments/knowledge.md)

**ruleIssues**  
Lists a stored rule's health issues: missing bindings, lens violations, dead references. *Region:* [Template rules and rule references](json-rules/knowledge.md)

**RuleReference**  
One edge row per (rule-bearing source row → referenced target row); sourceModel / targetModel with typed FKs on both ends. *Region:* [Template rules and rule references](json-rules/knowledge.md)

**ruleReference:target**  
The edge recorded when a stored rule names a template row; soft-delete marks it stale, purge removes it. *Region:* [Email templates and components](email-templates/knowledge.md)

**ruleReference:target**  
The hook that copies a referenced row soft delete onto every edge naming it, and clears it on undelete. *Region:* [Template rules and rule references](json-rules/knowledge.md)

**RuleReferenceError**  
Thrown on save when a rule names a missing, invalid or dynamic referenced row. *Region:* [Template rules and rule references](json-rules/knowledge.md)

**ruleReferenceIssues**  
Reports soft-deleted or purged targets from edge rows alone. *Region:* [Template rules and rule references](json-rules/knowledge.md)

**ruleReferences**  
Extracts the rows a rule names by id, read through its lens via describeRuleSources. *Region:* [Template rules and rule references](json-rules/knowledge.md)

**rules-builder**  
The @inixiative/rules-builder package: headless rule-editor model (views, facets, descriptor tree, pickers) for json-rules Conditions. *Region:* [Rule builder: template usage](rules-builder/knowledge.md)

**RulesRegistry**  
The hooks' declarative json-rules validation per model (e.g. Token.ownerModel), checked on create and on updates. *Region:* [Template rules and rule references](json-rules/knowledge.md)

**RulesRegistry**  
Per-model json-rules conditions checked on write; a failing rule throws. *Region:* [Mutation hooks, immutable fields, ordered lists](mutation-hooks/knowledge.md)

**run-ci-rules.sh**  
Runs scripts/ci/rules alphabetically; --test checks each rule against its pass/fail fixtures. *Region:* [Scripts, lint and build tooling](dx-tools/knowledge.md)

**run-post-biome-checks**  
Runs check-import-aliases, check-generated-files and check-finder-duplicates after Biome. *Region:* [Scripts, lint and build tooling](dx-tools/knowledge.md)

**runDrainOutboxPass**  
One drain tick under the outbox-drain createLock: fast rows, then slow rows, then flag settling. *Region:* [Job lanes and overflow outbox](job-lanes-outbox/knowledge.md)

**runInTransactionContext**  
Runs a callback with a given transaction client as the ambient db, so nested db.<model> calls join it. *Region:* [Database client and transactions](database-client/knowledge.md)

**runJobStages**  
Runs a multi-stage job's stages and their children. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**running / loading<Entity> / storing<Action>**  
Boolean execution-state naming in init views. *Region:* [Init script architecture and direction](init-architecture/knowledge.md)

**runOnOutboxQueue**  
The outbox mutex: runs a JobOutbox write on the serialized queue shared by flushes and drains. *Region:* [Job lanes and overflow outbox](job-lanes-outbox/knowledge.md)

**RuntimeDelegate**  
The one cast used for dynamic Prisma model access in the rotation job. *Region:* [Encryption and secrets](encryption/knowledge.md)

## S

**sanitizeKeys**  
Template arg listing body keys stripped before Prisma, for fields clients must not set. *Region:* [API routes, controllers and modules](api-routes/knowledge.md)

**sanitizeRequestSchema**  
Strips server-managed keys from a zod request body schema. *Region:* [Request schemas and OpenAPI](api-schemas-openapi/knowledge.md)

**sanitizeWSHeaders**  
Keeps only the authorization and x-spoof-user-email headers for the identity probe. *Region:* [WebSocket connections](ws-connections/knowledge.md)

**savedByApp**  
Marks email seed files that only the api seed (emailSeedSavers) may persist, so seeded rows meet save guards. *Region:* [Email templates and components](email-templates/knowledge.md)

**SavedRule**  
A rule persisted with its source and sourceValues (parseSavedRule / stringifySavedRule); its editor lives in rules-builder. *Region:* [Template rules and rule references](json-rules/knowledge.md)

**SavedRule**  
A rule packaged with its source reference and captured sourceValues; written by stringifySavedRule, read by parseSavedRule. *Region:* [rules-builder library README](lib-rules-builder/knowledge.md)

**SavedRule**  
A rule packaged with its source reference and captured sourceValues; written by stringifySavedRule, read by parseSavedRule. *Region:* [Rule builder: template usage](rules-builder/knowledge.md)

**saveEmailTemplate**  
The only writer of template mjml/subject: validates, extracts refs, resolves variants and syncs rule references. *Region:* [Email compose, render and save](email-render/knowledge.md)

**saveScopedRow**  
Writes a template or component row for one owner tier with the owner columns set from the cascade. *Region:* [Email templates and components](email-templates/knowledge.md)

**ScalarField**  
kind 'scalar' field with type, isRequired, isList, isId, optional dbName and default. *Region:* [Prisma-map and schema introspection](lib-prisma-map/knowledge.md)

**scan**  
Runs check across every ecosystem checkout under a root, per lane. *Region:* [Config package (toolchain, train)](lib-config/knowledge.md)

**schema narrowing**  
picks / omits / enumPicks / enumOmits: what the type surface lets anyone mention. *Region:* [The lens model](lens-model/knowledge.md)

**schema-introspection**  
Class: runtime schema maps (@inixiative/prisma-map, prismaMap.gen.ts) and the template's model-metadata helpers. *Region:* [Prisma-map and schema introspection](lib-prisma-map/knowledge.md)

**Scope invention**  
Adding adjacent things nobody asked for: 'in case' fields, single-call wrappers, compat shims, unused barrels. *Region:* [Engineering process and docs](engineering-process-docs/knowledge.md)

**scope references**  
$-prefixed refs ($., $$., $$$.) reaching the current or an enclosing array element; only array and aggregate rules add levels. *Region:* [Writing a json-rules rule](json-rules-shapes/knowledge.md)

**scope references**  
$. / $$. / $$$. prefixes reaching enclosing elements; offered pre-prefixed via LeafNode.scopes and value.path.scopes. *Region:* [rules-builder library README](lib-rules-builder/knowledge.md)

**Scope roots**  
sender, recipient, data, system: the only roots a template token or rule may read. *Region:* [The email lens](email-lens/knowledge.md)

**Scope roots**  
The four token roots a template may read: sender, recipient, data, system (SCOPE_ROOTS). *Region:* [Email compose, render and save](email-render/knowledge.md)

**scopedRule**  
The array-rule form of a rule inside {{#each}}: one any per loop, element-relative leaves, $$ to climb to the root. *Region:* [The email lens](email-lens/knowledge.md)

**scopedRule**  
Rewrites an email rule inside {{#each}} loops into nested any array conditions. *Region:* [Template rules and rule references](json-rules/knowledge.md)

**scopeEmailLens**  
Restricts tags, segments and link rows to the row owner's visibility. *Region:* [The email lens](email-lens/knowledge.md)

**scopeNarrowing**  
Middleware that ANDs a per-request, context-dependent where onto the route's narrowing; it can only narrow. *Region:* [List filtering and search](filtering-search/knowledge.md)

**scopeNarrowing**  
Middleware that stacks a per-request, context-dependent narrowing onto the route filter lens. *Region:* [Template lenses](lenses/knowledge.md)

**scripts**  
Class: the sanctioned package.json scripts and how to run and write them. *Region:* [Scripts, lint and build tooling](dx-tools/knowledge.md)

**scripts/db/**  
Shell scripts behind dump, restore, clone and release. *Region:* [Database scripts and seeding](database-tooling/knowledge.md)

**seal**  
A planned where-preserving collapse for server→subtenant handoff; projectLens by model is not a substitute. *Region:* [Using a lens: build, gate, fetch](lens-usage/knowledge.md)

**search**  
A broad term fanned across the lens's searchable text fields (contains / has / string_contains). *Region:* [List filtering and search](filtering-search/knowledge.md)

**searchablePaths / orderablePaths**  
The filter and sort field paths a filterLens exposes; orderable excludes to-many crossings and Json/Bytes. *Region:* [List filtering and search](filtering-search/knowledge.md)

**SearchableSelect**  
Select with a search box; filters locally, or calls onSearch debounced for API search. *Region:* [UI components and shared pages](ui-components/knowledge.md)

**searchFields**  
Per-field filters with Prisma operators (contains, gte, in, some, every, none, is, ...); a bare value takes the field's default operator. *Region:* [List filtering and search](filtering-search/knowledge.md)

**searchPaths**  
paginate() option pinning the global search term to a subset of the lens's searchable paths; must subset the lens or every request 500s. *Region:* [List filtering and search](filtering-search/knowledge.md)

**SecretRevealModal**  
Shows a newly created secret once with a copy button. *Region:* [UI components and shared pages](ui-components/knowledge.md)

**secrets**  
Class tag: Infisical storage, secret env vars and keyrings per environment (CI included), provider credentials, how keys rotate. *Region:* [Encryption and secrets](encryption/knowledge.md)

**--section=**  
init:agent flag running one section: project, infisical, planetscale, railway or monitoring; omitted runs the full flow (minus monitoring). *Region:* [Init script architecture and direction](init-architecture/knowledge.md)

**sectionId**  
camelCase id of a data section, used for scroll restore and section hash navigation. *Region:* [Offset and cursor pagination](pagination/knowledge.md)

**seed**  
Seeds every registered table in order as the seed audit actor, respecting production mode. *Region:* [Database scripts and seeding](database-tooling/knowledge.md)

**SeedFile**  
A model's seed records: `model`, `records`, `updateOmitFields`, optional `createOnly`; upserted by id. *Region:* [Database scripts and seeding](database-tooling/knowledge.md)

**seeding**  
Class: SeedFile records, the seed runner (seed / seedTable) and prime dev data. *Region:* [Database scripts and seeding](database-tooling/knowledge.md)

**seeds/index.ts**  
The ordered list of SeedFiles; order must respect FK dependencies. *Region:* [Database scripts and seeding](database-tooling/knowledge.md)

**seedTable**  
Upserts one SeedFile's records through its model delegate. *Region:* [Database scripts and seeding](database-tooling/knowledge.md)

**Segment**  
A named set of one provider's CustomerRef rows, defined by a lens-validated rule in conditions. *Region:* [Customers and segments](customers-segments/knowledge.md)

**Segment-of-segment rule**  
A segment condition naming another segment; evaluated in dependency order and checked for cycles (findReferenceCycle). *Region:* [Customers and segments](customers-segments/knowledge.md)

**segmentConditions**  
Hook that requires, validates and normalizes Segment conditions against the owner's lens. *Region:* [Customers and segments](customers-segments/knowledge.md)

**segmentLensFor**  
Resolves the lens a segment owner's conditions are validated against. *Region:* [Template lenses](lenses/knowledge.md)

**SegmentMember**  
Junction linking one CustomerRef into a Segment, unique per pair, written only by reconciliation. *Region:* [Customers and segments](customers-segments/knowledge.md)

**segments**  
Class tag: provider-owned audiences with static/dynamic membership reconciliation. *Region:* [Customers and segments](customers-segments/knowledge.md)

**SegmentType**  
static (computed after create or rule change) or dynamic (also reacts to customer changes). *Region:* [Customers and segments](customers-segments/knowledge.md)

**self**  
{ self: field }: granted when record[field] equals the actor id. *Region:* [Permissions library (ReBAC engine)](lib-permissions/knowledge.md)

**send / resolve / read**  
The inquiry ReBAC actions: source-side send (create, edit, send, cancel), target-side resolve, either-side read. *Region:* [Inquiry model and handlers](inquiry-handlers/knowledge.md)

**sendEmail**  
Planner job: resolve entity, sender, template and recipients, find-or-create per-recipient CommunicationLog rows, enqueue deliverEmail. *Region:* [Email delivery and preferences](email-delivery/knowledge.md)

**senderLensOwner**  
Maps the sender to the organization tree that OrganizationUser/SpaceUser rows are clamped to at send. *Region:* [The email lens](email-lens/knowledge.md)

**SenderType**  
Who an email is sent as: platform, admin, User, Organization, Space, OrganizationUser, SpaceUser. *Region:* [Email delivery and preferences](email-delivery/knowledge.md)

**sendFrame**  
The only server send; closes the socket with 1013 when Bun's ws.send returns 0. *Region:* [WebSocket connections](ws-connections/knowledge.md)

**sendToChannel / sendToUser / broadcast**  
Cross-instance publishes to a channel's subscribers, one user's sockets, or everyone. *Region:* [WebSocket connections](ws-connections/knowledge.md)

**sendWebhook**  
Job handler delivering one event to one subscription: sign, POST, record, retry; skips poisoned records before signing. *Region:* [App events and webhooks](app-events-webhooks/knowledge.md)

**seq**  
Per-stream Redis counter (ws:seq:{stream}, per user for perRecipient) stamped on snapshots and appends for gap detection. *Region:* [WebSocket data streams](ws-data-streams/knowledge.md)

**__serialize**  
Factory entity helper that converts Date fields to ISO strings for API/SDK/UI-shaped assertions. *Region:* [Test factories, cleanup and test rules](test-factories-rules/knowledge.md)

**server**  
Shared MSW mock server for UI tests; per-test responses via server.use. *Region:* [Test harness, request helpers and VCR](test-harness/knowledge.md)

**Session**  
A BetterAuth login session for browser clients, stored in Redis via secondaryStorage. *Region:* [Authentication: sessions, providers, tokens](authentication/knowledge.md)

**setEnvOverride / withEnv**  
Schema-parsed env overrides for tests, persistent (reset by resetEnvOverrides) or scoped to one call. *Region:* [Test harness, request helpers and VCR](test-harness/knowledge.md)

**setIdentity**  
Attaches or replaces the user and header state on a socket. *Region:* [WebSocket connections](ws-connections/knowledge.md)

**setLogService**  
Process-wide constant fields stamped on every record. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**SettingsLayout**  
The settings pages' shared layout; settings are nested routes under it, not tabs. *Region:* [UI components and shared pages](ui-components/knowledge.md)

**settleTemplate**  
API entry that resolves a template through the cascade and renders subject and body with system tokens and RenderIssue collection. *Region:* [Email compose, render and save](email-render/knowledge.md)

**setupState / SetupState**  
'new' | 'stale' | 'incomplete' | 'complete', derived with useMemo via detectSetupState, never stored. *Region:* [Init script architecture and direction](init-architecture/knowledge.md)

**setUserContext**  
Stores user, organizationUsers and permissions-roles / permissions-rebac on the context from a loaded UserWithRelations. *Region:* [Request context and errors](request-context-errors/knowledge.md)

**shadowMerge**  
Computes the post-update record from previous state plus Prisma atomic ops (increment, push, …) so updates can be validated. *Region:* [Template rules and rule references](json-rules/knowledge.md)

**shadowMerge**  
Merges previous with update data, resolving increment/push/set, so rules validate the resulting row. *Region:* [Mutation hooks, immutable fields, ordered lists](mutation-hooks/knowledge.md)

**shareableUrl**  
usePaginatedData option putting page/search/orderBy in URL params for linkable views; default is history.state only. *Region:* [Offset and cursor pagination](pagination/knowledge.md)

**shouldSpill**  
Pure predicate: spill only when type is adhoc, not bypassed, and the lane is overflowing. *Region:* [Job lanes and overflow outbox](job-lanes-outbox/knowledge.md)

**show**  
Standard prop: boolean or () => boolean; false renders null. *Region:* [UI components and shared pages](ui-components/knowledge.md)

**Side**  
{ predicate, permission?, requires? } for the from or to end of a transition. *Region:* [Transitions library (lifecycle guards)](lib-transitions/knowledge.md)

**Side-matched includes**  
includeInquirySent / Received / Response: the include each acting side needs, so related rows come back in one call. *Region:* [Inquiry API and frontend](inquiry-routes-ui/knowledge.md)

**sidecar**  
The plain-markdown gloss file: # <source path>, optional preamble, ## <symbol> sections. *Region:* [Gloss (margin comments)](lib-gloss/knowledge.md)

**SignupForm**  
Sign-up form; shows the verification message on verification-pending. *Region:* [Frontend Authentication](frontend-auth/knowledge.md)

**SignUpResult**  
authenticated, verification-pending or redirecting. *Region:* [Frontend Authentication](frontend-auth/knowledge.md)

**--skip-db**  
worktree:create opt-out for docs-only worktrees: no databases, buckets, schema push or Docker. *Region:* [Dev setup and worktrees](dx-setup/knowledge.md)

**skipFieldValidation**  
Superadmin bypass of the field whitelist; path validation still applies. *Region:* [List filtering and search](filtering-search/knowledge.md)

**skipFlowInvalidate**  
Mutation meta that opts out of the automatic flow recheck. *Region:* [Guided flows](flows/knowledge.md)

**sleepUnlessShuttingDown / isShutdownInProgress**  
Shutdown-aware wait and check for loops. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**slice**  
A StateCreator<AppStore> returning one namespaced key (auth, tenant, ...) spread into useAppStore. *Region:* [Frontend store (Zustand slices)](frontend-store/knowledge.md)

**SLOW_LANE_PRIORITY**  
2^21 - 1, one below BullMQ's PRIORITY_LIMIT; explicit priorities are capped at it. *Region:* [Job lanes and overflow outbox](job-lanes-outbox/knowledge.md)

**slowLaneCheck.ts**  
Script validating lanes and the outbox against real infrastructure; needs ENVIRONMENT=local and SLOW_LANE_CHECK_CONFIRM=wipe. *Region:* [Job lanes and overflow outbox](job-lanes-outbox/knowledge.md)

**SlowSlotPool**  
Per-worker count of slots running slow jobs, capped at JOBS_SLOW_SLOT_FRACTION (at least one). *Region:* [Job lanes and overflow outbox](job-lanes-outbox/knowledge.md)

**SlugInput**  
Input that normalizes typed or pasted text to a slug. *Region:* [UI components and shared pages](ui-components/knowledge.md)

**soft-delete**  
Class: deletedAt tombstones, cascade and revive, and automatic soft-delete read scoping. *Region:* [Audit log and soft delete](audit-soft-delete/knowledge.md)

**softDeleteScopeExtension**  
Client extension that auto-injects `deletedAt: null` into reads, write wheres and nested includes. *Region:* [Audit log and soft delete](audit-soft-delete/knowledge.md)

**soundSegments**  
Filters a list to segments whose rules have no issues. *Region:* [Customers and segments](customers-segments/knowledge.md)

**source**  
The party that sends an inquiry; inferred from the route context, never from the body. *Region:* [Inquiry model and handlers](inquiry-handlers/knowledge.md)

**sourceMutations / targetMutations**  
Maps of which list queries to refetch after sender-side or recipient-side mutations. *Region:* [Inquiry API and frontend](inquiry-routes-ui/knowledge.md)

**SourceQuery**  
{ path, mapName, model, field, label?, groupBy?, composedWhere, prisma, sql, recheck? }. *Region:* [Lens option sources and bridges](lens-sources/knowledge.md)

**sourceQueryValues / sourceQueryWhere**  
Fetch a lens source's option values / build just its scoped where. *Region:* [Template lenses](lenses/knowledge.md)

**sourceRuleReferences**  
The generic include that loads a rule owner edges for ruleReferenceIssues; never a per-model include. *Region:* [Template rules and rule references](json-rules/knowledge.md)

**sources**  
A narrowing node's per-field declaration of where its selectable values come from. *Region:* [Lens option sources and bridges](lens-sources/knowledge.md)

**SourceSpec**  
A source entry { where?, label?, groupBy? }; a bare Condition is eligibility alone. *Region:* [Lens option sources and bridges](lens-sources/knowledge.md)

**SourceValues**  
A field's option set, attached by projectLens(…, { sourceValues }) as options. *Region:* [Lens option sources and bridges](lens-sources/knowledge.md)

**sourceValues**  
Fetched option values for sourced fields, keyed by path, passed into a view. *Region:* [rules-builder library README](lib-rules-builder/knowledge.md)

**sourceValues**  
Fetched option values for sourced fields, keyed by path, passed into a view. *Region:* [Rule builder: template usage](rules-builder/knowledge.md)

**Space**  
Sub-tenant container inside one Organization; its own permission scope. *Region:* [Tenancy and Superadmin](tenancy/knowledge.md)

**SpaceUser**  
A user's membership in one space; requires the matching OrganizationUser. *Region:* [Tenancy and Superadmin](tenancy/knowledge.md)

**Special owner values**  
Owner enum values with no FK: `default` (seeded base, all read) and `admin` (super-admin only). *Region:* [Schema conventions and reference data](data-modeling/knowledge.md)

**spillToOutbox**  
Routes every spill through the batching accumulator, which resolves on commit. *Region:* [Job lanes and overflow outbox](job-lanes-outbox/knowledge.md)

**Split schema**  
One .prisma file per model under packages/db/prisma/schema/, the source of truth for the database-client / data-modeling. *Region:* [Schema conventions and reference data](data-modeling/knowledge.md)

**spoofedBy**  
Context value holding the original superadmin behind a spoofed request, for audit. *Region:* [Tenancy and Superadmin](tenancy/knowledge.md)

**Spoofing**  
A superadmin acting as another user via x-spoof-user-email; the real actor is kept as spoofedBy. *Region:* [Auth middleware, validators and users](auth-middleware-users/knowledge.md)

**Spoofing**  
Superadmin impersonation via x-spoof-user-email; responses carry x-spoofing-user-email and x-spoofed-user-email. *Region:* [Tenancy and Superadmin](tenancy/knowledge.md)

**spoofMiddleware**  
Swaps the context user for the spoof target after auth resolves the superadmin. *Region:* [Tenancy and Superadmin](tenancy/knowledge.md)

**spy-must-restore**  
CI rule: every spyOn is restored (mock.restore) so tests cannot leak globals. *Region:* [Test factories, cleanup and test rules](test-factories-rules/knowledge.md)

**stable id tiebreaker**  
paginate() appends { id: desc } when no id ordering is given, so pages stay consistent on non-unique sorts. *Region:* [Offset and cursor pagination](pagination/knowledge.md)

**Staged job**  
A makeJob with ordered stages; each stage waits for the children it added, as a BullMQ flow parent. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**stale sweep**  
Server closes connections idle for more than 5 minutes (cleanupStaleConnections, startStaleSweep). *Region:* [WebSocket connections](ws-connections/knowledge.md)

**stamp rule**  
A path glob -> @kind or @partOf rule in config.ts; explicit annotations always win. *Region:* [Atlas code map (library + template usage)](lib-atlas/knowledge.md)

**StandardAction**  
The base action tiers read, operate, manage, own that resource action sets extend. *Region:* [Roles, actions and permission checks](permissions-roles/knowledge.md)

**start:<service>**  
Production run scripts (start:api, start:worker, start:web); local dev uses bun run local. *Region:* [Environments, env vars and deploy](environments-deploy/knowledge.md)

**startOutboxDrainLoop**  
Starts the per-worker ~2 s drain interval at worker startup; not a cron. *Region:* [Job lanes and overflow outbox](job-lanes-outbox/knowledge.md)

**startStreamReauthorizeSweep**  
Boot-time sweep that re-probes every open stream every 45s via x-auth-probe. *Region:* [WebSocket data streams](ws-data-streams/knowledge.md)

***Steps.ts**  
Per-provider step lists in init/tasks that drive both progress flags and the status list labels. *Region:* [Init script architecture and direction](init-architecture/knowledge.md)

**stepStates / currentStep**  
Computed per read, never stored: done/pending per step and the first step that does not hold. *Region:* [Guided flows](flows/knowledge.md)

**stitchFieldMaps**  
Inject bridge entries as kind: bridge fields on each endpoint model of a FieldMapSet. *Region:* [Using a lens: build, gate, fetch](lens-usage/knowledge.md)

**storage**  
The exported StorageClient adapter (apps/api/src/lib/storage) routed over createS3Client. *Region:* [Adapters, integrations and storage](adapters-integrations/knowledge.md)

**stored lens slot**  
A slot saved on the email row: a later layer that can only show what the declared surface allows. *Region:* [The email lens](email-lens/knowledge.md)

**StoredLens**  
The persisted form: one record per layer listing its parents, base lens first. *Region:* [The lens model](lens-model/knowledge.md)

**StoredLens**  
One record per layer with its parents; storeLens writes a composed lens out, composeLens reads it back and validates. *Region:* [Using a lens: build, gate, fetch](lens-usage/knowledge.md)

**storedValue**  
Resolves an enum member's stored DB value, honoring @map on members. *Region:* [Prisma-map and schema introspection](lib-prisma-map/knowledge.md)

**storeLens / composeLens**  
Write a composed lens out as records / read them back into the composed lens, validating each layer. *Region:* [The lens model](lens-model/knowledge.md)

**StrategyExecutor**  
The function signature each strategy implements, returning a BatchResult. *Region:* [Batch API](batch/knowledge.md)

**STREAM_DEFINITIONS**  
The shared registry of stream definitions (packages/shared/src/ws/streamDefinitions.ts) that server and client both import. *Region:* [WebSocket data streams](ws-data-streams/knowledge.md)

**STREAM_FOLDS**  
Maps each kind to its snapshot and op folds (listStream, logStream); folds must be idempotent. *Region:* [WebSocket data streams](ws-data-streams/knowledge.md)

**streamAppend**  
Builds a stream handoff from a shared STREAM_DEFINITIONS entry, its params, an op and a typed payload; upsert rows come from routeRow. *Region:* [App events and webhooks](app-events-webhooks/knowledge.md)

**streamAppend**  
Builds the branded stream handoff from a definition, params, op and payload; options carry revive and userIds. *Region:* [WebSocket data streams](ws-data-streams/knowledge.md)

**streamSeqKeyFor**  
Derives a stream's seq key from its definition's audience. *Region:* [WebSocket data streams](ws-data-streams/knowledge.md)

**streamSettleMs**  
100 ms per-stream debounce on client opens and closes so holder churn sends nothing. *Region:* [WebSocket connections](ws-connections/knowledge.md)

**StrictCondition**  
The strict rule shapes, pairing each operator with its operand type. *Region:* [Writing a json-rules rule](json-rules-shapes/knowledge.md)

**stub**  
A repo's tsconfig.json / biome.json / tsup.config.ts holding only extends plus reviewed overrides. *Region:* [Config package (toolchain, train)](lib-config/knowledge.md)

**Stub format**  
'> Stub - to be expanded' plus TODO sections for incomplete docs. *Region:* [Engineering process and docs](engineering-process-docs/knowledge.md)

**subject**  
The check input { resource, record, data? }, not a bare record. *Region:* [Permissions library (ReBAC engine)](lib-permissions/knowledge.md)

**subject.data**  
Far-side rows keyed map:model (the indexBridges shape), passed only when a bridge hop reads far fields. *Region:* [Permissions library (ReBAC engine)](lib-permissions/knowledge.md)

**submodel**  
Template arg for a nested resource, e.g. model 'organization', submodel 'token' → /:id/tokens. *Region:* [API routes, controllers and modules](api-routes/knowledge.md)

**Subscribe authorization**  
A channel subscribe is granted by probing the route behind it (resolveOperationRoute); only a 2xx grants. *Region:* [WebSocket channels and refetch hints](ws-channels/knowledge.md)

**substitute**  
Registry option naming an alternate template to send on render issues; substitutes cannot chain. *Region:* [Email compose, render and save](email-render/knowledge.md)

**subtype**  
Per-type rule for the subtype field: forbidden, optional or required. *Region:* [Messaging and contacts](messaging-contacts/knowledge.md)

**summary.status**  
Batch outcome: success, partialSuccess or failed; per-request result.error tells which failed. *Region:* [Batch API](batch/knowledge.md)

**superadmin**  
A classless cross-cutting concept tag: the backend admin surface is part of superadmin. *Region:* [Atlas code map (library + template usage)](lib-atlas/knowledge.md)

**superadmin**  
Class: the superadmin platform role, admin routes and the superadmin app. *Region:* [Tenancy and Superadmin](tenancy/knowledge.md)

**Superadmin app**  
apps/superadmin: communications, dashboard, settings and users routes for platform admins. *Region:* [Tenancy and Superadmin](tenancy/knowledge.md)

**supersede-lanes**  
Class tag: newest work for a key wins via claimLane/watchLane batons and superseding jobs. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**SupersededError**  
Thrown by a job replaced by newer lane work so it is not treated as a failure. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**sweepSegments**  
Nightly 04:00 UTC cron that queues sound dynamic segments in dependency order as the backstop. *Region:* [Customers and segments](customers-segments/knowledge.md)

**sync**  
Applies every check fix and re-locks; refuses a dirty tree without --force. *Region:* [Config package (toolchain, train)](lib-config/knowledge.md)

**sync-env**  
Creates .env.local/.env.test from the examples and appends missing keys without overwriting; run by setup. *Region:* [Dev setup and worktrees](dx-setup/knowledge.md)

**sync-env**  
bun run sync-env: creates .env.local/.env.test from examples and appends newly added keys. *Region:* [Encryption and secrets](encryption/knowledge.md)

**sync-env**  
Creates .env.local/.env.test from the examples and appends missing keys without overwriting existing values. *Region:* [Environments, env vars and deploy](environments-deploy/knowledge.md)

**syncConfig**  
Re-reads config into context; tasks call it (as onStepComplete) after each step instead of polling. *Region:* [Init script architecture and direction](init-architecture/knowledge.md)

**syncRuleReferenceEdges**  
The one writer of RuleReference edges: set-diff from the save path, targets locked, foreign rows refused. *Region:* [Template rules and rule references](json-rules/knowledge.md)

**syncRuleReferences**  
Email's content-shaped front: collects the rules in MJML and subject and hands their references down. *Region:* [Template rules and rule references](json-rules/knowledge.md)

**syncSegmentEdges**  
Segments' front: syncs edges from a segment's conditions in 'save' or 'rebuild' mode. *Region:* [Template rules and rule references](json-rules/knowledge.md)

**System tokens**  
Platform-provided {{system.*}} values such as unsubscribeUrl, platformName and webUrl. *Region:* [Email templates and components](email-templates/knowledge.md)

**SYSTEM_PROBE_SECRET / AUTH_PROBE_HEADER**  
Server-only probe credentials; the system secret exempts internal probes from the HTTP rate limiter. *Region:* [WebSocket connections](ws-connections/knowledge.md)

## T

**Table**  
Dumb renderer taking either pagination or infiniteScroll props, plus scrollRef, sectionId and data-key rows. *Region:* [Offset and cursor pagination](pagination/knowledge.md)

**Table**  
Column-defined list with empty state, pagination or infiniteScroll, sticky header, no virtualization. *Region:* [UI components and shared pages](ui-components/knowledge.md)

**tableName**  
Resolves a model's DB table name, honoring @@map. *Region:* [Prisma-map and schema introspection](lib-prisma-map/knowledge.md)

**Tag / TagCategory / TagAttachment**  
The tagging models; TagAttachment's resourceModel is a one-sided polymorphic slot. *Region:* [Schema conventions and reference data](data-modeling/knowledge.md)

**tag class**  
A /// @name(key: value) annotation, e.g. @tree(parent: true); meaning is up to the consumer. *Region:* [Prisma-map and schema introspection](lib-prisma-map/knowledge.md)

**target**  
The party that receives and resolves an inquiry. *Region:* [Inquiry model and handlers](inquiry-handlers/knowledge.md)

**targetedBySender**  
Bounds a messageUser rule from an Organization or Space sender to members the recipient lens shows. *Region:* [The email lens](email-lens/knowledge.md)

**targetedBySender**  
Restricts a recipient rule to users the sender's lens may reach. *Region:* [Messaging and contacts](messaging-contacts/knowledge.md)

**telemetry**  
Class: OpenTelemetry spans/metrics, browser telemetry, error reporter. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**telemetry.export.failed**  
Rate-limited warning record when an export batch is dropped. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**telemetryExtension**  
Prisma extension tracing every operation by model and operation. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**telemetryMiddleware**  
API request spans and metrics, skipping health and browser telemetry paths. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**Template args**  
model, submodel, action, many, paginate, admin, skipId, bodySchema, responseSchema, query, params, sanitizeKeys, filterLens, middleware. *Region:* [API routes, controllers and modules](api-routes/knowledge.md)

**@template/<pkg>/***  
Subpath alias for cross-package imports and for imports within a shared package. *Region:* [Monorepo layout and architecture](monorepo-architecture/knowledge.md)

**@template/db**  
packages/db: Prisma client, modular schema, hooks, extensions, encryption, Redis, test factories. *Region:* [Monorepo layout and architecture](monorepo-architecture/knowledge.md)

**@template/db-test**  
packages/db tsconfig alias to ./test/* for test utilities. *Region:* [Monorepo layout and architecture](monorepo-architecture/knowledge.md)

**@template/email**  
packages/email: MJML template storage, components, rendering, and Resend/console clients. *Region:* [Monorepo layout and architecture](monorepo-architecture/knowledge.md)

**@template/permissions**  
The template package that injects its Prisma-derived resolveRelation, rebacSchema and role mappings into this core. *Region:* [Permissions library (ReBAC engine)](lib-permissions/knowledge.md)

**@template/permissions**  
packages/permissions-roles / permissions-rebac: RBAC/ReBAC roles, checks, entitlements and context setup on permix. *Region:* [Monorepo layout and architecture](monorepo-architecture/knowledge.md)

**@template/sdk**  
Standalone API client package generated from the OpenAPI spec by hey-api, with types and TanStack query-key helpers. *Region:* [API client, SDK and query hooks](api-client/knowledge.md)

**@template/sdk**  
packages/sdk: hey-api client generated from openapi.gen.json with TanStack Query helpers. *Region:* [Monorepo layout and architecture](monorepo-architecture/knowledge.md)

**@template/shared**  
packages/shared: isomorphic utilities only (logger, errors, env flags, class-name utils). *Region:* [Monorepo layout and architecture](monorepo-architecture/knowledge.md)

**@template/ui**  
packages/ui: all frontend components, hooks, store slices, pages and auth utilities, organized by domain. *Region:* [Monorepo layout and architecture](monorepo-architecture/knowledge.md)

**@template/ui**  
Package holding all frontend components, hooks, store, pages and guards; @template/shared holds isomorphic code only. *Region:* [UI components and shared pages](ui-components/knowledge.md)

**tenancy**  
Class: Organizations, Spaces and memberships; Personal/Org/Space contexts. *Region:* [Tenancy and Superadmin](tenancy/knowledge.md)

**tenant context**  
tenant.context: type public | user | organization | space with the active organization/space. *Region:* [Navigation config and tenant context](navigation/knowledge.md)

**tenant.page**  
The record a page is about, set with tenant.setPage and passed to nav access checks. *Region:* [Navigation config and tenant context](navigation/knowledge.md)

**TenantSlice**  
Current context (public/user/organization/space) and the page record; setUser/setOrganization/setSpace/setPage. *Region:* [Frontend store (Zustand slices)](frontend-store/knowledge.md)

**terminal deny**  
null as an ActionRule: granted only via permix grants or row rules. *Region:* [Permissions library (ReBAC engine)](lib-permissions/knowledge.md)

**test-factories**  
Class: build/create factories and test tracker cleanup. *Region:* [Test factories, cleanup and test rules](test-factories-rules/knowledge.md)

**test-harness**  
Class: test structure, running tests, createTestApp, request helpers and frontend tests. *Region:* [Test harness, request helpers and VCR](test-harness/knowledge.md)

**test-rules**  
Class: rules for tests and their CI restrictions (no mocks, tracker registration, unhappy paths). *Region:* [Test factories, cleanup and test rules](test-factories-rules/knowledge.md)

**test:fe / test:init**  
Root scripts for frontend (SDK + routes regenerated, then shared/ui/app suites) and init/ tests. *Region:* [Test harness, request helpers and VCR](test-harness/knowledge.md)

**theme-layout**  
Class: the AppShell layout system (Page, overlays, panels) and the multi-tier theme. *Region:* [Layout system and theme](theme-layout/knowledge.md)

**Three rails**  
check (in memory), toPrisma (Prisma where) and executePrismaPlan: the same rule, evaluated three ways, with documented differences. *Region:* [Running, validating and typing rules](json-rules-runtime/knowledge.md)

**Three-layer permission model**  
PlatformRole, then membership Role mapped to StandardAction tiers, then entitlements that widen. *Region:* [Roles, actions and permission checks](permissions-roles/knowledge.md)

**three-tier theme**  
--app-* platform colors -> --space-* tenant overrides -> active tokens (--primary) that components use. *Region:* [Layout system and theme](theme-layout/knowledge.md)

**tickets/**  
Home for open questions and planned work, not docs/claude. *Region:* [Engineering process and docs](engineering-process-docs/knowledge.md)

**timeZone**  
The one zone per evaluation (a name or value source, default UTC) that localizes now, periods and zoneless dates. *Region:* [Writing a json-rules rule](json-rules-shapes/knowledge.md)

**tmp/**  
Gitignored directory for scratch files and experiments (tmp/AI_WORKSPACE for staged larger changes). *Region:* [Dev setup and worktrees](dx-setup/knowledge.md)

**tmp/AI_WORKSPACE/**  
Gitignored staging area (TASK.md, files/, notes/) for long analysis and larger reviewed changes. *Region:* [Engineering process and docs](engineering-process-docs/knowledge.md)

**toast / Toaster**  
App toast helper with defaults (use instead of sonner) and the container mounted once in __root. *Region:* [UI components and shared pages](ui-components/knowledge.md)

**Token**  
An API key row: keyHash (SHA-256), keyPrefix, ownerModel, role, entitlements, expiresAt, isActive. *Region:* [Authentication: sessions, providers, tokens](authentication/knowledge.md)

**tokenAuthMiddleware**  
Hashes a Bearer or URL key, looks it up (10-minute cache) and sets the token owner's context; runs before session auth. *Region:* [Auth middleware, validators and users](auth-middleware-users/knowledge.md)

**TokenOwnerModel**  
User, Organization, OrganizationUser, Space or SpaceUser. *Region:* [Authentication: sessions, providers, tokens](authentication/knowledge.md)

**toLensSelect**  
Prisma findMany select args for what a lens shows, plus the columns its clamps and sources read. *Region:* [Using a lens: build, gate, fetch](lens-usage/knowledge.md)

**tombstone**  
A soft-deleted row; cascade tombstones owned children with the parent's exact timestamp (the revive group). *Region:* [Audit log and soft delete](audit-soft-delete/knowledge.md)

**tombstones / revive**  
The list fold remembers the last 500 removed ids and ignores later upserts unless flagged revive. *Region:* [WebSocket data streams](ws-data-streams/knowledge.md)

**toolchain**  
Exact pins for @biomejs/biome, typescript, tsup and @types/bun, declared once at the root. *Region:* [Config package (toolchain, train)](lib-config/knowledge.md)

**toPrisma**  
Compile a rule into a Prisma query plan (steps); with { lens } it is gated and narrowed first. *Region:* [Compiling rules to Prisma and SQL](json-rules-backends/knowledge.md)

**toSourceQueries**  
Compile a lens's sources to one DISTINCT query per sourced field, in Prisma and SQL form. *Region:* [Lens option sources and bridges](lens-sources/knowledge.md)

**toSql**  
Compile a rule into a parameterized PostgreSQL WHERE fragment plus LEFT JOINs (not a whole query). *Region:* [Compiling rules to Prisma and SQL](json-rules-backends/knowledge.md)

**ToSqlResult**  
toSql's { sql, params, joins }. *Region:* [Compiling rules to Prisma and SQL](json-rules-backends/knowledge.md)

**traceJob**  
Wraps a job's execution in a span linked to the enqueuer's trace. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**train**  
The release cascade: bump, re-lock, check, commit, publish, bless, ship config last. *Region:* [Config package (toolchain, train)](lib-config/knowledge.md)

**train.lock**  
~/.inixiative/train.lock, the machine-wide lock allowing one train at a time. *Region:* [Config package (toolchain, train)](lib-config/knowledge.md)

**transactionAll**  
Strategy: all rounds in one transaction; any failure rolls everything back; partialSuccess impossible. *Region:* [Batch API](batch/knowledge.md)

**transactionPerRound**  
Strategy: each round in its own transaction; earlier rounds stay committed if a later one fails. *Region:* [Batch API](batch/knowledge.md)

**Transition**  
One atomic from -> to edge; disjunction never lives inside it. *Region:* [Transitions library (lifecycle guards)](lib-transitions/knowledge.md)

**triggerCronJob**  
Runs a stored cron's handler now (POST /api/admin/cronJob/:id/trigger, optional { lane }). *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**Trimming real completion**  
Underbuilding a requested primitive: a v1 that forces a v2, hardcoded parameters, a skipped setup/test API. *Region:* [Engineering process and docs](engineering-process-docs/knowledge.md)

**tsconfig base / node / react**  
@inixiative/config tsconfig presets a workspace tsconfig extends. *Region:* [Scripts, lint and build tooling](dx-tools/knowledge.md)

**tsconfig paths**  
Relative path mappings (no baseUrl) in every package for every @template package. *Region:* [Monorepo layout and architecture](monorepo-architecture/knowledge.md)

**tsup node / react**  
@inixiative/config tsup presets a package's tsup config calls instead of spelling out options. *Region:* [Scripts, lint and build tooling](dx-tools/knowledge.md)

**turbo watch local#<app>**  
Runs one app (api, web, admin, superadmin), or local:worker#api for the worker, with workspace watching. *Region:* [Dev setup and worktrees](dx-setup/knowledge.md)

**Two wheres**  
A collection facet's fixed where (its identity, matched on rehydration) versus defaultWhere (editable array-traversal operators). *Region:* [rules-builder library README](lib-rules-builder/knowledge.md)

**Two-phase render**  
Compose once per template through the cascade, then interpolate per recipient. *Region:* [Email compose, render and save](email-render/knowledge.md)

**txn**  
The transaction client name, not tx or transaction. *Region:* [Naming and code style](conventions/knowledge.md)

**type over interface**  
Object shapes are declared with type aliases. *Region:* [Naming and code style](conventions/knowledge.md)

**typecheck / typecheck:fe**  
Whole-repo type check / frontend apps only, after regenerating routes. *Region:* [Scripts, lint and build tooling](dx-tools/knowledge.md)

**Typed model IDs**  
Branded string types such as `UserId` with constructors like `userId(id)` that stop mixing IDs of different models. *Region:* [Schema conventions and reference data](data-modeling/knowledge.md)

**TypedBuildResult**  
Type declaring which context entries a factory guarantees. *Region:* [Test factories, cleanup and test rules](test-factories-rules/knowledge.md)

## U

**ui-components**  
Class: packages/ui primitives, settings pages, modals and the standard conditional props. *Region:* [UI components and shared pages](ui-components/knowledge.md)

**UISlice**  
Theme preference, global loading flag and app identity from VITE_ env. *Region:* [Frontend store (Zustand slices)](frontend-store/knowledge.md)

**Understand the Why First**  
ENTRYPOINT §0.1: state what a thing is for before changing how it works; intent hints are ground truth. *Region:* [Engineering process and docs](engineering-process-docs/knowledge.md)

**unique**  
Handler flag: 'targeted' = one open inquiry per source+target+type, 'untargeted' = per source+type. *Region:* [Inquiry model and handlers](inquiry-handlers/knowledge.md)

**uniqueness**  
Per-type scope of valueKey uniqueness: global-within-type or per-owner. *Region:* [Messaging and contacts](messaging-contacts/knowledge.md)

**Unsubscribe link**  
Stateless HMAC capability bound to {userId, contactId, kind}, served by a POST-only pre-auth route with RFC 8058 headers. *Region:* [Email delivery and preferences](email-delivery/knowledge.md)

**updateOmitFields**  
Fields a re-seed never overwrites on update, e.g. `createdAt`. *Region:* [Database scripts and seeding](database-tooling/knowledge.md)

**updateRoute**  
Route template for mutating an existing record by id. *Region:* [API routes, controllers and modules](api-routes/knowledge.md)

**upsertCache**  
Write a value already in hand into the cache. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**upserting: true**  
findForUpdate option for create-if-missing; where must be scalar equalities only. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**URL State Sync**  
Current context carried in ?org=orgId and ?space=spaceId for shareable links. *Region:* [Tenancy and Superadmin](tenancy/knowledge.md)

**URL token**  
?token=<key> fallback for WebSocket upgrades, email links and downloads. *Region:* [Auth middleware, validators and users](auth-middleware-users/knowledge.md)

**URL token**  
?token=<key> fallback for WebSocket upgrades, email links and downloads. *Region:* [Authentication: sessions, providers, tokens](authentication/knowledge.md)

**UsageError**  
The caller's input is missing or malformed: no `now` for a relative date, an invalid `now` or zone, an unbound bind. *Region:* [json-rules dates, windows and verbs](json-rules-dates/knowledge.md)

**UsageError**  
Thrown for caller-input faults: missing now, invalid time zone, an unbound bind. *Region:* [Running, validating and typing rules](json-rules-runtime/knowledge.md)

**useActiveFlow**  
Reads the active flow from the React Query cache, keyed by navigation.flowId. *Region:* [Guided flows](flows/knowledge.md)

**useApiWebsocket**  
Hook mounted once at each app root; subscriptions follow the query cache. *Region:* [WebSocket connections](ws-connections/knowledge.md)

**useAppStore**  
The one shared Zustand store hook from @template/ui/store used by web, admin and superadmin. *Region:* [Frontend store (Zustand slices)](frontend-store/knowledge.md)

**useAuthenticatedRouting**  
Syncs ?org=/?space= with the tenant slice, matches the route and runs access with context fallback. *Region:* [Navigation config and tenant context](navigation/knowledge.md)

**useAuthProviders**  
Lists login providers: organizationReadAuthProvider with ?org=, else authProviderReadMany. *Region:* [Frontend Authentication](frontend-auth/knowledge.md)

**useAuthStrategy**  
Reads the login vs embed auth strategy from AuthStrategyProvider. *Region:* [Frontend Authentication](frontend-auth/knowledge.md)

**useConfig**  
Hook returning { config, syncConfig } inside init views. *Region:* [Init script architecture and direction](init-architecture/knowledge.md)

**useDarkMode / useThemePersistence**  
Apply .dark on <html> from ui.theme; load/save ui.theme in localStorage. *Region:* [Layout system and theme](theme-layout/knowledge.md)

**useDataFilters / useQueryMetadata**  
Frontend filter state for a list view, and the hook that reads an operation's filter metadata in a component. *Region:* [List filtering and search](filtering-search/knowledge.md)

**useDebounce**  
Debounces a value; useDebouncedCallback debounces a function; only for backend-hitting inputs. *Region:* [API client, SDK and query hooks](api-client/knowledge.md)

**useDebounce**  
React hook that delays a changing value before it triggers backend requests. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**useDebouncedCallback**  
React hook that debounces a function call; has .cancel(). *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**useEmailRuleSurface / useEmailVariableScope**  
UI hooks: a template's rule surface by slug and locale; the variables in scope for a rule source. *Region:* [The email lens](email-lens/knowledge.md)

**useEventRefetch**  
Refetches queries when a named app event fires; pairs with useAppEvents emitters. *Region:* [API client, SDK and query hooks](api-client/knowledge.md)

**useFilteredCollection**  
Builder plus in-memory check() over rows fetched whole, for display-only narrowing. *Region:* [rules-builder library README](lib-rules-builder/knowledge.md)

**useFilteredCollection**  
Builder plus in-memory check() over rows fetched whole, for display-only narrowing. *Region:* [Rule builder: template usage](rules-builder/knowledge.md)

**useInfiniteData**  
Frontend hook for infinite-scroll lists: filters plus TanStack infinite query, scroll restore, infiniteScrollProps. *Region:* [Offset and cursor pagination](pagination/knowledge.md)

**useInfiniteDataQuery**  
Low-level TanStack infinite query wrapper without filter state. *Region:* [Offset and cursor pagination](pagination/knowledge.md)

**useInfiniteScrollTrigger**  
IntersectionObserver sentinel that calls onLoadMore when it scrolls into view. *Region:* [Offset and cursor pagination](pagination/knowledge.md)

**useLensScopeSurface / useLensValuePicker**  
Hooks exposing a lens's scope surface and value choices to pickers in the builder UI. *Region:* [Rule builder: template usage](rules-builder/knowledge.md)

**useMediaQuery / useBreakpoint**  
Arbitrary media query match; named Tailwind breakpoint match. *Region:* [UI components and shared pages](ui-components/knowledge.md)

**useOptimisticMutation**  
Mutation hook that applies targets' optimisticUpdate, rolls back on error, reconciles and invalidates on settle. *Region:* [API client, SDK and query hooks](api-client/knowledge.md)

**usePageMeta / useBreadcrumbs**  
Document title/description and breadcrumb trail derived from the matched nav item chain. *Region:* [Navigation config and tenant context](navigation/knowledge.md)

**usePaginatedData**  
Frontend hook for page-numbered tables: filters plus page/pageSize, paginationProps(total), scroll restore, URL sync. *Region:* [Offset and cursor pagination](pagination/knowledge.md)

**usePermission**  
UI hook returning { show, disable, disabledText } for an action on a record. *Region:* [Roles, actions and permission checks](permissions-roles/knowledge.md)

**User**  
A person's platform identity: email, platformRole and owned relations. *Region:* [Auth middleware, validators and users](auth-middleware-users/knowledge.md)

**useRegisterNavigation**  
Stores the app's nav config and router navigate in the navigation slice, once in __root. *Region:* [Navigation config and tenant context](navigation/knowledge.md)

**userEmailContact**  
After-create hook giving every User an email Contact so preferences exist. *Region:* [Messaging and contacts](messaging-contacts/knowledge.md)

**users**  
Class: User lookup and guest creation, /me routes, email normalization and redaction. *Region:* [Auth middleware, validators and users](auth-middleware-users/knowledge.md)

**@uses**  
Load-bearing dependency on a concept the file is not part of; never auto-stamped. *Region:* [Atlas code map (library + template usage)](lib-atlas/knowledge.md)

**@uses none**  
Curated-empty: someone looked and the file uses nothing load-bearing. *Region:* [Atlas code map (library + template usage)](lib-atlas/knowledge.md)

**@uses?**  
A proposed @uses value from the patcher awaiting acceptance. *Region:* [Atlas code map (library + template usage)](lib-atlas/knowledge.md)

**useScrollState**  
Persists an element's scroll position to history.state so back/forward restores it. *Region:* [Offset and cursor pagination](pagination/knowledge.md)

**useSectionHash**  
Mounted once at the app root; syncs the URL hash with the most visible data-section and supports #section.key deep links. *Region:* [Offset and cursor pagination](pagination/knowledge.md)

**useSectionHash / useSectionOpen**  
Keep visible section or a section's/modal's open state in the URL hash. *Region:* [Navigation config and tenant context](navigation/knowledge.md)

**useShallow**  
zustand v5 wrapper required for object selectors, otherwise the component re-renders forever. *Region:* [Frontend store (Zustand slices)](frontend-store/knowledge.md)

**useSpaceTheme**  
Sets --space-* CSS properties from a SpaceTheme; not yet wired by any app. *Region:* [Layout system and theme](theme-layout/knowledge.md)

**useStartFlow**  
Client hook that starts a flow and returns { started, flow }; started is false when already complete. *Region:* [Guided flows](flows/knowledge.md)

**useStream / useStreamAction**  
Hooks for a stream's folded snapshot as a query result, and for a side-effect listener on one op. *Region:* [WebSocket data streams](ws-data-streams/knowledge.md)

**useValidateUniqueness**  
Checks a field (e.g. organization slug) is free via the lookup query param; 404 means available; excludeId when editing. *Region:* [API client, SDK and query hooks](api-client/knowledge.md)

**util / services / handlers**  
util not helper; services for backend logic; handlers only for jobs and frontend events. *Region:* [Naming and code style](conventions/knowledge.md)

**UUIDv7**  
Time-sortable primary key: `@default(dbgenerated("uuidv7()")) @db.VarChar(36)`. *Region:* [Schema conventions and reference data](data-modeling/knowledge.md)

**UUIDv7 validation**  
The seed runner rejects ids that are not valid, unique UUIDv7. *Region:* [Database scripts and seeding](database-tooling/knowledge.md)

**uuidV7Schema**  
Shared zod schema (and isUuidV7 guard) for the typed UUIDv7 ids every model uses. *Region:* [Request schemas and OpenAPI](api-schemas-openapi/knowledge.md)

## V

**validate → apply → execute**  
The flow for every rule entering execution: validateRuleInLens, then narrowRule, then toPrisma / toSql / check. *Region:* [Using a lens: build, gate, fetch](lens-usage/knowledge.md)

**validate:encryption**  
The CI script ENCRYPTION.md describes; it does not exist yet in template. *Region:* [Encryption and secrets](encryption/knowledge.md)

**validateEncryptionVersions**  
Pre-deploy check returning { valid, errors } for version downgrades, jumps, mixed-version bumps and bad keyrings; not yet wired into any script or CI. *Region:* [Encryption and secrets](encryption/knowledge.md)

**validateJobId**  
Throwing guard for custom job ids BullMQ would reject (':' separators, '0'); isValidJobId is the boolean form. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**validateMjml / MjmlValidationError**  
MJML validation at save; components skip the full-document check; failures throw MjmlValidationError. *Region:* [Email compose, render and save](email-render/knowledge.md)

**validateNarrowing**  
Check a narrowing chain at construction; returns { ok, errors } with codes such as not_visible and wrong_kind. *Region:* [The lens model](lens-model/knowledge.md)

**validateNotLastOwner**  
Blocks removing or demoting an organization's last owner. *Region:* [Tenancy and Superadmin](tenancy/knowledge.md)

**validatePathNotation**  
Rejects unsafe, snake_case, underscore-prefixed or too-deep (MAX_PATH_DEPTH 5) dotted paths. *Region:* [List filtering and search](filtering-search/knowledge.md)

**validatePermission**  
Route middleware: hydrate the loaded resource and run check for an action; 403 on failure. *Region:* [Roles, actions and permission checks](permissions-roles/knowledge.md)

**validateRule / assertValidRule**  
Check a rule shape and that it runs on a target; the first returns issues, the second throws. *Region:* [Running, validating and typing rules](json-rules-runtime/knowledge.md)

**validateRuleForLens**  
The template's one shared rule gate (packages/db): grammar, vocabulary and open arms against a lens, optionally compile-probing. *Region:* [Template rules and rule references](json-rules/knowledge.md)

**validateRuleInLens**  
The security gate: every field path, relation crossed and enum value of a rule must resolve through the narrowed lens. *Region:* [Using a lens: build, gate, fetch](lens-usage/knowledge.md)

**validateSuperadmin**  
Middleware: 403 unless the user's platformRole is superadmin; mounted on the admin router. *Region:* [Tenancy and Superadmin](tenancy/knowledge.md)

**validateTransition**  
Authoring validation of predicates, merge and permission shape; returns ValidationResult and never throws. *Region:* [Transitions library (lifecycle guards)](lib-transitions/knowledge.md)

**validateWebhookUrl**  
Rejects unsafe user-supplied target URLs (private addresses; relaxed in non-enforced envs); isPrivateAddress and hostnameOf are its building blocks. *Region:* [App events and webhooks](app-events-webhooks/knowledge.md)

**ValidationResult**  
json-rules' { ok, errors: { path, message, code }[] }; transitions adds codes like missing_side and invalid_merge. *Region:* [Transitions library (lifecycle guards)](lib-transitions/knowledge.md)

**validations/**  
Module folder for cross-field and business-invariant checks, called with .parse() from the controller. *Region:* [API routes, controllers and modules](api-routes/knowledge.md)

**validations/**  
Module folder for cross-field and business-invariant checks, called with .parse() from the controller. *Region:* [Request schemas and OpenAPI](api-schemas-openapi/knowledge.md)

**ValueControl**  
The value input descriptor: options, shape and kind signals for choosing the right widget. *Region:* [rules-builder library README](lib-rules-builder/knowledge.md)

**ValueControl**  
The value input descriptor: options, shape and kind signals for choosing the right widget. *Region:* [Rule builder: template usage](rules-builder/knowledge.md)

**valueKey**  
Canonical projection of a contact value (E.164, classifier:handle) used for per-owner uniqueness and lookup. *Region:* [Messaging and contacts](messaging-contacts/knowledge.md)

**Variable / VariableSlot**  
A preset's tunable value domain (default, options, range) and where it sits in the rule. *Region:* [rules-builder library README](lib-rules-builder/knowledge.md)

**Variable / VariableSlot**  
A preset's tunable value domain (default, options, range) and where it sits in the rule. *Region:* [Rule builder: template usage](rules-builder/knowledge.md)

**vcr**  
Class: VCR record/replay of external provider calls. *Region:* [Test harness, request helpers and VCR](test-harness/knowledge.md)

**VCR**  
@template/shared/vcr wrapper: capture passes through outside tests, replays or records sanitized cassettes in tests. *Region:* [Test harness, request helpers and VCR](test-harness/knowledge.md)

**vcr.queue / vcr.capture**  
Queue the cassette a test expects, then capture replays it (or records a sanitized one when missing or stale). *Region:* [Test harness, request helpers and VCR](test-harness/knowledge.md)

**verb**  
One operation of the engine with one public name per thing it applies to and one implementing module (VERBS.md). *Region:* [json-rules dates, windows and verbs](json-rules-dates/knowledge.md)

**VERBS.md**  
The json-rules rule of one verb, one public name and one implementation per operation, enforced by test/verbs.test.ts. *Region:* [Writing a json-rules rule](json-rules-shapes/knowledge.md)

**Verification**  
Short-lived verification values such as email verification tokens. *Region:* [Authentication: sessions, providers, tokens](authentication/knowledge.md)

**Verification discipline**  
ENTRYPOINT §0.5: verify before asserting, no deferral as escape hatch, exhaust validation before caveating. *Region:* [Engineering process and docs](engineering-process-docs/knowledge.md)

**versions.json**  
@inixiative/config bill of materials pinning bun, the toolchain and blessed ecosystem versions. *Region:* [Scripts, lint and build tooling](dx-tools/knowledge.md)

**versions.json**  
The BOM: blessed bun, toolchain pins, required packages, lane sets, consumers and candidates. *Region:* [Config package (toolchain, train)](lib-config/knowledge.md)

**view**  
The field surface the builder reads, built by createView, rawView or resolve; a LensView lists fields at a dotted path. *Region:* [Rule builder: template usage](rules-builder/knowledge.md)

**viewState / ViewState**  
UI screen names only; never execution states like 'running'. *Region:* [Init script architecture and direction](init-architecture/knowledge.md)

**visitCondition / mapCondition**  
The one structural walk over a condition tree (src/traverse.ts); never hand-roll a descent. *Region:* [json-rules dates, windows and verbs](json-rules-dates/knowledge.md)

## W

**wait-postgres.sh / wait-redis.sh**  
Readiness waits for scripts; local:db already waits via --wait. *Region:* [Dev setup and worktrees](dx-setup/knowledge.md)

**walkEmailLensPath**  
Walks a token or rule path through the email lens's narrowing. *Region:* [The email lens](email-lens/knowledge.md)

**walkLensPath**  
Resolve one dotted path through a lens hop by hop: resolved, hidden, missing or pastScalar. *Region:* [Using a lens: build, gate, fetch](lens-usage/knowledge.md)

**warn-only rollout**  
atlas check --warn-only, then atlas check <path>, then full enforcement. *Region:* [Atlas code map (library + template usage)](lib-atlas/knowledge.md)

**watchLane**  
Polls a lane via heartbeat and fires onUsurped when a different holder appears. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**web / admin / superadmin**  
The three frontend apps: consumer/participant, operator, and platform-operations (user-context first, locked selector). *Region:* [Frontend apps, routes and layouts](frontend-apps-routing/knowledge.md)

**webhookDelivery**  
The after-commit db hook that finds a model's active subscriptions and enqueues one sendWebhook job per subscription. *Region:* [App events and webhooks](app-events-webhooks/knowledge.md)

**webhookEnabledModels**  
Registry of models whose mutations fire outbound webhooks (currently CustomerRef). *Region:* [App events and webhooks](app-events-webhooks/knowledge.md)

**WebhookEvent**  
One delivery attempt: status (pending/sent/failed), payload, HTTP status and response; cleaned after 90 days. *Region:* [App events and webhooks](app-events-webhooks/knowledge.md)

**webhookModelSubscribers**  
Inverse of webhookOwnerAllowedModels: from a changed model to the owner kinds that may receive it. *Region:* [App events and webhooks](app-events-webhooks/knowledge.md)

**webhookOwnerAllowedModels**  
Declares which models each owner kind (User, Organization, Space) may subscribe to; edit here to permit a new subscription. *Region:* [App events and webhooks](app-events-webhooks/knowledge.md)

**webhookRelatedModels**  
Maps a model to related records (FlexibleRef) whose changes fire its webhooks. *Region:* [App events and webhooks](app-events-webhooks/knowledge.md)

**webhooks**  
Class: outbound webhooks: subscriptions, signed delivery jobs, delivery history, URL safety, circuit breaker. *Region:* [App events and webhooks](app-events-webhooks/knowledge.md)

**WebhookSubscription**  
A User/Organization/Space-owned URL subscribed to a WebhookModel, unique per owner, model and url, with isActive and an optional integrationId. *Region:* [App events and webhooks](app-events-webhooks/knowledge.md)

**webhookUrlSchema**  
Zod wrapper over validateWebhookUrl for subscription request bodies. *Region:* [App events and webhooks](app-events-webhooks/knowledge.md)

**websocket.resync / streamResync**  
Client re-open for a fresh snapshot after a gap; server signal telling holders on every instance to re-open after a sequencing error. *Region:* [WebSocket data streams](ws-data-streams/knowledge.md)

**Where the Rails Differ**  
The README list of engine differences: case mapping, collation order, non-array Json. *Region:* [Compiling rules to Prisma and SQL](json-rules-backends/knowledge.md)

**Where to Find Things**  
MONOREPO.md table mapping each kind of code (routes, hooks, jobs, schema, context, factories) to its directory. *Region:* [Monorepo layout and architecture](monorepo-architecture/knowledge.md)

**WhereScope**  
The type a scopeNarrowing callback returns (root where/relations, mapDefaults). *Region:* [List filtering and search](filtering-search/knowledge.md)

**// why:**  
Inline comment for a load-bearing constraint the code cannot show; the one prose comment allowed in source. *Region:* [Gloss (margin comments)](lib-gloss/knowledge.md)

**wildcard key**  
A cacheKey with the wildcard flag, ending in :*, to clear a family of keys. *Region:* [Redis, caching and rate limits](redis-caching-rate-limits/knowledge.md)

**windowing**  
filter → orderBy → skip → take on array and aggregate rules, applied before the predicate. *Region:* [Writing a json-rules rule](json-rules-shapes/knowledge.md)

**with-env**  
bun run with <env> <app> <command>: injects Infisical secrets for cloud envs, sources .env files for local/test. *Region:* [Encryption and secrets](encryption/knowledge.md)

**with-env.sh**  
scripts/deployment/with-env.sh behind `bun run with <env> <app> <cmd>`: Infisical for cloud envs, root then app .env files for local/test. *Region:* [Environments, env vars and deploy](environments-deploy/knowledge.md)

**withAllRelations**  
Turn every relation on in a source's first layer — the posture of a raw record or a first-layer grant. *Region:* [Rule builder: template usage](rules-builder/knowledge.md)

**withLanePriority**  
Applies SLOW_LANE_PRIORITY to slow adds so fast work is always picked first; an ordering, not a lock. *Region:* [Job lanes and overflow outbox](job-lanes-outbox/knowledge.md)

**withLogContext**  
Adds named searchable fields to every log emitted within an async call. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**withOverflowRenew**  
Keeps the overflow flags' TTLs alive while a long drain pass runs. *Region:* [Job lanes and overflow outbox](job-lanes-outbox/knowledge.md)

**withOwnerLock**  
Owner-scoped lock taken before the transaction opens to serialize cross-row writes; not re-entrant, 409 on timeout. *Region:* [Concurrency, locks and lanes](concurrency-locks/knowledge.md)

**withRule**  
The one fork for evaluating a stored rule: degraded (issue, never a match) or sound (evaluate). *Region:* [The email lens](email-lens/knowledge.md)

**withRule**  
The one fork every stored rule is evaluated through: the sound arm runs, or the degraded arm reports why. *Region:* [Template rules and rule references](json-rules/knowledge.md)

**withSpan**  
Wraps an async unit of work in a named span. *Region:* [Logging, telemetry, shutdown](observability-lifecycle/knowledge.md)

**WorkerContext**  
Handler context: scoped db, queue, BullMQ job, optional signal, and log. *Region:* [Background jobs and cron](jobs-cron/knowledge.md)

**worktree slot**  
A number 1-9 in .worktrees/.slots/<N> and WORKTREE_SLOT that owns a worktree's ports, databases, buckets and Redis DB. *Region:* [Dev setup and worktrees](dx-setup/knowledge.md)

**worktrees**  
Class: worktree lifecycle through the repo scripts, with slots and per-slot DBs/ports. *Region:* [Dev setup and worktrees](dx-setup/knowledge.md)

**writeData**  
Extracts the written rows from hook args across single, bulk and upsert actions. *Region:* [Mutation hooks, immutable fields, ordered lists](mutation-hooks/knowledge.md)

**ws-channels**  
Class tag: refetch channels, the default real-time lane. *Region:* [WebSocket channels and refetch hints](ws-channels/knowledge.md)

**ws-connections**  
Class: the WebSocket connection: upgrade, authenticate frame and identity, registry, frame limits, heartbeat, stale sweep, senders, client reconnect. *Region:* [WebSocket connections](ws-connections/knowledge.md)

**ws-data-streams**  
Class tag: incremental data streams over the socket. *Region:* [WebSocket data streams](ws-data-streams/knowledge.md)

**ws:broadcast**  
The Redis pub/sub channel that fans a hint out to every API instance. *Region:* [WebSocket channels and refetch hints](ws-channels/knowledge.md)

**ws:broadcast**  
Redis pub/sub channel that carries sendToChannel, sendToUser, appendToStream and broadcast to every API instance. *Region:* [WebSocket connections](ws-connections/knowledge.md)

**WS_CHANNELS**  
Registry of authorized query-channel families with typed name() builders. *Region:* [WebSocket channels and refetch hints](ws-channels/knowledge.md)

**WS_FRAME_LIMIT / WS_FRAME_WINDOW_MS**  
Shared per-connection frame-rate limit; fast stream churn past it closes the socket. *Region:* [WebSocket connections](ws-connections/knowledge.md)

**WS_MAX_PENDING_FRAMES**  
Cap on a connection's queue of unprocessed frames; a frame past it gets a retryable error. *Region:* [WebSocket connections](ws-connections/knowledge.md)

**WSEvent**  
The wire contract: a hint or a stream frame, never persisted or replayed. *Region:* [WebSocket channels and refetch hints](ws-channels/knowledge.md)

**WSEvent**  
The inbound event shape: query-refetch hints and data-stream frames, dispatched by category and action. *Region:* [WebSocket connections](ws-connections/knowledge.md)

**WSHandoff**  
WebSocket handoff: kind 'channels' or 'users' with a message (refetch hints), or kind 'stream' with an append built by streamAppend. *Region:* [App events and webhooks](app-events-webhooks/knowledge.md)

**WSHandoff**  
What an app-event websocket handler returns: a message handoff ({ channels } or { userIds }) or a stream handoff from streamAppend. *Region:* [WebSocket channels and refetch hints](ws-channels/knowledge.md)

## X

**x-auth-probe**  
Cheap re-authorization path: middleware runs, the controller does not. *Region:* [WebSocket data streams](ws-data-streams/knowledge.md)

**X-Batch-Id**  
Header marking a batch sub-request; it carries the batch id to the registry and makes nested batches detectable (rejected). *Region:* [Batch API](batch/knowledge.md)

**x-webhook-signature**  
Base64 RSA-SHA256 signature of the timestamped body; receivers verify with the public key at /webhookSubscription/info. *Region:* [App events and webhooks](app-events-webhooks/knowledge.md)

## Y

**YAGNI both ways**  
ENTRYPOINT §0.3: overbuilding and underbuilding are equal failures; flag real judgment calls. *Region:* [Engineering process and docs](engineering-process-docs/knowledge.md)

## Z

**ZodEffects**  
What .refine() produces; it breaks hono-zod-openapi, so route schemas never use .refine(). *Region:* [Request schemas and OpenAPI](api-schemas-openapi/knowledge.md)
