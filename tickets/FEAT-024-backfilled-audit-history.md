# FEAT-024: Backfilled audit history (sketch)

**Status**: 💡 Sketch: discuss before starting
**Priority**: Low
**Created**: 2026-11-18
**Related**: [FEAT-017](./FEAT-017-audit-log-hardening-lineage-and-explorer.md) (audit hardening and lineage), [FEAT-019](./FEAT-019-extensible-actor-attribution.md) (actor attribution), [INFRA-020](./INFRA-020-audit-logs-cold-storage.md) (cold storage)

## Why (Aron, 2026-11-18)

Raised while separating ordering tokens (generations, sequences, versions) from history. Those tokens
say "is mine still the newest" and are thrown away; they are not a record of what happened. The audit
log is the record, and it only holds what it captured at write time. Sometimes we want history it never
captured: "if we need to insert fake audit logs into the past so that you have the correct chain of
custody". Aron: "the idea is at least worth considering", and the provenance part "is a little sus" and
may be hard. These are sketches of the idea, not a design. Talk them through before any work starts.

## Sketches of the record types

1. **Imported history.** Rows migrated from another system (Zealot's legacy Workato sync, a customer's
   old CRM), with the original actor and time where the source knows them.
2. **Reconstructed history.** Changes made by background work that the audit log records only as the
   system actor: segment membership moved by a reconcile, derived values written by a job. The record
   would name the cause (the event or job, and the generation it ran on).
3. **Backdated corrections.** An operator fixing data as of an earlier date: written now, with an
   effective time in the past.

## The open questions (why this is a sketch)

- **Provenance.** A backfilled row must never pass for a captured one. Something like `captured`,
  `imported`, `reconstructed`, `corrected` plus its source, but who may write each, and whether a
  reconstructed row can be trusted at all, is unsettled. This is the part that "is a little sus".
- **Two clocks.** When it happened versus when we wrote it down. Every reader of the audit log (the
  explorer, lineage, retention, cold storage) would have to say which clock it means.
- **Tamper evidence.** Writing into the past is exactly what an audit log exists to prevent. If the log
  is ever hash-chained or append-only (FEAT-017), backfill must append, never rewrite.
- **Is it worth it.** Each type may be better served by something smaller: an import table kept apart
  from the audit log, or a cause column on today's rows.
</content>
</invoke>
<invoke name="Bash">
<parameter name="command">python3 - <<'EOF'
p='tickets/kanban-backlog.md'; s=open(p).read()
a="- [FEAT-019: Extensible Actor Attribution](./FEAT-019-extensible-actor-attribution.md) - actorMeta extension point + on-behalf-of for integration tokens; attribution-only, never authz\n"
assert a in s
s=s.replace(a,a+"- [FEAT-024: Backfilled Audit History](./FEAT-024-backfilled-audit-history.md) - Sketch, discuss before starting: imported, reconstructed and backdated history with provenance\n")
open(p,'w').write(s)
EOF
git status -s