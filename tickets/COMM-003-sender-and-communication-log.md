# COMM-003: Sender Model + Communication Log

**Status**: 📋 Proposed — design agreed, not started
**Assignee**: TBD
**Priority**: Medium
**Created**: 2026-06-20
**Updated**: 2026-06-20

---

## Summary

Follows on from [COMM-001](./COMM-001-email-system.md) (the render+send engine). Three pieces:

1. Replace the confusing `ReachContext` with a clean, first-class **`Sender`** model (the actor an email is sent *as*).
2. Build template **render-error fallback** + a real **DLQ** terminus (template **diverges** from Zealot here — see below).
3. Add a durable **`CommunicationLog`** (per-recipient delivery ledger) that doubles as the at-most-once dedup fence — **fixes the duplicate-send gap** (the idempotency keys are inert on the direct enqueue path today; `deliverEmail` has no send-time guard).

> Context: the sender/comms model was previously deliberated in the upstream **Zealot** repo. Template **intentionally diverges** on the points marked below — Zealot and template are allowed to differ.

## 1. Sender (replaces `ReachContext`)

`ReachContext` is a mess — `ownerModel`-keyed union + `contextKey` + `EmailOwnerModel` + `ComposeContext`/`SaveContext` all overlap. Collapse the runtime side onto **one `SenderType` enum** + a **discriminated union keyed on it** (keep the DU — it caught a real `{Space, organizationId}` bug; the enum also gives us the DB column for the log).

```ts
// Prisma enum → generated FP const-enum; also the CommunicationLog.senderType column.
enum SenderType { platform  admin  User  Organization  Space  OrganizationUser  SpaceUser }

type Sender =
  | { type: 'platform' }
  | { type: 'admin' }
  | { type: 'User'; userId: string }
  | { type: 'Organization'; organizationId: string }
  | { type: 'Space'; spaceId: string; organizationId: string }
  | { type: 'OrganizationUser'; userId: string; organizationId: string }
  | { type: 'SpaceUser'; userId: string; spaceId: string; organizationId: string };
```
- `senderKey(s)` → stable string (`type` + ids), used in idempotency keys (replaces `contextKey`).
- Casing: non-model tiers lowercase (`platform`, `admin`); model types PascalCase = Prisma model names (mirrors `EmailOwnerModel`). `platform` = today's `default`.
- **Users are first-class senders.** Sender = *identity* (drives from-address/display via `resolveSender`/`resolveFromAddress`). Branding (which template) is separate — the scope cascade below.

## 1b. Recipients (declarative targeting + two-layer gate)

`recipients` / `cc` / `bcc` are declarative target specs the planner resolves — not lens functions.

```ts
recipients: (entity, sender) => RecipientTargets   // + optional cc / bcc, same shape
type RecipientTargets = {
  users?: string[];          // user ids
  organizations?: string[];  // → members
  spaces?: string[];         // → members
  customerRefs?: string[];   // → contacts
  raw?: string[];            // literal addresses
};
```

`sendEmail` resolution:
1. Expand `organizations`/`spaces` → members, `customerRefs` → contacts; `users` direct.
2. Resolve each candidate down to its email `Contact` (where `acceptedKinds`/`verifiedAt` live); the `to` is that contact's value.
3. **Keep the resolution trace** (the org/space/customerRef + membership it came through) on each recipient → feeds `{{...}}` interpolation. A recipient is `{ final user/contact + trace }`, never a bare email.
4. **Gate ① targeting** — rebac read-check on the entity (`check`, @template/permissions): drop candidates who can't read it. **SEAM** for now (pass-through); real per-candidate-permix filtering deferred (needs `setupUser/Org/SpacePermissions` made context-free + N permission builds/send).
5. **Gate ② settings** — `canDeliver(template.kind, contact, customerRef)` (existing): respect opt-outs; `system` always delivers.
6. Dedupe; fan out one `deliverEmail` per surviving to-recipient, carrying cc/bcc.

- `kind` = `EmailTemplate.kind` (`CommunicationKind`, now unified — `CommunicationCategory` dropped).
- **Direct sends are minimized.** `raw` (bare address, no `Contact`) bypasses both gates and the whole control model, so it is allowed **only for `system` kind** (transactional, un-opt-out-able, from a trusted flow). Every non-`system` send must be Contact-based (verifiable + settings-bearing). Explicit `users` resolve to their email `Contact` and still respect ② settings; they skip only ① targeting.
- Unverified-contact-ownership (settings trust) → **COMM-004**.

## 2. Template resolution + fallback + DLQ  *(diverges from Zealot)*

Cascade is **scope-first** — peel the user dimension to its containing scope, then walk scope up. Both rungs (`Space→Org`, `Org→platform`) fire.

```
parentForTemplate(sender):
  SpaceUser → Space ; OrganizationUser → Organization ; Space → Organization
  Organization → platform ; User → platform ; admin → platform ; platform → null (floor)
```
`SpaceUser → Space → Organization → platform`; `User → platform`. A user-actor may own a template (top of chain) and falls back to its scope's branding — never loses branding.

Two fallback triggers, both walking this chain:
- **Not-found** lookup cascade (exists today).
- **Render-error** re-compose — **BUILD** (Zealot cut this; template keeps it). Fixes the current Space→Org skip by walking `parentForTemplate` instead of mutating `ownerModel`.

**DLQ**: when the **`platform`** floor template errors (or none found at floor) → throw `EmailRenderError` → job fails → **DLQ** (build the handling). `{{#if}}` `degrade` (drop one broken block) retained.

## 3. CommunicationLog

Per-recipient delivery ledger. **One row per recipient per send** (grouped by `sendKey`); **one table**.

- **Sender** persisted: `senderType SenderType` + nullable `senderUserId`/`senderOrganizationId`/`senderSpaceId` (false polymorphism; `platform`/`admin` no FK; relations `onDelete: SetNull`).
- **Template ref: FALSE-POLYMORPHISM** — `templateModel` discriminator + `emailTemplateId` FK (`onDelete: Restrict`), registered in `packages/db/src/registries/falsePolymorphism.ts`. Not a slug string. Channel-agnostic.
- `channel CommunicationChannel { email sms push inApp }` (own enum, not `ContactType`); `recipientContactId`/`address` **nullable**.
- `kind CommunicationKind` (existing) — what `canDeliver` gates on.
- `status CommunicationStatus { queued sending sent failed }` (+ webhook states).
- `recipientUserId` + `address` snapshot + optional `recipientContactId`.
- `idempotencyKey @unique`.
- **Metadata only — never store the rendered body** (re-render from `emailTemplateId` + `data`). Retention/TTL policy required (mechanism TBD).

**Flow / at-most-once fence:** `sendEmail` **find-or-creates** the `queued` row on `idempotencyKey`; `deliver` anti-joins (skip if `sent`) → `canDeliver` → `sending` → transmit → `sent`/`failed`. This find-or-create is the real fence (BullMQ `jobId` dedup only holds within the retention window).

## 4. Idempotency keys (aligned with Zealot)

Anchored on the **event**, hash always last (prefix-comparable):
- planner: `{eventName}:{template}:{stableHash(event.data)}`
- deliver:  `{eventName}:{template}:{senderKey}:{recipientEmail}:{stableHash(contents)}`

Intentional resends = distinct events (e.g. `inquiry.resent`), never key mutation.

## Divergences from the upstream Zealot design (deliberate)

| Decision | Zealot | Template (this ticket) |
|---|---|---|
| Render-error fallback | cut (fail loud to DLQ) | **build** it (scope cascade) **+** DLQ at floor |
| Sender arms | `default/Org/Space` only | **+ `User/OrgUser/SpaceUser`** (first-class users) |
| Sender name/shape | `ReachContext` DU on `ownerModel` | **`Sender`** DU on `SenderType` enum |
| Template owner levels | Org/Space | **+ user-actor levels** (own templates) |

Aligned (no divergence): scope-first cascade, CommunicationLog shape + **FP template ref**, find-or-create fence, event-anchored idempotency, metadata-only + retention.

## Open questions
1. Wire user-actor **template ownership** now (grow `EmailOwnerModel` + `EmailTemplate` owner fields + uniqueness — a migration), or land Sender/cascade/log first and add user-owned templates later? The cascade already routes user-actors to their scope, so this is zero-rework to defer.
2. DLQ mechanism — reuse existing job DLQ, or a dedicated dead-letter for renders?
3. `CommunicationLog` retention/TTL mechanism.

## Build plan (phased)
1. **Sender** — `SenderType` enum + `Sender` DU + `senderKey`; rename `ReachContext`/`contextKey`; bridge to `ComposeContext`; update registry `senders()` + `deliverJobId`.
2. **Cascade + fallback** — `parentForTemplate`; rewrite `lookupTemplate`/`settleTemplate` to walk it for not-found **and** render-error; DLQ at floor.
3. **CommunicationLog** — enums + model + `falsePolymorphism.ts` entry + migration; wire `sendEmail` find-or-create + `deliver` anti-join/status.
4. *(optional / deferred)* user-actor template ownership migration.

## Acceptance
- `ReachContext`/`contextKey` gone; `Sender`/`senderKey` throughout; DU type-safety retained.
- A brand template render error falls back to its scope chain; a floor (`platform`) render error goes to DLQ (no silent default-ship).
- Two enqueues with the same deliver key → exactly one `CommunicationLog` row and one send (covers review findings on duplicate sends).
- `CommunicationLog` stores no rendered body.
