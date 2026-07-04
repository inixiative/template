# COMM-010: Email send-governance matrix (sender→recipient), transitions-based

**Status**: 🟡 In progress — slice 1 (storage + save validation) building on branch `claude/email-interpolation-slots-pnnkti`
**Assignee**: Unassigned
**Priority**: Medium
**Created**: 2026-07-04

---

## ✅ Direction settled (2026-07-04, later session) — supersedes the pause note below

**Simple model wins for now:** a **code registry** (evolve `apps/api/src/lib/email/registry.ts`
`EmailEntry` — do NOT rebuild), **one sender + one recipient lens per template** — one path, one
hydration boundary per side, no lens-selection/resolution logic. Different audiences = different
templates; one app event may fan out to several handoffs (bridge already supports it). The
`EmailTemplate.lenses`/`matrix` DB columns stay **modeled but dormant** (validators only fire if
set). Multi-lens resolution + tenant-editable governance → **COMM-011 (backlog)**, including the
customer-rep/join-is-the-real-target insight.

**The interface upgrade that matters:** split static from dynamic in the registry entry — recipient
`picks`/`relations` declared **statically** (the interpolation surface, knowable at template-save
time), only the scoping `where(entity, sender)` predicate stays a closure. This makes the hydration
boundary enforceable by construction and unlocks the lens-aware `{{recipient.*}}`/`{{#if}}`
validation COMM-009 parked. `data` shape declaration = phase 2.

## ⏸ Resume here (2026-07-04) — read this first

Ideation session; paused, resume with fresh eyes. Honest state of thinking:

**The lens's PRIMARY job is the interpolation surface** — "when I build this template, what data hydrates
and shows up, and who's allowed to see what?" Safe-navigation-bounded `{{lens.field}}` + `{{#if}}`,
admin-specified. That is the load-bearing, ship-now value — slice 1b (`validateLenses`) + COMM-009's
lens-aware conditionals already deliver it. **This is the keeper.**

**Sends are app-event-triggered.** Code emits an app event → look up the template → resolve the recipients
*for that event* (admins / consumers / compliance). Those might be **different templates per recipient
type** (what most systems do) **or one template overloaded with multiple recipient lenses**. Unresolved —
and the *simpler* "one template per recipient type" may well be right.

**Suspected over-engineering to revisit (the "maybe"):** the sender×recipient **matrix multi-modality**,
multi-lens-per-template **union + collision precedence**, per-recipient dispatch. A defensible MVP: one
template = one recipient lens (its interpolation surface); fan-out only where a recipient set is naturally
plural; governance-only; **different audiences = different templates.** Let the simple system teach us
whether overloading is ever worth it. Don't build slices 2b/3 until this "one-vs-many templates" call is
made.

**Locked decisions:** governance-only (resolution stays in code `EmailEntry`); two-layer authoring
(lenses = platform/superadmin, options = tenant-curated — tenants *select*, never compose lenses); options
is a deferred slice; **system emails first, custom emails much later** (the first teaches the second).

**Already shipped on the branch (safe to leave):** COMM-009 slots + `system` lens + unsubscribe→system;
COMM-010 storage + structural validation (lenses + lens-keyed matrix). All tested, committed, pushed.

## Overview

Each email template declares a **matrix of allowed (sender, recipient) pairs** — which sender types
may send it to which recipient types. This is send *governance*, not content: a guard answering "may
this sender send this template to this recipient?", tenant-configurable at runtime.

The matrix **is** a `@inixiative/transitions` Action — no new primitive. The from→to asymmetry maps
1:1 onto sender→recipient:

| transitions | email matrix |
|---|---|
| `resource` | `email:<slug>` |
| `action` | `send` |
| `Transition.from` (reads current record) | **sender** side — `predicate` narrows sender type/fields; `permission` = may-send (rebac) |
| `Transition.to` (reads target record) | **recipient** side — `predicate` narrows recipient; `permission` = may-receive |
| `Action { paths }` = OR of edges | the template's full allowed matrix |
| `checkTransition → true \| Reason` | send-time guard (predicate fail → 409, permission fail → 403) |
| `available` / `eligible → Prisma where` | "which templates can this sender send?" / eligible recipients |

Authoring sugar: `A|B => C|D || E => F` compiles to `paths[]` (`=>` = one path, `or` collapses into a
side's predicate via json-rules `any`, `||` = another path).

## Why the lenses split (from COMM-009)

`data` and `system` are **universal** lenses. `sender`/`recipient` are **matrix-varying**: each cell
`(senderType, recipientType)` exposes different fields, scoped by that side's **lens**. The matrix
predicates are authored *against* those code-defined lenses — data config within a code-defined
vocabulary (transitions already validates predicates against a lens).

## Lenses & composition

### The two sides are asymmetric (load-bearing)

| side | root | cardinality | compose mode |
|---|---|---|---|
| **sender** | **polymorphic model** — `Organization` / `Space` / `User` / `platform` (a real different `From`) | exactly one | discriminated *selection* — pick one lens |
| **recipient** | **always `User`** — reason outward via relations | a **set** (fan-out) | *union* of the `to` side's lens keys |

Two axes of asymmetry: **root** (sender is a polymorphic model; recipient is always `User`) and
**cardinality** (one sender vs a recipient set). Both sides are name-keyed lens **maps** — but every
recipient lens is `parent: User`, differing only in the relations/`where` it navigates.

### Recipient — defined (User-rooted, set-valued)

**The recipient root is always `User`** — the person who receives the email. You **reason outward from
the User via relations**: org context (`User → organizationUser → organization`), consent + address
(`User → contact`), space, etc. Nothing is a different *root*; everything hangs off the User. A recipient
lens is a `parent: User` **query** (`LensNarrowing`: where + picks + bindings) resolving to 0..N Users;
the `to` side is a **map of such lenses**, OR-ed (union → fan-out). This is how `EmailEntry.recipients`
already works.

- **It's a SET** — one email + one `CommunicationLog` per resolved User.
- **Multiplicity lives in the lens's relation-navigating `where`:**
  - filter — "org users **of this level**" = `where: { organizationUser: { role: … } }`.
  - **binding present/absent = scope** — bind the org → that org's users; unbound → *all orgs'* users of
    that level.
  - a **polymorphic "customer" ref** resolves **down to its User(s)** by walking relations — the lens
    still lands on `User`. Polymorphism is in the source you navigate *from*, not the recipient root.
- **Deliverable-leaf invariant:** each resolved User must yield **an email + a `Contact`** (via
  `User → contact`) for consent / kind / unsubscribe.
- **Provenance** (`{{recipient.organization.*}}`) is these same relations, **bound from the send context**,
  attached per resolved row at fan-out.
- The recipient set is exactly `transitions`' **`eligible(recipientLens)`** bound to context — the guard's
  set-query and the resolution query are the same query.

### Lens keys — unique descriptive names (model-first)

Keys are **unique names**, not models (a side can hold several lenses of one model — `OrgUsersAll` vs
`OrgUsersAdmin`). The `parent` model is declared **inside** the lens. Convention: **model-first, modifier
only when disambiguating** — one lens of a model → `User`, `Organization`; several → `UserAll` /
`UserAdmin` / `UserBilling` (the modifier names the narrowing). Both sides are uniform name-keyed maps;
the matrix `from`/`to` reference names; validation checks names are unique and every matrix key resolves.

### One vocabulary for interpolation, conditionals, slots, and governance

A template's declared lenses are the **single field vocabulary** for all of: `{{lens.field}}`
interpolation, `{{#if …}}` conditional composition (`{{#if recipient.organization}}…{{/if}}` — shown
per-recipient at fan-out), component/slot refs, and the matrix guard. This **closes the gap COMM-009
parked**: `validateConditions` says lens-aware field validation is "out of scope until the builder lands"
— the lens block *is* that builder, so conditionals/slots can now reject fields a lens doesn't `pick`.

### Sender — defined

A **model map**: one lens per allowed sender model, each self-contained with its own bindings (e.g.
`Organization` bound from `data.organizationId`). The matrix `from` selects exactly one.

### Data — defined

The event-payload lens and the **root binding source** (`data.organizationId`, `data.targetUserId`, …).
Universal (not matrix-varying), like `system`.

### Composition pipeline (ordered, context-threaded)

```
data (root bindings)
  → select + bind the ONE SENDER lens by model
  → merge sender identity into the binding context
  → resolve the RECIPIENT SET = union of the `to` lens keys, bound against the MERGED context
  → per resolved row: attach provenance, assert email + Contact leaf (else drop/fail)
  → fan out: hand { sender, recipient(row), data, system } to interpolation per recipient
```

The single-sender / merge / recipient-set step **is** `transitions`' `from → merge → to`: sender = `from`
(current/data context), recipient = `to` (context **merged** with the sender); the recipient set is
`eligible(toLenses)` bound to that context. Guard and composition walk the **same edge, same direction,
one mechanism.**

### `lenses` block shape

```jsonc
{
  // both sides: name-keyed maps of lenses; `parent` model declared inside each lens
  "senders": {
    "Organization": { "parent": "Organization", "picks": [...], "bindings": { "organizationId": "data.organizationId" } },
    "Space": { "parent": "Space", ... }
  },
  "recipients": {                                            // a MAP of set-valued lenses; `to` unions keys
                                                             // EVERY recipient lens is parent: User
    "OrgUsersAll":   { "parent": "User", "where": { "organizationUser": { "organizationId": "⟨bind⟩" } },
                       "picks": ["id","name","email"], "relations": { "contact": { "picks": ["email"] } },
                       "provenance": { "organization": { "picks": [...], "bind": "sender.organizationId" } } },
    "OrgUsersAdmin": { "parent": "User", "where": { "organizationUser": { "organizationId": "⟨bind⟩", "role": "admin" } }, "picks": ["id","name","email"] }
  },
  "data": { /* payload schema — root bindings */ }
}
// matrix: { paths: [ { from: "Organization", to: ["OrgUsersAdmin", "OrgUsersAll"] } ] }  // keys, OR-ed → union
```

## Dispatch, hydration boundary & collision (send path)

**Lens selection happens once, at the planner (`sendEmail`) — the send→deliver bridge.** That's already
where the sender is resolved, recipients are `fetchLens`ed, `prune(user, lens)`d, and fanned out to
`deliverEmail`. We extend that stage; we don't add a new one.

**The lens is the hydration boundary — and therefore the logic boundary.** `fetchLens` + `prune(rows,
lens)` load and reduce a recipient to *exactly* the lens's picks/relations. A recipient resolved under
`OrgUser` physically has org fields loaded; one under `PlainUser` does not. So interpolation and `{{#if}}`
can only ever see what the lens hydrated — field/logic leakage is structurally impossible, and lens-aware
validation just turns a render-time empty into a save-time error.

**Encoding (serialized).** The deliver handoff already carries `recipient = prune(user, lens)` — the
pruned projection *is* the serialized boundary (plain JSON). Two extensions:
- prune each recipient to its **assigned** lens (richer picks than today's `{id,name,email}`) so
  `{{recipient.organization.name}}` has data;
- add `recipientLens: "<key>"` to the payload — the context tag for provenance, the `communicationLog`,
  and explicit context conditionals. The lens **definition** stays on the template; only the selected
  **key + its hydrated projection** travel.

**Two collisions, two enforcement points:**
- *Logic/field collision* — enforced by the hydration boundary (`prune`). Free.
- *Identity collision* (one person via several `to` lenses → two renders) — the planner already collapses
  same-email via `idempotencyKey` (email + shared `dataVars`) + `skipDuplicates` + `enqueueJob({ id })`,
  so one-email-per-person holds today — **but the winner is fetch order.** Fix: **precedence-dedup by
  identity before building the plan** — group the resolved union by user, pick the **first lens the user
  matches in declared `to` order** (author orders most-specific first), then prune + fan out. Declaration
  order *is* the precedence — deterministic, author-controlled, the same first-match rule `transitions`
  uses for paths. (It's the recipient's *membership context* — a distinct axis from sender-side tenancy;
  don't conflate.)

**Key uniqueness** is free if `lenses` is stored as a JSON **object** (map) — keys can't collide by
construction.

## Storage: DB, serializable (decided)

The matrix lives on `EmailTemplate` as a serializable `Json` field, tenant-configurable via the
existing owner cascade (a tenant can shadow the platform matrix). Transitions are pure data →
superadmins edit **send-governance for existing templates** with no deploy. `isSerializable()` /
`requireSerializable` keep it DB-safe.

### What DB storage does NOT unlock (the honest boundary)

Serializable matrix ≠ superadmin-authored *new functioning slugs*. A template still binds to code in
two places: **emission** (a code call site fires `enqueueJob('sendEmail', …)`) and **resolution**
(`apps/api/src/lib/email/registry.ts` `EmailEntry` turns an event into sender/recipient/data **rows**
via lens queries). Content + matrix = data; emission + resolution = code. Making net-new slugs fully
runtime-authored requires the *resolution* layer to become declarative too — a separate, larger
feature. Deferred (YAGNI) until asked. (Encouraging note: `EmailEntry` already returns serializable
`LensNarrowing`; the only non-serializable bits are the id-mapping closures.)

## Guard-only (decided)

A matched cell **authorizes** the pair. It does **not** select content — content variation by tier
stays with the owner cascade + component slots (COMM-009). No selector semantics in the matrix.

## Slices

- [x] **Slice 1 — matrix storage + structural save validation (this branch).** `matrix Json?` on
  `EmailTemplate`; `validateMatrix`/`assertValidMatrix` (pure) validate a well-formed, **serializable**
  set of transition paths (valid json-rules predicates + valid `ActionRule` permission shapes), wired
  into `saveEmailTemplate`. Domain-agnostic. **Done.** (Inline predicates for now — reshaped into
  lens-keyed form in slice 1b.)
- [x] **Slice 1b — `lenses` block + lens-keyed matrix. Done.** Added `lenses Json?` (`senders` +
  `recipients` name-keyed maps + `data`); matrix reshaped to `{ paths: [{ from: senderKey, to:
  recipientKey[] }] }`. `validateLenses` (structural: parent model, json-rules `where`, recipient lenses
  are `parent: User` with the `id/name/email` leaf) + `validateMatrix(matrix, lenses)` (cross-checks every
  `from`/`to` key ∈ declared lenses, non-empty paths/to). Both wired into `saveEmailTemplate`. Removed
  `@inixiative/transitions` from `@template/email` — structural validation is json-rules-only; the
  `checkTransition` **engine belongs at the api boundary** (slice 3), not the domain-agnostic render
  package.
- [ ] **Slice 2 — lens-scoped validation** at the domain-aware api boundary: model names are real
  (`lensFor`), `picks` reference real fields, and every `bind` resolves to something the context provides
  (a `data` field or the resolved sender) — a resolvable dependency chain. (Belongs where domain lenses
  live, not the domain-agnostic render package.)
- [ ] **Slice 2b — `composeLenses(template, data)`** — the ordered pipeline `data → sender(select+bind)
  → merge → recipient(bind, assert User leaf)`, producing `{ sender, recipient, data, system }` for
  interpolation. Mirrors `transitions` `from → merge → to`.
- [ ] **Slice 3 — send enforcement + dispatch.** At the planner (`sendEmail`, the send→deliver bridge):
  resolve each `to` lens → **precedence-dedup by identity** → prune each survivor to its assigned lens →
  serialize `{ recipient (pruned), recipientLens: key, sender, data }` into the deliver handoff. Guard via
  `canSend(matrix, sender, recipient, { actor, authorize })` over `checkTransition` (rebac `authorize` from
  `@inixiative/permissions`). Absent-matrix semantics (open vs closed) decided here. **Adds
  `@inixiative/transitions` to `apps/api`** (the enforcement engine's home). See "Dispatch, hydration
  boundary & collision".
- [ ] **Slice 4 — affordances.** `available`/`eligible` for "who can I send this to".
- [ ] **Slice 5 — DB override UX / superadmin editing** (validate on write via slice-2 validation).

## Related

- `@inixiative/transitions` (FEAT-018), `@inixiative/permissions`, `@inixiative/json-rules`.
- COMM-009 (lenses + component slots), COMM-001 (email system), `apps/api/src/lib/email/registry.ts`
  (the code `EmailEntry` resolver — the emission/resolution binding).
