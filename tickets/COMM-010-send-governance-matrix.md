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

| side | leaf | varies by | compose mode |
|---|---|---|---|
| **sender** | `Organization` / `Space` / `User` / `platform` | **model** (real polymorphism) | discriminated *selection* — pick one model lens |
| **recipient** | **always `User`** | **provenance context** (plain / org-member / space-member) | base `User` leaf + *additive* provenance overlay |

You never merge sender lenses (choose one); you always start the recipient from the `User` leaf and
overlay provenance. So the `lenses` block is `senders` (a model **map**) + `recipient` (**singular**, a
`User` lens) — not a symmetric `model => model`.

### Recipient — defined

- **Leaf: always `User`.** Required picks `id, name, email`. `email` is the delivery address — the send
  **fails** if it can't resolve a `User` with a non-empty email. `{{recipient.name}}`/`{{recipient.email}}`
  are always these User fields.
- **Provenance is optional and *bound from the send context*, not walked from the user.** The org isn't
  discovered by traversing the User's memberships — it's the **send's** org (the resolved sender's
  `organizationId` / `data.organizationId`) attached for `{{recipient.organization.*}}`. Provenance chain:
  `organizationUser → organization` (and the parallel `spaceUser → space`).
- **The matrix `to` side is always `User`;** which provenance is attached is decided by the cell's `from`.
  `Organization => User` means "the User addressed *as a member of* that Organization" — the `to` binding
  pulls the sender's org onto the recipient.

### Sender — defined

A **model map**: one lens per allowed sender model, each self-contained with its own bindings (e.g.
`Organization` bound from `data.organizationId`). The matrix `from` selects exactly one.

### Data — defined

The event-payload lens and the **root binding source** (`data.organizationId`, `data.targetUserId`, …).
Universal (not matrix-varying), like `system`.

### Composition pipeline (ordered, context-threaded)

```
data (root bindings)
  → select + bind SENDER by model
  → merge sender identity into the binding context
  → bind RECIPIENT (User leaf + provenance) against the MERGED context
  → assert the User leaf (email present) or fail
  → hand { sender, recipient, data, system } to interpolation
```

This **is** `transitions`' `from → merge → to`: sender = `from` (reads the current/data context),
recipient = `to` (reads the context **merged** with the sender). Attaching the sender's org onto the
recipient *is* the merge — so the governance guard and lens composition walk the **same edge, same
direction, one mechanism.**

### `lenses` block shape

```jsonc
{
  "senders":   { "Organization": { "picks": [...], "bindings": {...} },   // model map (choose one)
                 "Space": {...}, "User": {...} },
  "recipient": { "picks": ["id","name","email"],                          // always the User leaf
                 "provenance": { "organization": { "picks": [...], "bind": "sender.organizationId" },
                                 "space":        { "picks": [...], "bind": "sender.spaceId" } } },
  "data":      { /* payload schema — root bindings */ }
}
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
