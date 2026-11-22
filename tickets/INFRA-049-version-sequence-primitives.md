# INFRA-049: Version sequence primitives

**Status**: 🆕 Not Started
**Priority**: Low
**Created**: 2026-11-18
**Related**: [INFRA-047](./archived/INFRA-047-transaction-cache-overlay.md) (cache generation fence), [INFRA-033](./INFRA-033-segment-reconcile-perf-budget.md) (segment reconcile)

## Why (Aron, 2026-11-18)

While fixing the superseded marks we found three "only the newest counts" mechanisms, each written for
one caller. Aron: "These are all version sequence primitives that we might want to abstract out and give
them each a name or style in version sequencing utils." They are ordering tokens, not history: they
answer "is mine still the newest" and are thrown away (history is the audit log; see FEAT-024).

## The three styles

| Style | Contract | Store | Today |
|---|---|---|---|
| generation | The newest computation wins: read a token, compute, publish only if the token has not moved | Redis | the cache (`packages/db/src/redis/cache/generation`, `publishIfCurrent`) |
| sequence | Strict order: a counter per stream; readers apply in order and drop anything at or below their snapshot | Redis | WebSocket data streams (`ws/streamSeq.ts`, `claimStreamSeq`) |
| version | Refuse a stale write: the writer carries the version it read, and the write fails if the row moved | Postgres | inquiries (`inquiryVersionSchema`) |

## The work

- One module, `packages/db/src/versionSequence/`, a folder per style, each existing caller moved onto it
  (no copy beside the old one). Atomic scripts stay atomic: the cache writes a value and its generation in
  one Lua script, so extract the key and token helpers, not the writes.
- One CONCURRENCY.md page on which to use when: generation for recomputed state, sequence for ordered
  streams, version for user edits.
- Not needed by the segment reconcile today: superseding and singleton jobs are safe to re-run, and the
  nightly backstop corrects an overlap (decided 2026-11-18 while settling template #307). A caller that
  needs ordering adopts the generation style then.
</content>
</invoke>
<invoke name="Bash">
<parameter name="command">cd ~/code/inixiative/template/.worktrees/fix-delete-superseded-mark-on-skip && python3 - <<'EOF'
p='tickets/kanban-backlog.md'; s=open(p).read()
a="- [INFRA-033: Segment Reconcile Perf Budget](./INFRA-033-segment-reconcile-perf-budget.md)"
i=s.index(a); j=s.index("\n",i)
s=s[:j+1]+"- [INFRA-049: Version Sequence Primitives](./INFRA-049-version-sequence-primitives.md) - generation, sequence and version as named styles in one module, existing callers moved onto it\n"+s[j+1:]
open(p,'w').write(s)
p='tickets/INFRA-033-segment-reconcile-perf-budget.md'; s=open(p).read()
s=s.replace("Measure how many repeat runs over the same customer burst writes cause.","Measure how many repeat runs over the same customer burst writes cause. Overlapping runs are not ordered: the job is safe to re-run, and an older run that writes last is corrected by the customer's next change or the nightly sweep (2026-11-18); if that window shows up in practice, order the writes with INFRA-049's generation style.")
open(p,'w').write(s)
EOF
git status -s | head -30