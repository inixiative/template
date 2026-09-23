# FEAT-003: Feature Flags — typed values selected by ordered segment rules over a provider's customers

**Status**: 🆕 Not Started (design settled 2026-09-17)
**Assignee**: TBD
**Priority**: High
**Created**: 2026-02-06
**Updated**: 2026-09-17

> A flag is a slug owned by a provider that resolves to a typed value for each of that provider's customers. Variants are the flag's rules, one row each, evaluated in position order; every rule is "the subject is a member of this segment", and nothing else. Audiences are FEAT-021 segments — shared ones the owner named, or ones defined internal and owned by the variant — and membership is the only thing ever materialized. v1 ships **platform flags** (bare slug, owned by the platform) and **custom flags** (`custom:` slug, owned by any provider); a flag resolves only against its own row. What the platform turning something on means for the providers and customers below it — the delegation chain — is undefined today and is FEAT-022, not this ticket. The February stub and the TODO.md "Feature Flag Design Concept" it pointed at are superseded by this ticket; that concept was never a complete spec.

---

## Decisions

- **A flag chooses a value; a segment names an audience; a variant joins the two.** A variant does not carry a rule. If it did, keeping its answer fresh would need a trigger hook on every model the lens reaches, a set rail, an entity rail, a sweep and degraded-reference handling — FEAT-021's machinery, keyed by variant. That machinery exists exactly once, so the variant's audience *is* a `Segment` row, and everything a segment already has — reconcile, `segment.membershipChanged`, `estimateSegmentReach`, `withRule` degradation, the lens — the flag gets for free. No allowlist / blocklist columns, no weight column, no enrollment table, no rule JSON on the variant.
- **Materialize membership; values are a fold.** With variants attached to segments, membership is already materialized as `SegmentMember`. What remains at read time is a fold — walk the variants in order, look up membership, stop at the first match — and a fold is stateless, so this design stores nothing further. A stored per-subject value would have to be recomputed on every flag edit across every subject; that fan-out is the second reconcile domain this ticket refuses to build. Stored *assignments* (fixed participation across rule edits) are a different thing and are not needed here: a static sampled segment already fixes participation, and a dynamic one is meant to move.
- **Internal segments are owned by the variant and hidden — and the hiding is enforced at the save gate, not only in the picker.** An audience nobody has named yet ("orgs in segment S on plan X", "a random 20%") has to be named by somebody; the only question is where it lives. A segment defined from a variant keeps its provider ownership (`ownerModel` + FK, as any segment) and additionally carries `Segment.featureFlagInternal`; the variant's `segmentId` is the only edge between the two. It is tombstoned with the variant, edited only through it, and excluded from the owner's segment list and every picker. Because the API also takes raw JSON, exclusion is enforced where references are written: the `segmentConditions` save gate refuses a rule that names an internal segment (alongside its existing "not live / not owned" refusals), and the flag / variant hooks refuse a `segmentId` that is internal for any variant but their own. Otherwise deleting a flag could hollow out another audience. The boolean marks the lifecycle, it does not replace it: the variant hook tombstones and revives the segment with the variant, and an internal row is usable only as the audience of the variant already serving it. The segment list shows what people named on purpose; a variant may also point at one of those.
- **Percentage rollout is a slice of the id.** A `CustomerRef` id is a uuidv7 whose last 15 hex digits are random, so it is already the coin flip: a variant's `sample: { from, to }` serves the subject when three of those digits, read from `FeatureFlag.sampleOffset` digits before the end as a point on 0–100, sit in `[from, to)`. It is checked in the fold over the variant's audience, so it is deterministic, needs no reconcile, self-enrolls new customers, and widening keeps everyone already in. The offset is random per flag and never in the API; one flag's arms read the same digits and never overlap, different flags read different digits (thirteen offsets). Segments know nothing about sampling.
- **Relationship context is the subject kind, not a segment rule.** "This user's current organization is in segment X" is not something a User-subject segment has to express. The flag is written with `subjectModel: Organization`, the variant targets X, and the resolver evaluates it for the org's `CustomerRef` at the hop the user is standing in (see read path). The user gets X's answer because they are acting in X, not because a rule traversed from user to org.
- **Subjects are customers, not members.** The owner is a provider (`ownerModel` is `ProviderModel`, as `Segment.ownerModel` is) and a subject is a `CustomerRef` whose provider is the owner. Org *members* are staff, not customers; a flag never addresses `OrganizationUser` / `SpaceUser` rows. This is the axis the TODO.md concept conflated ("ownership determines who manages *and* where it applies"): who manages a flag is its owner, whom it affects is its subject and audience. A platform flag can address one space without that space being able to edit it.
- **Two namespaces, one resolver.** A bare slug may be created only by the platform. Any other owner's slug carries `custom:`. Both resolve the same way — against the one row, for that owner's customers. `custom:` exists so that a reader, the superadmin viewer and (later) FEAT-022 can tell a provider's own flag from a platform-defined one at a glance; it is not provenance. `rollout:` / `experiment:` are not reserved.
- **The platform is a provider.** `ProviderModel` gains `platform` — the lowercase no-FK `SpecialOwner` already registered in `PolymorphismRegistry` and already used by `Tag` / `TagCategory` / `CommunicationLog.senderType` — so the platform can own flags and segments and hold `CustomerRef`s. **Platform `CustomerRef`s are provisioned, not assumed**: today nothing outside tests writes a `CustomerRef` at all, so every user, organization and space gets its platform `CustomerRef` written on create and backfilled once; the provisioning is idempotent (upsert on the partial unique) and tested for create, re-run, restore-after-soft-delete and backfill. Without that row the platform's subject set is empty. It is the same row FIN-001's platform subscription will hang off.
- **Subject kind is explicit.** `FeatureFlag.subjectModel` is `CustomerModel` (User | Organization | Space): the kind of customer the flag addresses. It is enforced at resolution — members of a variant's segment whose `customerModel` differs are ignored — because a segment has no customer-kind column and its rule may mix kinds. An internal segment is written with the subject kind in its rule.
- **Typed values, declared once, stored per row — the enrichment discipline.** `FeatureFlag.valueType` is `boolean | string | number | json` and is immutable (immutable-fields hook, explicit `include`). Each `FeatureFlagVariant` carries `valueBoolean | valueText | valueNumber | valueJson`; the variant hook enforces that exactly the column matching the flag's type is set (FEAT-020 §4). The type's zero is `false`, `""`, `0`, `null`.
- **One variant row is one rule; the default is the rule-less row.** A rule variant has a label (slug), a typed value, a `position`, and a `segmentId`. The `isDefault` variant has no segment and never enters the loop; at most one per flag. The default stays a row rather than columns on the flag so the four typed value columns exist in one place and one hook. "Beta testers always get `compact`, and a random 20% of everyone else does too" is two rule rows carrying the same value — the label names the rule, the value is the payload.
- **Resolution is one ordered loop under two gates, for a flag and a subject.**
  1. `enabled` is false → the type's zero. Disabled means the flag says nothing; it does not serve its default variant. That is the kill switch, and it is why a boolean flag's `on` variant is `true` and the zero is `false`.
  2. `segmentId` on the flag is set and *s* is not a member (of the right kind) → the flag's default variant, else the type's zero.
  3. Rule variants in `position` order; the first whose segment contains *s* (of the right kind) wins.
  4. No match → the flag's default variant, else the type's zero.
  The flag governs the value a caller gets; what the code does with it is the code's business.
- **Reordering changes what is served, never what is stored.** Segments know nothing about variant positions, so a reorder touches no `SegmentMember` row and triggers no reconcile; it is one row write, one owner key busted, one broadcast, and it is exactly reversible because nothing was written per subject. What moves is the served value for subjects in more than one variant's segment — and overlap is the normal case: "30% sample of S" above "all of S" is the canonical rollout, and moving the S row above the sample kills the sample. That is what position means. The consequence to state: during an experiment a reorder swaps arms for the overlap and nothing records which arm a subject saw before (the audit log records the reorder; exposure logging is out of scope). An owner who wants arms to hold still makes the segments disjoint.
- **The reader names its type; a missing flag is `null`.** `checkFlag(owner, slug, type)` returns the resolved value typed as `type`; if no live flag matches `(owner, slug)`, or the flag's `valueType` is not `type`, it returns `null` (the "things went completely sideways" value) and the mismatch is logged once per slug. Callers that want a zero instead of `null` say so at the call site. `checkFlag.explain` returns the serving row, the variant label and which step matched or which gate refused — on the server and on the owner's read, never in the subject-facing payload (variant labels are rule intent; FEAT-021 ruled the rule opaque to members).
- **Nothing else is cached or pushed.** Resolution reads three row-shaped inputs, each with a row-shaped cache key the existing synchronous `cacheReference` registry busts without walking anything: the subject's `CustomerRef`s (`user:<id>:customerRefs`, already registered), the owner's flags with their variants (`<owner>:featureFlags`, busted by a `FeatureFlag` / `FeatureFlagVariant` entry that must not ignore `position`, which `HOOK_IGNORE_FIELDS` strips by default), and the subject refs' memberships (`customerRef:<id>:segmentMembers`, busted by a `SegmentMember` entry — the row carries `customerRefId`). `resolveFlags(refs)` is a service callable anywhere — request, job, app-event handler, email render; on a user request `prepareRequest` runs it once and puts the result on context (and in `keysToClone` for batch sub-requests). Org / Space tokens have no user; they resolve the org's or space's own refs through the same service. A flag write invalidates one owner key; a membership write invalidates one ref key; the next request recomputes.
- **The frontend refetches on a broadcast.** `meReadManyFeatureFlags` is a live query. A `FeatureFlag` / `FeatureFlagVariant` write emits `featureFlag.changed` (owner, slug) and the websocket channel broadcasts it to the owner's channel (`sendToChannel`) so clients invalidate that query key; no enumeration of users on the server. The emit needs the same `position` exemption as the cache entry — a reorder is a position-only update, and with `HOOK_IGNORE_FIELDS` applied it would bust the key and never tell the client. The ordered-list hook's sibling shifts re-bust the same owner key and re-emit for the same slug; both are idempotent. `segment.membershipChanged` already reaches the affected users and its handler names the same query key alongside `meReadManySegmentMemberships`. App events do not reach webhooks (`webhookEnabledModels` admits `CustomerRef` only); external delivery of flag changes is out of scope here.
- **Slugs.** Flag slugs and variant labels are the shape `CreateOrganizationModal` validates (`^[a-z0-9]+(?:-[a-z0-9]+)*$`); the flag slug additionally admits the `custom:` prefix. There is no shared server-side slug helper in the repo today (the frontend `SlugInput` normalizes, the org modal validates); this ticket moves the slug shape into `packages/shared` as one zod schema + normalizer, and the flag, variant, org and space slugs all read it.
- **Left behind from the TODO.md concept**: `createdById` (attribution is the audit log's job), `allowlist` / `blocklist` Json, `rollout Int`, the per-key Redis cache with wildcard `del`, three sequential `findUnique`s per check, `io.emit`, single-axis ownership, and Space → Organization → Platform most-specific-wins resolution (FEAT-022 owns whatever replaces it). Left behind from this ticket's own earlier drafts: a `weight` column with a hash draw on the variant, a resolved-flags cache with an owner-set version and an audience-walking after-write hook — each was a second copy of machinery FEAT-021 already has.

## Model

```prisma
model FeatureFlag {
  id        String    @id @default(dbgenerated("uuidv7()")) @db.VarChar(36)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  // Owner — false polymorphism over ProviderModel (platform | User | Organization | Space).
  ownerModel     ProviderModel
  userId         String?       @db.VarChar(36)
  organizationId String?       @db.VarChar(36)
  spaceId        String?       @db.VarChar(36)

  slug        String   // bare (platform only) or `custom:` (any owner)
  name        String
  description String?
  enabled     Boolean  @default(false)

  subjectModel CustomerModel        // which of the owner's customers this addresses
  valueType    FeatureFlagValueType // immutable

  // Audience gate — optional; a segment owned by the same provider (shared or internal).
  segmentId String? @db.VarChar(36)

  variants FeatureFlagVariant[]
  // + owner relations, segment relation, auditLogs
}

model FeatureFlagVariant {
  id            String @id @default(dbgenerated("uuidv7()")) @db.VarChar(36)
  featureFlagId String @db.VarChar(36)

  label     String   // slug — names the rule
  position  Int      // orderedList registry, scoped by featureFlagId
  isDefault Boolean  @default(false)

  // Rule rows: required. The default row: null.
  segmentId String? @db.VarChar(36)

  // Exactly the column matching the flag's valueType.
  valueBoolean Boolean?
  valueText    String?
  valueNumber  Decimal? @db.Decimal(38, 10)
  valueJson    Json?

  @@unique([featureFlagId, label])
  @@unique([featureFlagId], where: { isDefault: true })
}

// On Segment (FEAT-021):
//   featureFlagInternal Boolean @default(false)   — internal: reached only through a variant's segmentId,
//   tombstoned with, edited only through the variant; excluded from list routes, pickers and the name uniques.

enum FeatureFlagValueType {
  boolean
  string
  number
  json
}
```

Flag uniqueness is per owner per slug: one partial unique per owner branch (the `Segment` pattern, on `slug` instead of `name`) plus a `platform` partial in the raw-predicate form `Tag` uses.

**Invariants and where they live.** Label uniqueness and the single default are the DB constraints above, not hooks. `valueType` immutability is the immutable-fields hook with an explicit `include`. Row-local invariants (a rule row has a `segmentId`, the default row has none; the matching value column; the segment's owner is the flag's owner; a flag's gate segment's owner is the flag's owner) run in the variant / flag hooks on top-level writes and in the flag service for nested creates, which model-scoped hooks do not see (HOOKS.md). `featureFlagSlug` enforces the shape and the namespace rule (bare ⇒ `platform` owner). A segment that is soft-deleted is read at resolution (`segment.deletedAt`) as refusing / non-matching and surfaces on the owner's read; `segmentId` is a plain FK, not a rule, so it does not sit on the INFRA-030 edge table. An internal segment's `type` is chosen by what created it: static for a sampled or hand-picked list, dynamic for a rule.

Registries: `PolymorphismRegistry.FeatureFlag` (owner axis, `platform: []` as `CommunicationLog.senderType` does), `orderedListRegistry.FeatureFlagVariant = { position: ['featureFlagId'] }`, audit-enabled, factories. Rebac: `db:featureFlag` through the owner walk for User / Organization / Space, and `ownerActions` grows a `platform` arm (superadmin only) — today it fans out over the three FK owners and a `platform` row would pass only through the superadmin bypass. An internal segment's rebac is its variant's.

On create of a `boolean` flag the service writes its `on` rule variant (`valueBoolean: true`) pointing at an internal open segment (rule `{}`, dynamic) so the kill-switch path stays create → toggle; resolution has no special case for it.

## Resolution and read path

- `resolveFlags(refs)` takes a set of `CustomerRef`s and returns, per ref's provider (the hop), `slug → value`. For a user request the refs are the user's own (with the platform, and with any org / space the user is a customer of) plus, for each membership, the org's or space's platform ref — so a member standing in org X gets the platform's Organization-subject flags as they resolve *for X*, and the platform's User-subject flags as they resolve for themself. No hop reads another hop's rows.
- Server: `checkFlag(owner, slug, type)` reads the per-request result on context; `owner` is the hop (`platform`, or the org / space the caller is acting in — the API has no per-request acting context, so the caller names it, as permissions checks name a resource). Off-request callers (jobs, app-event handlers, email render) call `resolveFlags` directly; it costs three cached reads and a fold.
- Frontend: `useFeatureFlag(owner, slug, type)` selects from the `meReadManyFeatureFlags` live query; the existing conditional props (`show`, `disabled`) consume it unchanged. The ws dispatcher already invalidates by query key, so the broadcast and the membership handler name that key — one new handler, no new dispatch mechanism.

## API and UI

- Routes follow `Segment`'s per-owner shape: `featureFlags` create + read-many on `/me`, `/organization/:id`, `/space/:id`, and `/admin` for `platform`; `/featureFlag/:id` read / update / delete; `/featureFlag/:id/variants` list + create; `/featureFlagVariant/:id` update / delete; `meReadManyFeatureFlags` (subject-facing, values only). Reordering is a plain update of `position` on the variant; the ordered-list hook does the shifting. A variant create / update takes either `segmentId` (a shared segment of the owner) or `internalSegment: { type, conditions }`; the service writes the internal row with `featureFlagInternal` set, named `${flag.slug}/${variant.label}`. The `sample: { percent, from?: segmentId }` affordance is deferred: deterministic sampling over the `CustomerRef` id lands separately.
- Segment list routes and the picker source exclude rows with `featureFlagInternal`; `/segment/:id` update / delete refuse them (edit through the variant). `estimateSegmentReach` gets its route here, since a variant row is where reach is displayed.
- Superadmin: one read-many over all flags, two tabs on the same endpoint — `ownerModel = platform`, and everything else — mounted next to the existing routes under `apps/superadmin/app/routes/_authenticated/`.
- Owner-context flag pages (org / space / me) list the owner's flags and their variants with reach per row; a variant's segment is picked from the owner's segments or defined internal. Internal *rule* authoring is JSON through the API until the segment builder exists (see Open); sampling and hand-picked lists need no builder.
- First consumers: none exist yet. Email render (`checkFlag` inside `{{#if}}` sources) and the conditional props are the obvious first two and are cheap once `resolveFlags` is callable off-request.

## Prerequisites

- **PR #105 (FEAT-021 segments) landed.** `main` today has no `Segment` model and `ProviderModel` is `Space` only (the first segments PR was reverted 2026-09-13); segments and the widened `ProviderModel` are on #105. Everything above assumes that branch.
- **`Segment.featureFlagInternal`** with the exclusion in list routes / pickers / name uniques, the tombstone cascade from the variant hook, and edit-through-variant refusal. Small, and it is the whole "hidden segment" mechanism.
- **`platform` as a provider, end to end.** Not small. The schema part is: `platform` in `ProviderModel`, one partial unique per customer column with `providerModel = 'platform'`, `platform: []` on the `CustomerRef` provider axis and on `PolymorphismRegistry.Segment`, `allowedCombinations` grown. The part that is not: every owner helper in the segment module derives a provider FK from the registry and returns nothing for a no-FK owner — `segmentOwnerFk`, `customerRefProviderFk`, `communicationSenderFk` (`segmentOwner.ts`), the `ownedBy` bind and the boot probe in `segmentLensFor`, `ownerOf` in the conditions hook, the member-owner hook, `providerOf` in `reconcileCustomerRef`, `dynamicSegmentsOf`. For a no-FK owner the tenancy bind is a discriminator equality (`providerModel = 'platform'`), not an FK bind, and each of those sites needs that arm. Plus `/admin` segment create / list routes, which do not exist (segments create only on `/me`, `/organization/:id`, `/space/:id`).
- **Platform `CustomerRef` provisioning.** On user / organization / space create, plus a one-time backfill; idempotent and tested as above. No writer exists today outside the test factory.

Not blocked by INFRA-004 or INFRA-002 any more: the app-event → websocket bridge with live-query refetch is live, and the rule evaluator is in every package.

## Out of scope

- **Inheritance / delegation (FEAT-022).** What it means for the platform to turn a flag on "for" an org, and for that to pass down to the org's customers or its spaces — narrowing rows, path walks, whose default wins when an ancestor refuses — is undefined and stays undefined here. v1 has no path: a bare slug is the platform's row, a `custom:` slug is its owner's row, and a subject standing at a hop sees exactly that hop's flags. The model above does not foreclose it: subjects are already `CustomerRef`s, hops are already providers, and `custom:` already marks the rows that will never walk.
- **Automatic sortition** — the json-rules `bucket` operator (both rails agreeing on the hash). Manual sortition ships here.
- **Billing, subscriptions, plan limits.** Parked (architect, 2026-09-17). A subscription hangs off `CustomerRef` as its own record with its own adapter, and a plan gate is then an ordinary platform flag whose audience is a dynamic segment over it; numeric limits (tenant counts, sends per month, shared provider pools) are plan attributes read by the rate limiter and usage enforcement, never flags. Lands with FIN-001; BRAND-002 §4.1 / §5 describe the consumer.
- **Exposure logging** for experiment measurement (an app event when a variant is actually encountered, distinct from being in its segment); **webhook delivery** of flag changes.
- **`Entitlements`** on `OrganizationUser` / `SpaceUser` / `Token` are permix action overrides (they grant as well as remove) and are unrelated to flags; the word is taken and this ticket does not reuse it.

## Open

- **Segment builder.** `SegmentsPage` is a read-only table and rules-builder is wired only for the email surface; `segmentLensFor(owner)` exists server-side. The builder is the INFRA-017 / INFRA-024 consumer FEAT-021 already names. Once it ships, internal rule authoring on a variant is the builder embedded in the variant form.
- **Internal segment volume.** Every rollout and every internal rule is a `Segment` plus its `SegmentMember` rows and a place in the reconcile sweep. That is the price of one materializer, and it is the right price; the first thing to measure is sweep time as flag-owned dynamic segments accumulate, and whether disabled flags' internal segments should be frozen (flipped static) rather than reconciled.
- **Reach display.** Reach per variant is the segment's reach, which ignores position (an earlier row may have captured some of it). Whether the UI shows raw reach, effective reach, or both.
