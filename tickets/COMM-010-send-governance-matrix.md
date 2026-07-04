# COMM-010: Email send-governance matrix (sender→recipient), transitions-based

**Status**: 🟡 In progress — slice 1 (storage + save validation) building on branch `claude/email-interpolation-slots-pnnkti`
**Assignee**: Unassigned
**Priority**: Medium
**Created**: 2026-07-04

---

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

| side | cardinality | leaf | varies by | compose mode |
|---|---|---|---|---|
| **sender** | **exactly one** (one `From`) | `Organization` / `Space` / `User` / `platform` | **model** (polymorphism) | discriminated *selection* — pick one lens |
| **recipient** | **a set** (fan-out) | email + `Contact` (a `User` **or** external `Contact`) | filter / scope / type (set-valued, polymorphic) | *union* of the `to` side's lens keys |

The real asymmetry is **cardinality** (one sender vs a recipient set), not model. You pick one sender
lens; you union the `to` side's recipient lenses and fan out. Both sides are name-keyed lens **maps**.

### Recipient — defined (set-valued, polymorphic)

A recipient is **not a single row — it's a SET** (fan-out: one email + one `CommunicationLog` per member).
So a recipient lens is a **query** (`LensNarrowing`: parent + where + picks + bindings) resolving 0..N
rows, and the `to` side is a **map of such lenses**, OR-ed (union). This is already how
`EmailEntry.recipients` works.

- **Cardinality is the real sender/recipient asymmetry** — sender = exactly one identity (one `From`);
  recipient = a set. Not "recipient is always a `User`."
- **Multiplicity lives in the lens vocabulary:**
  - `where` = filter — "org users **of this level**" is a `role`/level clause.
  - **binding present/absent = scope** — bind the org → that org's users; leave it unbound → *all orgs'*
    users of that level.
  - **which lens key = polymorphic type** — "customer refs" resolve via a **map** of lenses keyed by
    concrete type (`User` | `Contact` | `OrganizationBillingContact`), the matrix cell or a `data`
    discriminator selecting which.
- **Deliverable-leaf invariant (generalized):** every resolved row must yield **(a) an email address and
  (b) a `Contact`** (consent / kind / unsubscribe) — whether the row is a `User` or an external `Contact`.
- **Provenance** (org/space context for `{{recipient.organization.*}}`) is still **bound from the send
  context**, attached per resolved row at fan-out.
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
    "OrgUsersAll":   { "parent": "User", "where": { "organizationUser": { "organizationId": "⟨bind⟩" } },
                       "picks": ["id","name","email"],
                       "provenance": { "organization": { "picks": [...], "bind": "sender.organizationId" } } },
    "OrgUsersAdmin": { "parent": "User", "where": { "organizationUser": { "organizationId": "⟨bind⟩", "role": "admin" } }, "picks": ["id","name","email"] },
    "ExternalContacts": { "parent": "Contact", "where": {...}, "picks": ["id","name","email"] }
  },
  "data": { /* payload schema — root bindings */ }
}
// matrix: { paths: [ { from: "Organization", to: ["OrgUsersAdmin", "ExternalContacts"] } ] }  // keys, OR-ed
```

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
- [ ] **Slice 1b — `lenses` block + lens-keyed matrix.** Add `lenses Json?` (`senders` model-map +
  singular `recipient` User-leaf-with-provenance + `data`); matrix `from`/`to` become **lens keys**, not
  inline predicates. `validateMatrix` cross-checks every key ∈ declared lenses and that `recipient` keeps
  the required `User(id,name,email)` leaf. Still structural/domain-agnostic.
- [ ] **Slice 2 — lens-scoped validation** at the domain-aware api boundary: model names are real
  (`lensFor`), `picks` reference real fields, and every `bind` resolves to something the context provides
  (a `data` field or the resolved sender) — a resolvable dependency chain. (Belongs where domain lenses
  live, not the domain-agnostic render package.)
- [ ] **Slice 2b — `composeLenses(template, data)`** — the ordered pipeline `data → sender(select+bind)
  → merge → recipient(bind, assert User leaf)`, producing `{ sender, recipient, data, system }` for
  interpolation. Mirrors `transitions` `from → merge → to`.
- [ ] **Slice 3 — send enforcement.** `canSend(matrix, sender, recipient, { actor, authorize })` over
  `checkTransition`, wired into the send path (`sendEmail`/`deliverEmail`) with the rebac `authorize`
  from `@inixiative/permissions`. Absent matrix semantics (open vs closed) decided here.
- [ ] **Slice 4 — affordances.** `available`/`eligible` for "who can I send this to".
- [ ] **Slice 5 — DB override UX / superadmin editing** (validate on write via slice-2 validation).

## Related

- `@inixiative/transitions` (FEAT-018), `@inixiative/permissions`, `@inixiative/json-rules`.
- COMM-009 (lenses + component slots), COMM-001 (email system), `apps/api/src/lib/email/registry.ts`
  (the code `EmailEntry` resolver — the emission/resolution binding).
