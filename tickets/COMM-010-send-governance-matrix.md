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

- [ ] **Slice 1 — storage + save validation (this branch).** `matrix Json?` on `EmailTemplate`;
  `validateMatrix`/`assertValidMatrix` (pure) validate the Action is a well-formed, **serializable**
  set of transition paths (valid json-rules predicates + valid `ActionRule` permission shapes), wired
  into `saveEmailTemplate`. **Domain-agnostic** — no lens yet (structural floor only). Lives in
  `@template/email` (transitions/permissions are generic primitives, like json-rules).
- [ ] **Slice 2 — lens-scoped validation** at the domain-aware api boundary: pass sender/recipient
  lenses so predicates can only reference real fields. (Belongs where domain lenses live, not the
  domain-agnostic render package.)
- [ ] **Slice 3 — send enforcement.** `canSend(matrix, sender, recipient, { actor, authorize })` over
  `checkTransition`, wired into the send path (`sendEmail`/`deliverEmail`) with the rebac `authorize`
  from `@inixiative/permissions`. Absent matrix semantics (open vs closed) decided here.
- [ ] **Slice 4 — affordances.** `available`/`eligible` for "who can I send this to".
- [ ] **Slice 5 — DB override UX / superadmin editing** (validate on write via slice-2 validation).

## Related

- `@inixiative/transitions` (FEAT-018), `@inixiative/permissions`, `@inixiative/json-rules`.
- COMM-009 (lenses + component slots), COMM-001 (email system), `apps/api/src/lib/email/registry.ts`
  (the code `EmailEntry` resolver — the emission/resolution binding).
