# Communications

<!-- toc:start -->

## Contents

- [Overview](#overview)
- [Email](#email)
  - [Implementation Status](#implementation-status)
  - [Package Structure](#package-structure)
  - [Email Clients](#email-clients)
  - [Database Models](#database-models)
    - [EmailTemplate](#emailtemplate)
    - [EmailComponent](#emailcomponent)
    - [Enums](#enums)
  - [Component System](#component-system)
    - [Syntax](#syntax)
    - [Extraction (mapRefs)](#extraction-maprefs)
  - [Variable Interpolation](#variable-interpolation)
  - [Authoring & Data Surface (planned)](#authoring--data-surface-planned)
  - [Cascade Resolution](#cascade-resolution)
  - [Render Pipeline](#render-pipeline)
    - [Compose](#compose)
    - [Interpolate (per recipient)](#interpolate-per-recipient)
  - [Save Pipeline](#save-pipeline)
  - [MJML Validation](#mjml-validation)
  - [Send Pipeline](#send-pipeline)
    - [Render-error policy](#render-error-policy)
  - [Template Versioning & Recompose](#template-versioning--recompose)
- [Messaging (non-email channels)](#messaging-non-email-channels)
  - [Provider Registry](#provider-registry)
  - [Jobs](#jobs)
- [Notifications](#notifications)
  - [Planned: Novu](#planned-novu)
- [SMS](#sms)
- [Webhooks](#webhooks)
- [Communication Preferences](#communication-preferences)

<!-- toc:end -->


---

## Overview

Communication channels:
- Email (transactional, marketing) - **partially implemented**
- Messaging — direct per-`ContactType` channels (SMS, push, chat) on a pluggable adapter lane - **seam built, no adapters wired**
- In-app notifications (future)
- Webhooks (existing)

---

## Email

Located in `packages/email` (`@template/email`).

### Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Email clients | Done | Resend + Console |
| MJML validation | Done | Syntax checking |
| Component extraction | Done | `parseBlocks` + `decompose` |
| Variable interpolation | Done | sender/recipient/data + conditionals |
| Cascade resolution | Done | Two chains: user (SpaceUser→OrgUser→User→default) + org (Space→Org→default) |
| Save pipeline | Done | Template + component persistence |
| Compose pipeline | Done | Fetch + expand components |
| Conditional rules | Done | `{{#if rule={...}}}` with json-rules |
| Render issues | Done | Save refuses what the lens can decide; render records typed issues; the registry entry says `fail` (default), `degrade`, or names a `substitute` |
| **Sending jobs** | Done | `sendEmail` BullMQ job (resolve → verify → compose → interpolate → render → send) |
| **Authoring layer** | Planned | Narrowed-lens rule builder + field selector (COMM-001 / INFRA-002 / INFRA-017) |
| **Data hydration** | TODO | Pipe `{sender,recipient,data}` in; the lens is its schema |
| **Preference management** | TODO | Unsubscribe, categories |

### Package Structure

```
packages/email/src/
├── client/               # Email providers
│   ├── resend.ts         # createResendClient(apiKey)
│   ├── console.ts        # createConsoleClient() - dev logging
│   └── types.ts          # SendEmailOptions, EmailClient
├── render/               # Template pipeline
│   ├── compose.ts        # composeTemplate/composeComponent
│   ├── expand.ts         # Recursive component expansion
│   ├── extractRefs.ts    # Component extraction (mapRefs)
│   ├── interpolate.ts    # Variable substitution + conditionals
│   ├── evaluateConditions.ts  # {{#if rule=...}} evaluation
│   ├── lookup.ts         # Single-tier ownership lookup
│   ├── lookupCascade.ts  # Cascade lookup across ownership tiers
│   ├── lookupTemplate.ts # lookupTemplate/lookupComponent entrypoints
│   ├── resolveVariants.ts # Match-or-create component variants
│   ├── validateNoCycle.ts # Component ref cycle guard
│   ├── save.ts           # saveEmailTemplate coordinator
│   ├── saveComponents.ts # Component persistence
│   ├── saveTemplate.ts   # Template persistence
│   ├── errors.ts         # EmailRenderError
│   └── types.ts          # SaveContext, etc.
└── validations/          # MJML validation
    ├── validateMjml.ts
    └── MjmlValidationError.ts
```

---

### Email Clients

Two client implementations:

```typescript
import { createResendClient, createConsoleClient } from '@template/email/client';

// Production - sends via Resend API
const client = createResendClient(process.env.RESEND_API_KEY);

// Development - logs to console
const client = createConsoleClient();

// Send email
await client.send({
  to: 'user@example.com',
  from: 'noreply@example.com',
  subject: 'Welcome!',
  html: '<html>...</html>',
});
```

**SendEmailOptions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `to` | `string \| string[]` | Yes | Recipient(s) |
| `from` | `string` | Yes | Sender address |
| `subject` | `string` | Yes | Email subject |
| `html` | `string` | Yes | HTML content |
| `replyTo` | `string` | No | Reply-to address |
| `tags` | `string[]` | No | Tracking tags |
| `metadata` | `Record<string, string>` | No | Custom metadata |

---

### Database Models

#### EmailTemplate

MJML templates with ownership and componentRefs.

```prisma
model EmailTemplate {
  id               String
  name             String              // "OTP Verification"
  slug             String              // "otp"
  locale           String              // "en"
  kind             CommunicationKind   // system|platform|activity|marketing
  subject          String              // "Your code: {{data.code}}"
  mjml             String              // Full MJML with component refs
  componentRefs    String[]            // Pre-computed slugs

  // Ownership (false polymorphism)
  ownerModel       EmailOwnerModel     // default|admin|Organization|Space
  organizationId   String?
  spaceId          String?
  inheritToSpaces  Boolean             // Allow Space to use Org template
}
```

#### EmailComponent

Reusable MJML blocks (headers, footers, buttons).

```prisma
model EmailComponent {
  id               String
  slug             String              // "default-header"
  mjml             String              // MJML fragment
  locale           String
  componentRefs    String[]            // Nested component slugs

  // Same ownership pattern as EmailTemplate
  ownerModel       EmailOwnerModel
  organizationId   String?
  spaceId          String?
  inheritToSpaces  Boolean
}
```

#### CommunicationLog

Per-recipient delivery ledger — one row per recipient per send (grouped by `sendKey`) — and the
at-most-once dedup fence (`idempotencyKey @unique`). **Metadata only**, never the rendered body
(re-render from `emailTemplateId` + data). Sender is false-polymorphic; `kind`/`emailTemplateId` are
filled when deliver resolves the template.

```prisma
model CommunicationLog {
  id                   String
  sendKey              String                // groups a send's recipients (= planner job id)
  channel              CommunicationChannel  // email|sms|push|inApp
  kind                 CommunicationKind?    // filled at deliver
  status               CommunicationStatus   // queued→sending→sent | failed | suppressed | undeliverable
  emailTemplateId      String?               // resolved template (onDelete: SetNull)

  senderType           SenderType            // false polymorphism (platform/admin carry no FK)
  senderUserId         String?
  senderOrganizationId String?
  senderSpaceId        String?

  recipientUserId      String?
  recipientContactId   String?
  address              String

  idempotencyKey       String                // @unique — the fence
  providerMessageId    String?
  error                String?
  sentAt               DateTime?
}
```

#### Enums

```prisma
enum CommunicationKind {
  system        // OTP, password reset, security — always delivered, un-mute-able
  platform      // product news, announcements — opt-out
  activity      // something happened involving you — opt-out
  marketing     // promo — opt-in only
}

enum CommunicationChannel { email  sms  push  inApp }

enum CommunicationStatus {
  queued  sending  sent  failed  suppressed  undeliverable
}

enum EmailOwnerModel {
  default       // Base templates - read: all, write: super admin
  admin         // Platform internal - super admin only
  Organization  // Tenant-branded
  Space         // Space-specific overrides
}

```

---

### Component System

#### Syntax

```mjml
{{#component:header}}
  <mj-section>
    {{#component:logo}}
      <mj-image src="logo.png" />
    {{/component:logo}}
  </mj-section>
{{/component:header}}
```

Pattern: `{{#component:slug}}...{{/component:slug}}`

#### Extraction (mapRefs)

```typescript
import { mapRefs } from '@template/email/render';

const result = mapRefs(mjmlString);
// result.map - { slug: [{ mjml, refs }] }
// result.mjml - Tagged output with :N indices
// result.refs - Top-level refs
```

Handles:
- Nested components (depth N)
- Variant deduplication (same MJML = same component)
- Variant indexing (`:0`, `:1` for different content)

---

### Variable Interpolation

Three prefixes for variable substitution:

| Prefix | Source | Example |
|--------|--------|---------|
| `sender` | Platform or org info | `{{sender.name}}` |
| `recipient` | Recipient user | `{{recipient.email}}` |
| `data` | Explicit from send call | `{{data.code}}` |

```typescript
import { interpolate } from '@template/email/render';

const html = interpolate(template, {
  sender: { name: 'Acme Corp' },
  recipient: { email: 'user@example.com', firstName: 'John' },
  data: { code: '123456' },
});
```

---

### The email lens

An email renders against four scope roots — `sender`, `recipient`, `data`, `system` — and the
email lens is **four lenses, one per root** (`EmailLens`, `packages/email/src/rules/emailLens.ts`):
a User narrowing for the recipient, the sender model's narrowing, a model or declared-field lens
for `data` (or the opaque bag, addressable at any depth as beneath-Json), and a declared lens over
the system tokens. No bridges between them; a comparison across two roots is a `path` into the
other lens. Everything a template does with a path or a rule goes through it:

- **Tokens and paths** — `walkEmailLensPath` / `emailTokenPathKind` walk the *narrowing* (a slot
  that drops a relation drops its tokens), at save (`validateTokens`), for component expectations
  and in preflight.
- **Rules** — `emailRuleViolations` is the vocabulary (save and `withRule` at render),
  `emailRuleReferences` the rows a rule names, and `applyEmailLens` + `check` the evaluation:
  settle never checks a raw rule, so a lens `where` decides at send what it decides at save.
- **The builder** — `emailSurface` composes the four exposed surfaces under a presentation root
  `Email` for the rule surface route; `emailRuleDecoration` derives one facet per lens present.

**The lens is the row owner's.** `emailLensFor(slug, owner)` (`apps/api/src/lib/email/emailLensFor.ts`)
builds the slug's declared lens (the registry entry's projection narrowed by the slots stored on
the slug's default-tier row) and scopes it to the owner of the row being saved, edited or rendered
(`scopeEmailLens`): tags are platform-owned or the owner's, segments are the owner's (via
`recipient.providerRefs.segmentMembers.segment`), platform tiers see platform tags and no segments.
`OrganizationUser`/`SpaceUser` rows scope to the person, like the cascade they sit on. The owner
is decided per site: save takes it from the input, the rule surface and preflight from the body
(default: platform), and settle from `composeTemplate`'s `owner` — the row that won the cascade,
so an Organization row rendered for a Space sender sees the organization's tags. No inheritance up
the tree for now. The picker gets real options for Tag and Segment (`emailSourceValues`, the lens's
`sourceQueries` run through Prisma); Organization and Space sources stay unscoped and unlisted.

**Deferred (documented, not built):**

- **Subtenancy brand lock** — an `Organization`-level `spaceEmailPolicy:
  free | locked` (+ locked/required component slugs). On `locked`, the cascade
  stops letting a Space override the locked slugs and save/render
  requires/injects them. The component-inheritance mechanism already exists; only
  the lock/enforcement is missing. No settings table exists today; this would land
  on the `Organization` app-fields fence.
- **FF-gated additive lens grants** — entitlement/module ownership stitches extra
  `data` fields into the lens; the base lens stays static + superadmin-authored.
- **Predicate-composited surfaces** — not pursued (no stable contract to validate
  against); content variation stays in conditional blocks.

### Cascade Resolution

Two separate ownership chains, selected by the sender's tier — a user-actor walks the **user** chain, a tenant/shared sender walks the **org** chain. Both end at the shared `default` floor.

| Context (sender tier) | Resolution Order |
|---------|------------------|
| SpaceUser | SpaceUser → OrganizationUser → User → default |
| OrganizationUser | OrganizationUser → User → default |
| User | User → default |
| Space | Space → Org (if `inheritToSpaces`) → default |
| Organization | Org → default |
| admin | admin only |
| default | default only |

This cascade happens automatically during compose - `composeTemplate` and `composeComponent` handle lookup based on the ownership context.

---

### Render Pipeline

The render pipeline has two phases:

```
┌─────────────────────────────────────────────────────────────┐
│  PHASE 1: Compose (once per template)                       │
│  composeTemplate(slug, ctx) → { id, mjml, subject, kind }   │
│     └── expand(mjml, componentRefs, ctx)                    │
│         └── lookupCascade → fetch components → replace refs │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  PHASE 2: Interpolate (per recipient)                       │
│  for (recipient of recipients) {                            │
│    interpolate(mjml, { sender, recipient, data })           │
│      └── evaluateConditions ({{#if rule=...}})              │
│      └── substituteVariables ({{sender.*}}, etc.)           │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
```

**Phase 1** happens once - fetch template, expand all `{{#component:slug}}` refs.

**Phase 2** happens per recipient - evaluate conditionals and substitute variables.

#### Compose

```typescript
import { composeTemplate, composeComponent } from '@template/email/render';

// Compose a full template
const { mjml, subject, kind } = await composeTemplate('welcome', {
  ownerModel: 'Organization',
  organizationId: org.id,
  locale: 'en',
});

// Compose a single component (for editor preview)
const { mjml } = await composeComponent('header', {
  ownerModel: 'default',
  locale: 'en',
});
```

#### Interpolate (per recipient)

```typescript
import { interpolate } from '@template/email/render';

const recipients = [user1, user2, user3];

for (const recipient of recipients) {
  const html = interpolate(mjml, {
    sender: { name: 'Acme Corp', logo: 'https://...' },
    recipient: { name: recipient.name, email: recipient.email, role: recipient.role },
    data: { code: generateOtp() },
  });

  // Now render MJML to HTML and send
}
```

`interpolate(template, variables, onError?, { locale, liveRefs, lens })` and
`evaluateConditions(template, variables, onError?, liveRefs?)` take an optional
`onError: RuleErrorSink` (`(issue: RenderIssue) => void`, `RenderIssue = { kind:
'rule' | 'token' | 'each', path?, detail }`). Render has one behaviour: a block whose
rule is degraded (`withRule`: a required binding missing, the lens no longer admits
the rule, a row it names is gone) or throws renders nothing; an `{{#each}}` whose
filter throws renders nothing; a token that resolves to nothing, to an object, or to
an unknown root renders **empty** — never the literal `{{…}}`. Every such case is one
issue in the sink. Save is where the lens decides (`validateTokens`,
`validateConditions`), so at render an issue means drift since save, not authoring.

---

### Save Pipeline

Coordinates template + component persistence:

```typescript
import { saveEmailTemplate } from '@template/email/render';

const { template, components } = await saveEmailTemplate(db, {
  slug: 'welcome',
  name: 'Welcome Email',
  subject: 'Welcome, {{recipient.firstName}}!',
  mjml: '<mjml>...</mjml>',
  category: 'system',
  ownerModel: 'Organization',
  organizationId: 'org_123',
  locale: 'en',
});
```

Pipeline steps:
1. Validate MJML syntax + conditional rules in `mjml` and `subject`
   (`assertValidConditions`) — fail fast instead of shipping a render-time time-bomb
2. Extract component refs (`mapRefs`)
3. Lookup existing components via cascade
4. Resolve variants (match or create)
5. Save template + components in transaction (each component re-validates its own
   conditionals at the unit boundary; component MJML is a fragment, so it is not
   run through the full-document MJML validator)

---

### MJML Validation

```typescript
import { validateMjml } from '@template/email/validations/validateMjml';
import { MjmlValidationError } from '@template/email/validations/MjmlValidationError';
// Both are also re-exported from the package root: '@template/email'

try {
  await validateMjml(mjmlString);
} catch (err) {
  if (err instanceof MjmlValidationError) {
    // err.issues: MjmlIssue[]
  }
}
```

---

### Send Pipeline

Outbound email is **event-driven** and runs as two BullMQ jobs — never a direct client
call. Business logic emits an app event; the email bridge enqueues the **planner**
(`sendEmail`), which fans out one **deliver** job (`deliverEmail`) per recipient.

```
emitAppEvent(name, data) → email bridge → sendEmail (planner) → deliverEmail (per recipient)
```

`SendEmailPayload` is `{ eventName, template, data }` — no caller-supplied recipients.

#### Registry (`apps/api/src/lib/email/registry.ts`)

Each template slug maps to an `EmailEntry` describing how to resolve its data + recipients
from the event — all as **lenses** (`@inixiative/json-rules`), resolved in the worker:

```typescript
type EmailEntry = {
  entity: LensNarrowing;         // the record the email is about, with bound where
  sender: SenderSpec;            // identity the email is sent AS, read off the entity
  recipients: RecipientTarget;   // { where } — the target only; the shape is the template's recipient lens
  cc?:  RecipientTarget;         // addresses only
  bcc?: RecipientTarget;
  data?: string[];               // declared data fields the event must supply
  render?: RenderSpec;
};
```

#### Sender (`apps/api/src/lib/email/sender.ts`)

The identity an email is sent *as* — a discriminated union keyed on `SenderType`
(`platform | admin | User | Organization | Space | OrganizationUser | SpaceUser`).
Identity (from-address/display, via `resolveSender`/`resolveFromAddress`) is separate
from branding (which template), which the cascade resolves. `ownerScope(sender)` maps a sender to
its own owner tier — user-actors keep their tier (`SpaceUser`/`OrganizationUser`/`User`), and
`platform → default` (the one bridge between the two enums) — then the cascade walks that tier's
chain (user or org) down to the `default` floor, carrying the user id for interpolation.

#### Planner (`sendEmail`)

1. Resolve the entity lens; bail if missing or no email adapter is registered.
2. Resolve the template row for the sender's scope and build the owner-scoped email lens from that
   row; fetch recipients in one batch through its **recipient lens** with the entry's targeting
   `where` (`recipientLens`), pruned to what the lens picks plus what its `where`s read. The
   recipient that reaches delivery carries its tags, memberships and segments, so a
   `{{#if rule=…}}` over them decides at send. Then resolve each recipient's email `Contact`
   (settings + deliverability live there).
3. **Find-or-create** a `queued` `CommunicationLog` row keyed on the per-recipient `idempotencyKey`
   — the at-most-once fence, durable beyond BullMQ's retention window (P2002 race → re-read).
4. Enqueue `deliverEmail` with the log id.

#### Deliver (`deliverEmail`) — per recipient

1. Load the log; **skip if already `sent`**.
2. **Resolve** the template via the cascade (`settleTemplate`) → subject/mjml + `kind` + `emailTemplateId`.
   Rules evaluate through the lens of the row that won the cascade (`composed.owner`); a referenced
   segment whose own rule is degraded leaves the live set first (`withoutDegradedSegments`).
   A render error → mark `failed` → rethrow → retries → DLQ.
3. **Gate ① scope** — `inScope` rebac read-check. STUB pass-through today (see COMM-005).
4. **Gate ② settings** — `canDeliver(kind, contact)`: honor `acceptedKinds` opt-outs; `system` always
   delivers; a non-`system` send with no `Contact` → `suppressed`.
5. **Deliverability** — bouncer pre-flight, cached on `Contact.deliverability` (TTL 30d); `undeliverable`
   → mark `undeliverable`, no send.
6. **Claim** the send — atomic compare-and-set `queued|failed → sending`; a racing/retried sibling that
   loses the claim bails (no double-send).
7. Render `mjml2html`, add `List-Unsubscribe` + `List-Unsubscribe-Post` headers (non-`system`), send,
   then `sent` (+ `providerMessageId`) / `failed`. **Every terminal write is CAS-guarded** so a sibling
   can't clobber a `sent` row.

`CommunicationLog` is metadata-only (never the rendered body). Re-render the current version from
`emailTemplateId` + data, or recompose the *exact version sent* from `emailTemplateAuditLogId` (see
[Template Versioning & Recompose](#template-versioning--recompose)).
Idempotency keys are event-anchored, hash-last: planner `{event}:{template}:{hash(data)}`; deliver adds
`{hash(sender)}:{email}:{hash(contents)}`. Intentional resends are distinct events, never key mutation.

#### Render issues — behaviour lives in the registry entry

`settleTemplate` renders subject and body, collecting `RenderIssue`s. What happens next is
declared on the template's code registry entry (`apps/api/src/lib/email/registry.ts`,
`render: { onIssue, substitute }`), never on the row:

- **subject issue** — always fatal for that render (a truncated subject is never sent).
- **`onIssue: 'platform'`** (default) — a branded (tenant-tier) render with any issue, or one
  that cannot be composed, is re-rendered from the platform tier's own row of the same slug:
  unbranded but stable, so the mail still goes out. It must render clean or the send fails. A
  render that already resolved at the platform tier has nowhere to go and fails.
- **`onIssue: 'fail'`** — opt-in for a template that would rather wait and be fixed: any body
  issue throws `EmailRenderError('render_failed')` → the CommunicationLog is marked `failed` →
  BullMQ retries → DLQ.
- **`onIssue: 'degrade'`** — the send proceeds with the failing blocks and tokens rendered
  empty; the issues are stored on `CommunicationLog.renderIssues` and logged.
- **`substitute: '<slug>'`** — a different template rendered instead of the platform fallback,
  with the primary's sender, recipient and variables. Same clean-or-fail rule. A substitute may
  not itself name a substitute.

A non-system template rendered for a recipient with no contact row fails
(`unsubscribe_unavailable`) before anything is sent: the unsubscribe link is not optional.

### Template Versioning & Recompose

"What was sent" stays reconstructable after templates and shared components are edited. Live
`EmailTemplate`/`EmailComponent` rows keep using **slug refs** (late-bound through the cascade — a
Space override can be added or evacuated and existing templates re-resolve live). The **version graph
lives in the audit log**:

- Every edit already writes an immutable `AuditLog` snapshot (`after` = full content). The
  `emailVersioning` hook additionally stamps `AuditLog.componentVersions` — a `{ slug → child snapshot
  audit-log id }` map of the snapshots the row's children currently resolve to. A template snapshot
  points at its component snapshots, recursively: a traversable version tree, each version's content
  stored once and shared by reference when unchanged.
- **Backprop walk** (`apps/api/src/hooks/emailVersioning`): a component change — content edit, or an
  override created/deleted that shifts resolution — spawns fresh snapshots for every ancestor whose
  resolved children moved, stopping a branch where an override shadows the change. Saves run
  **children-before-parent** so a parent snapshot pins children that already exist; the hook registers
  *after* the audit hook so the changed row's snapshot exists when the walk runs.
- **Send pins the version**: `deliverEmail` records the template's current snapshot id on
  `CommunicationLog.emailTemplateAuditLogId`.
- **Recompose** (`recomposeCommunication`, `apps/api/src/lib/email/recompose.ts`): resolves
  `CommunicationLog.emailTemplateAuditLogId` then `recomposeSnapshot` walks `componentVersions`
  recursively, splicing each pinned child snapshot back into its `{{#component:slug}}` block, to rebuild
  the as-sent composition. Version fidelity (template + components as they were), `{{variable.*}}`
  placeholders intact — not the per-recipient interpolated bytes.
- **Seeds**: the `packages/db` seed can't import `registerHooks`, so the canonical seed runs through
  `apps/api/scripts/seed.ts`, which registers all hooks first — seeded system templates get their
  initial snapshots.

### Rule References (the rows a rule names)

A `{{#if rule=…}}` block can name a row — "recipient is tagged X", "recipient is in space Y". Those
edges are persisted so that "who references X" is an index and a stale rule is never evaluated
(INFRA-030; Zealot ZLT-4441 is the same primitive on MySQL).

- **`RuleReference`** (`packages/db/prisma/schema/ruleReference.prisma`): one row per
  (owner row → referenced row), false-polymorphic on both ends — `ownerModel` + one typed FK per
  rule-bearing model (`emailTemplateId` / `emailComponentId`), `referencedModel` + one typed FK per
  referenceable model (`tagId` / `organizationId` / `spaceId`), both axes in `PolymorphismRegistry`.
  Real relations on both ends, `onDelete: Cascade`; append/delete only, no lifecycle of its own.
- **Which models are referenceable is the registry's answer, not any surface's.**
  `RULE_REFERENCEABLE_MODELS` (`packages/db`) is the `referencedModel` axis of
  `PolymorphismRegistry.RuleReference`; the referenced-side hook registers on it.
- **A rule-tracked lens has one spelling per reference: the row's `id`, never an FK column.**
  `omitForeignKeys(lens)` (`packages/db/lens`, the same shape as `redactLens`) omits every FK
  column `prismaMap` knows from every model, wherever it appears; each rule-tracked lens wraps
  itself in it and declares its own id sources. Each model-rooted lens of the email lens
  (`emailLens`, `packages/email/src/rules/emailLens.ts`) wraps in `omitForeignKeys` and declares
  `sources: { id: { label: 'name' } }` as a `mapDefaults` entry for each of
  `RULE_REFERENCEABLE_MODELS`, so the id answers on every path to the model. The default
  recipient lens reaches `tagAttachments.tag`, `spaceUsers.space`, `organizationUsers.organization`
  and `providerRefs.segmentMembers.segment` (`id`, `name`); a relation the lens does not declare
  is refused at save. The api's `emailLensFor(slug, owner)` builds the owner-scoped lens; the
  builder gets `emailSurface` of it (which strips sources), while save and settle keep the lens
  itself (`defaultEmailLens` when none is threaded) — extraction never runs on the exposed
  surface. Adding a referenceable model = a registry entry + an FK column (the hook and email's
  sources derive); a surface that reaches it declares its own labeled id source.
- **Extraction is the lens's** (`ruleReferences(lens, rule)`, `packages/db`): `ruleSourceValues`
  (json-rules ≥ 2.20) reports the values a rule names at each source, and a source on a model's
  id field is a row reference. Nested and dotted spellings are one path; a `path`/`bind` leaf at a
  source — or an operator that describes the row without naming it (`contains`, `between`) — is
  `dynamic`: it names no row and registers no edge. When save is handed a lens (the api
  always is), its condition gate (`assertValidConditions`) refuses any rule path the lens does not
  resolve — an FK spelling or typo path is a 422, never a silently unregistered rule; `withRule`
  asks the same question at render through `ruleVocabularyIssues`. With no lens there is nothing
  to decide and only extraction runs.
- **Edges are written by the save path, not a hook.** The writer is
  `syncRuleReferenceEdges(owner, references, sources?)` in `packages/db` — set-diff (survivors
  keep their row), a newly added missing or soft-deleted target refused as a delta (a pre-existing
  dead reference stays editable), referenced rows locked with `db.findForUpdate` while the gate
  reads them. With the lens's `sourceQueries` passed as `sources`, a newly added reference the
  source's composed `where` does not admit is refused too (`unadmittedRuleReferences`): that is how
  an Organization template cannot name another organization's tag or segment. Throws
  `RuleReferenceError`. Adding a rule-bearing column = a `syncRuleReferenceEdges`
  call from its save path. Email's `syncRuleReferences(owner, contents, lens)` is the
  content-shaped front: it collects the rules out of MJML and subject (`contentRuleReferences`)
  and hands the references down. `saveEmailTemplate` calls it inside
  its transaction for the template and each saved component; it is the only writer of
  `mjml`/`subject`, so nothing bypasses it.
- **Staleness lives on the edge, as two signals rather than a computed flag.** A soft delete of a
  referenced row is copied onto every edge naming it by `ruleReference:referenced` (one
  `updateManyAndReturn`, matched on `(referencedModel, referencedId)`, cleared on undelete); a
  purge `SET NULL`s the typed FK and leaves `referencedId` naming the row that went. The referenced
  axis therefore carries true polymorphism beside the false — the FK is the relation and may go
  null, `referencedId` is the name and never changes, and the sync writes both from one value.
  `ruleReferenceIssues(edges)` reads both from the edge rows alone, so consumers
  write `include: { ruleReferences: true }` and never grow that include as models become
  referenceable. At render, `composeTemplate` reads the template's edges plus those of the
  components the cascade resolved into one live set, and every branch goes through **`withRule`**
  (`@template/shared/rules`) — the one fork a stored rule is evaluated through anywhere.
- **`withRule(health, { degraded, sound })`** asks, at evaluation and against the current lens,
  whether the rule can be evaluated correctly — two questions: every binding it requires is
  supplied (`bindOptional` marks the ones that may be left out and resolve to null), and it is
  still valid — the lens admits it (`checkRuleAgainstLens`, so a lens change after save degrades
  the rule instead of silently narrowing it) and every row it names is in the live set the caller
  confirmed (absent set = nothing confirmed = every reference missing). Degraded means "do nothing
  new, say why": in email that is a rule issue, never a match, and the registry entry's `render`
  spec decides the send; existing state is never touched by a degraded rule. Sound runs
  the caller's evaluator. Extraction (`ruleReferences`) lives in `packages/db` with the registry
  that knows which sources are ids; the live set comes from the caller's own read, locked when the
  sound arm decides money. Nothing about degradation is stored. Client hard deletes stay prevented
  (`preventHardDelete`).
- Component references (`componentRefs`) stay slug-keyed and do **not** ride this table: they
  resolve through the owner cascade at read time, so an id persisted at save would be wrong the
  moment an override appears.

---

## Messaging (non-email channels)

A separate lane from email for direct, per-`ContactType` channels (SMS, push, chat). Where email is a
template/cascade/versioning system, messaging is a thin dispatch primitive: render `{{recipient.*}}` /
`{{data.*}}` / `{{sender.*}}` into a payload and hand it to a pluggable per-channel sender. Located in
`apps/api/src/lib/messaging` (jobs in `apps/api/src/jobs/handlers`).

### Provider Registry

`messageProviderRegistry` (`apps/api/src/lib/messaging/providers.ts`) is a `makeBroadcastRegistry` keyed
by `ContactType`; `getMessageProviderAdapter(type)` returns its channel sender or `undefined`. A
`MessageProviderAdapter` is `(contact, content, kind, options) => Promise<void>` — the per-channel send.

```typescript
type MessageContent = {
  text?: string;       // may contain {{recipient.*}}, {{data.*}}, {{sender.*}}
  html?: string;       // same — interpolated before dispatch
  mediaUrls?: string[];
  data?: Record<string, unknown>;
};

type MessageDispatchOptions = { replyTo?: { chatMessageId: string } };
```

### Jobs

Two BullMQ handlers (`messageUser`, `messageContact`), shaped like the email jobs but with no template
cascade, no `CommunicationLog`, and no fan-out planner:

- **`messageUser`** — `{ rule, kind, content }`. `resolveUsers(rule, lens?)` compiles the
  `@inixiative/json-rules` `Condition` through a recipient lens (default: the platform-scoped
  recipient lens of the email lens, so an organization's tag is outside its view) to a Prisma
  query, then for each resolved user interpolates `content` and dispatches to
  every `canDeliver(kind, contact)` contact via that contact's registered adapter. A missing adapter for
  a `ContactType` throws.
- **`messageContact`** — `{ contactId, kind, content, replyTo? }`. Loads one `Contact`, gates on
  `canDeliver`, and dispatches (no interpolation — `content` is pre-rendered).

`canDeliver(kind, contact, customerRef?)` (`apps/api/src/lib/messaging/canDeliver.ts`) is the shared
gate for both lanes: `system` always delivers; otherwise the kind must be in `contact.acceptedKinds`
(and, when given, `customerRef.acceptedKinds`).

> **Status:** the lane is built and unit-tested but **not yet registered** in `jobHandlers`
> (`apps/api/src/jobs/handlers/index.ts`) and has no adapters or callers wired — it is the seam SMS/push
> plug into, not a live channel yet.

---

## Notifications

TODO: Implement notification system

### Planned: Novu

[Novu](https://novu.co/) for multi-channel notifications:
- Email
- In-app
- Push
- SMS

```typescript
// Future pattern
await notify(user.id, 'inquiry.received', {
  inquiryId: inquiry.id,
  senderName: sender.name,
});
```

---
## SMS

A future channel on the [Messaging](#messaging-non-email-channels) lane: register a Twilio
`MessageProviderAdapter` under the `sms` `ContactType`. No SMS adapter is wired today.

---

## Webhooks

Existing webhook system. See [HOOKS.md](HOOKS.md) for webhook delivery.

```typescript
// Current: webhooks sent via sendWebhook job
db.onCommit(() => enqueue('sendWebhook', { ... }));
```

---
## Communication Preferences

Per-channel opt-in/opt-out lives on `Contact.acceptedKinds` (`CommunicationKind[]`), gated by
`canDeliver(kind, contact)` in the deliver path (gate ②). `system` always delivers; `platform`/`activity`
are opt-out (default on); `marketing` is opt-in. Every `User` gets an email `Contact` at creation
(`userEmailContact` after-create hook), so the settings always exist to honor.

**Unsubscribe** (non-`system` emails):
- A signed **HMAC capability link** binds the exact `{userId, contactId, kind}` intersection
  (`apps/api/src/lib/email/unsubscribe.ts`, keyed off `BETTER_AUTH_SECRET`) — the link can only drop that
  one kind for that one contact. No DB token row; stateless, re-derived.
- `List-Unsubscribe` + `List-Unsubscribe-Post` headers (RFC 8058 one-click) point at a public,
  **POST-only** endpoint (`apps/api/src/routes/unsubscribe.ts`, mounted pre-auth). POST-only so a GET
  prefetch (scanners, Safe Links, hover previews) can never unsubscribe anyone.
- Non-`system` templates **must** contain an *unconditional* `{{system.unsubscribeUrl}}`, enforced at
  save (`saveEmailTemplate` — checks the composed body with conditional blocks stripped). The URL is a
  platform-injected `system`-lens value (set per-kind in `settleTemplate`), not recipient data.
- Rich preference management (toggle all kinds) is the **authenticated in-app** surface, rebac-governed —
  not the link. The emailed link is deliberately the narrow one-click only.

**Deliverability** is distinct from preference: the bouncer verdict is cached on `Contact.deliverability`
(+ `deliverabilityCheckedAt`); a confirmed `undeliverable` address is skipped pre-send (the suppression
seam — post-send bounce/complaint webhooks will write here too). Distinct again from `Contact.verifiedAt`
(channel-ownership — see COMM-004).

> **Auth boundary:** anything that *logs a user in* (sessions, magic links, email verification) is
> **better-auth**'s; the platform `Token` model is for API keys + scoped non-auth capabilities. The
> unsubscribe link is neither — it's a self-verifying signed capability, the right tool for an
> unauthenticated, possibly-non-user recipient.

### Tickets
- **COMM-003** — Sender + CommunicationLog (this pipeline).
- **COMM-004** — Contact channel-ownership verification (gate `verifiedAt`).
- **COMM-005** — rebac scope → Prisma (gate ① engine; `inScope` is the stub).

