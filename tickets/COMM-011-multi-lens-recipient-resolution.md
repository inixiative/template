# COMM-011: Multi-lens sender/recipient resolution (backlog)

**Status**: 🧊 Backlog — open question, deliberately deferred
**Created**: 2026-07-04

---

## Decision that parked this

COMM-010 converged on the simple model: **one sender + one recipient lens per template** — one
matrix path, one hydration boundary per side, zero lens-selection logic. Different audiences =
different templates (one app event may fan out to several handoffs/templates; the bridge already
supports this). Registry lives in code; the `EmailTemplate.lenses`/`matrix` DB columns stay modeled
but dormant.

This ticket holds the **complex** version in case the simple system proves it's needed.

## The open question

Can/should one template serve **multiple recipient classes at once** (plain user, org user, space
user — different lenses, different provenance, one send)? And multiple sender identities?

## What was already designed (see COMM-010 for full detail)

- `to` = ordered list of recipient lens keys; recipient set = **union**, dedup by identity,
  **first-match-in-declared-order wins** (declaration order is precedence).
- Each recipient carries the lens that produced it → per-(user, lens) rendering; template must be
  authored against the **union of surfaces** (fields not in all lenses must be `{{#if}}`-guarded).
- Lens selection happens once at the planner (send→deliver bridge); handoff serializes the pruned
  projection + a `recipientLens` key tag.
- Governance matrix as `@inixiative/transitions` paths (sender=from, recipient=to) — guard-only.

## The key modeling insight to preserve

For polymorphic targets ("customer refs"), **the join row is the real target** — e.g. a customer
*rep* (the join between org and user) is what you actually address, and reasoning from the join
resolves recipients better than overloading lenses on `User`. Explore "address the join model,
derive the User(s) from it" before reaching for multi-lens unions — it may dissolve most of the
need for this ticket.

## Revisit when

- A real template genuinely needs one send across heterogeneous audiences (not just several
  templates on one event), or
- tenant-configurable send governance (edit who-can-send-to-whom without deploy) becomes a product
  requirement.

## Related

COMM-009 (slots, lenses vocabulary), COMM-010 (governance matrix — storage/validation shipped,
enforcement deferred), `@inixiative/transitions`.
