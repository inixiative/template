# COMM-006: Email versioning + seed hardening

**Status**: 📋 Proposed — residual follow-ups from the adversarial review of the versioning subsystem
**Priority**: Low / Medium

---

Resolved in this PR (kept here for the record):

- **No-op updates don't rewrite snapshots** — the `sameIds` guard plus the backprop invariant (a
  parent's latest snapshot always pins its children's current snapshots) mean a no-op never diverges.
  Confirmed by test.
- **Soft-delete** (`deletedAt` via update) re-pins ancestors without stamping the tombstone.
- **No send-pin drift** — deliver renders live, and the latest snapshot recomposes to *exactly* the
  live composition (backprop invariant). Confirmed by test (live == recompose(latest), before and
  after an edit).
- **Scope-wide backprop fan-out is intended** — editing a shared `default` component re-pinning every
  inheriting tenant is the cascade working as designed, not a bug.
- **Seed fails loud** — the wrapper no longer try/catches; a seed error propagates with its stack.

## 1. Recompose guards (LOW) — `apps/api/src/lib/email/recompose.ts`

- No visited-set: recursion is bounded only by the live acyclic invariant. Add a visited set so a
  corrupted/cyclic pin graph can't stack-overflow.
- `replaceBlock` uses a brace-naive `{{#component:slug}}[\s\S]*?{{/component:slug}}` regex; safe today
  only because saved parent mjml empties child blocks. Reuse the depth-aware block matching
  (`extractRefs.findClose` / the canonical parser) instead of a second divergent implementation.

## 2. Lazy queue/Redis init (MEDIUM, infra) — `apps/api/src/jobs/queue.ts`

Importing the hooks barrel eagerly runs `createRedisConnection()` + `new Queue(...)` at module load, so
the seed wrapper opens a Redis connection (and relies on `process.exit(0)` to terminate). With
`maxRetriesPerRequest: null`, an env without reachable Redis would hang rather than fail fast. Make the
queue connection lazy (connect on first enqueue) so importing hooks doesn't require Redis.

## 3. Version restore is cross-ownership (note)

Restoring a template/component to a prior snapshot is not a simple content set-back. A parent version
pins specific child snapshots, so restoring it implies restoring those children too — but a pinned
child may live at a different owner level (default/org/space) or belong to a different sender than the
actor doing the restore, who may not have write access to it. Restore must reconcile which
subcomponents actually change, whether the actor's sender owns / can write them, and what to do when a
pinned child sits at a level the actor can't touch. Design this against the permission model before
building it.

Candidate approach: a **degraded component-ids list** on the restore — restore the parent plus the
children the actor can write, and record the ids of pinned children that couldn't be restored
(different owner level / no access), leaving those at their current version. The restore is then
explicitly partial: the list says which components are not at the intended version (rhymes with the
`degrade` render-error policy). Tradeoff: a hybrid state consumers must understand, vs. the alternative
of forking the inaccessible children down to an owned level (copy-on-restore) so the restore is whole.

## 4. Component-scoped degrade + error attribution (note)

Intended semantic: `degrade` drops only a failing **component** block and sends the rest; a failure in
the **main template's own** content is a hard error (the send fails, recorded in the log's `error`).
Today, after `expand` inlines components into one mjml, the evaluator can't tell a template-native
block from a component block, so it degrades any throwing block uniformly — it can't enforce
"components only." The same gap blocks observability: capture degraded errors as
`{ emailComponentId: errors[] }` (which component produced what), logged and/or stored on the
`CommunicationLog`. Both need component **provenance** carried through `expand`/`interpolate` so a block
(and its errors) knows its source component.
