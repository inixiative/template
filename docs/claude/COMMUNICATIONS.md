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
- In-app notifications (future)
- Webhooks (existing)
- Push notifications (future)

---

## Email

Located in `packages/email` (`@template/email`).

### Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Email clients | Done | Resend + Console |
| MJML validation | Done | Syntax checking |
| Component extraction | Done | `mapRefs()` |
| Variable interpolation | Done | sender/recipient/data + conditionals |
| Cascade resolution | Done | Two chains: user (SpaceUser→OrgUser→User→default) + org (Space→Org→default) |
| Save pipeline | Done | Template + component persistence |
| Compose pipeline | Done | Fetch + expand components |
| Conditional rules | Done | `{{#if rule={...}}}` with json-rules |
| Render-error policy | Done | Per-template `onError` (`fail`/`degrade`/`fallback`) on render-time rule throws |
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

  onError          EmailErrorPolicy    // fail|degrade|fallback on a render-time rule throw
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

enum EmailErrorPolicy {
  fail          // throw → job retries → DLQ (safest default)
  degrade       // drop the throwing block(s), send the rest
  fallback      // re-render at the next owner up: Space → Organization → default
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

### Authoring & Data Surface (planned)

Today conditions are hand-written `Condition` JSON inside `{{#if rule=…}}` and
variables are hand-typed `{{recipient.x}}` tokens. The authoring layer (COMM-001,
built on the rules builder INFRA-002 + builder surface INFRA-017) replaces the
hand-writing with a typed editor over a **narrowed lens**:

- The lens is a schema over the three roots `{ sender, recipient, data }`,
  **narrowed per actor-context** (space → space+org → org → platform) and per
  template/event type. It is handed to the builder as `exposedSurface`
  (where-stripped); the `where` scope floor is re-applied server-side at send.
- The rule builder emits the exact `Condition` JSON `evaluateConditions` already
  runs; the field selector emits the `{{recipient.x}}` tokens `interpolate`
  already substitutes. The editor front-ends the existing runtime; it does not
  change it.
- Narrowing governs *what an author can reference and how far up the graph they
  can traverse* — not what they must include.

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

`interpolate(template, variables, onError?)` and `evaluateConditions(template,
variables, onError?)` take an optional `onError: RuleErrorSink` (`(message:
string) => void`). It fires **only** when a conditional rule *throws* at render
(malformed/uncheckable rule) — never on a normal non-match. The throwing branch is
dropped (the next branch / `{{else}}` renders), so a clean render is the default;
the caller uses `onError` to drive the send-side policy below. Setting
`EMAIL_INLINE_RENDER_ERRORS=true` additionally emits the offending block inline as
an HTML comment (a debug override, independent of environment — useful in a
template preview or a single test).

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
type EmailEntry<E> = {
  entity: (data) => LensNarrowing;                  // the record the email is about
  sender: (entity) => Sender;                       // identity the email is sent AS
  recipients: (entity, sender) => LensNarrowing;
  cc?:  (recipient, sender) => LensNarrowing;
  bcc?: (recipient, sender) => LensNarrowing;
  data?: (entity, handoff) => Record<string, unknown>;  // interpolation variables
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
2. For each recipient (lens): resolve their email `Contact` (settings + deliverability live there).
3. **Find-or-create** a `queued` `CommunicationLog` row keyed on the per-recipient `idempotencyKey`
   — the at-most-once fence, durable beyond BullMQ's retention window (P2002 race → re-read).
4. Enqueue `deliverEmail` with the log id.

#### Deliver (`deliverEmail`) — per recipient

1. Load the log; **skip if already `sent`**.
2. **Resolve** the template via the cascade (`settleTemplate`) → subject/mjml + `kind` + `emailTemplateId`.
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

#### Render-error policy

A conditional rule that *throws* at render (not a non-match) triggers the resolved
template's `onError`. The error is always logged (`LogScope.email`), then:

- **`fail`** (default) — throw `EmailRenderError('render_failed')` → BullMQ retries
  → DLQ-equivalent (`attempts: 3`, `removeOnFail: { age: 30d }`). Safest.
- **`degrade`** — send with the throwing blocks dropped (the evaluator already excluded them).
- **`fallback`** — re-compose one owner up (`parentOwner`: Space → Organization →
  default) and re-render; loops until it renders clean or hits a base owner.

Base owners (`default`/`admin`) have no parent, so they always `fail` — the loop is bounded.

### Template Versioning & Recompose

"What was sent" stays reconstructable after templates and shared components are edited. Live
`EmailTemplate`/`EmailComponent` rows keep using **slug refs** (late-bound through the cascade — a
Space override can be added or evacuated and existing templates re-resolve live). The **version graph
lives in the audit log**:

- Every edit already writes an immutable `AuditLog` snapshot (`after` = full content). The
  `emailVersioning` hook additionally stamps `AuditLog.emailComponentAuditLogIds` — the audit-log ids of
  the snapshots the row's children currently resolve to. A template snapshot points at its component
  snapshots, recursively: a traversable version tree, each version's content stored once and shared by
  reference when unchanged.
- **Backprop walk** (`apps/api/src/hooks/emailVersioning`): a component change — content edit, or an
  override created/deleted that shifts resolution — spawns fresh snapshots for every ancestor whose
  resolved children moved, stopping a branch where an override shadows the change. Saves run
  **children-before-parent** so a parent snapshot pins children that already exist; the hook registers
  *after* the audit hook so the changed row's snapshot exists when the walk runs.
- **Send pins the version**: `deliverEmail` records the template's current snapshot id on
  `CommunicationLog.emailTemplateAuditLogId`.
- **Recompose** (`recomposeCommunication`, `apps/api/src/lib/email/recompose.ts`): walks
  `emailTemplateAuditLogId → emailComponentAuditLogIds` recursively, reading each pinned snapshot's
  content, to rebuild the as-sent composition. Version fidelity (template + components as they were),
  `{{variable.*}}` placeholders intact — not the per-recipient interpolated bytes.
- **Seeds**: the `packages/db` seed can't import `registerHooks`, so the canonical seed runs through
  `apps/api/scripts/seed.ts`, which registers all hooks first — seeded system templates get their
  initial snapshots.

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
TODO: twilio?

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
- Non-`system` templates **must** contain an *unconditional* `{{recipient.unsubscribeUrl}}`, enforced at
  save (`saveEmailTemplate` — checks the composed body with conditional blocks stripped).
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

