# COMM-006: Email versioning hardening

**Status**: 📋 Proposed — follow-ups from the adversarial review of the versioning subsystem (COMM-003 §3 / "Template Versioning & Recompose")
**Priority**: Medium

---

Fixed inline already: no-op updates no longer rewrite an older immutable snapshot's pins; soft-delete
(`deletedAt` via update) now re-pins ancestors without stamping the tombstone. The items below are
design/perf calls left open.

## 1. Send-pin fidelity (HIGH) — `apps/api/src/jobs/handlers/deliverEmail.ts`

`deliverEmail` renders from the **live** cascade (`settleTemplate`) but pins `emailTemplateAuditLogId`
via an **independent** "latest snapshot" read — two unsynchronized reads, pin never set at planner
time. So an edit between compose and the pin-read, or a retry after an edit, makes recompose
reconstruct an *approximation* rather than the exact bytes sent. Backprop keeps the latest snapshot
current, so drift is narrow today — but the "reconstruct what was sent" guarantee isn't strictly
upheld.

Options: (a) **render from the pinned snapshot** — resolve the snapshot first, recompose+send from it,
so pin ≡ rendered by construction; (b) capture the pin at compose time in one read and accept
"latest-at-deliver" semantics, documented. (a) is the true fix; (b) is cheaper. Decide the semantic.

## 2. Async backprop walk (MEDIUM) — `apps/api/src/hooks/emailVersioning/hook.ts` `walkUp`

The walk's `findMany({ componentRefs: { has: slug } })` is scope-blind and runs **synchronously inside
the mutating txn**. Editing a shared `default` component fans out to every tenant/locale that
references the slug — O(tenants × refs) of `lookupCascade` + `auditLog` queries in the write path.
Correct (each ancestor resolves in its own scope; `sameIds` suppresses no-ops) but a latency footgun
at scale. Fix: enqueue the backprop as an after-commit job so the edit txn stays small.

## 3. Recompose guards (LOW) — `apps/api/src/lib/email/recompose.ts`

- No visited-set: recursion is bounded only by the live acyclic invariant. Add a visited set so a
  corrupted/cyclic pin graph can't stack-overflow.
- `replaceBlock` uses a brace-naive `{{#component:slug}}[\s\S]*?{{/component:slug}}` regex; safe today
  only because saved parent mjml empties child blocks. Reuse the depth-aware block matching
  (`extractRefs.findClose` / the canonical parser) instead of a second divergent implementation.

## 4. Lazy queue/Redis init (MEDIUM, infra) — `apps/api/src/jobs/queue.ts`

Importing the hooks barrel (for the seed wrapper, and anywhere) eagerly runs
`createRedisConnection()` + `new Queue(...)` at module load. With `maxRetriesPerRequest: null`, an env
without reachable Redis (e.g. a fork's release phase) would hang rather than fail fast. Make the queue
connection lazy (connect on first enqueue) so importing hooks doesn't require Redis.
