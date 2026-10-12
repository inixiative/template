# Reuse: template (and its Kingdom/Tribe copies)

Evidence: template slices ×65 + root sessions; REC through 10-12. **Grep these before writing anything in their area.**

| Need | Use |
|---|---|
| Route + controller | `createRoute`/`readRoute`/… request templates, `makeController`, `respond.*`; generated zod schemas, never hand-written (`sanitizeKeys` strips system fields) |
| Caller error | `makeError` (4xx); server faults throw raw (`respond500`) |
| Row lock / upsert under contention | `findForUpdate` |
| Transaction | `db.txn`, with events deferred to onCommit |
| Bulk writes | `createManyAndReturn` / `updateManyAndReturn` (hooks see results) |
| Background work | `makeJob` + `enqueueJob`; app events via `emitAppEvent` |
| Requests between parties | Inquiries: handler `sources`/`targets`/`autoApprove`, `sendInquiry` |
| Multi-step UI journeys | flows: one `checkFlow` verb, registry folder, store holds `flowId`, `useStartFlow` (#177) |
| URL/hash state | `urlSync`, `useSectionHash`, `resolveSectionTarget` |
| Operation lookup | `resolveOperation`, generic `apiPath`, `readAllAsCaller`, `fetchAllPages` |
| Spoof/impersonation-like UI state | a store field (like `spoof`), not a React provider |
| Env | the with-env script; `bun run setup`, `bun run worktree:create` |
| Tests | factories, `registerTestTracker`, `cleanupTouchedTables`, `createTestApp`, VCR |
| Request context | `c` / store / AsyncLocalStorage, not threaded args (×14 · ↻4 · REC 10-12) |
| Authorization | permix/rebac rules in the permissions package |

- Read `docs/claude/<SUBSYSTEM>.md` before touching a subsystem.
- Generate artifacts from the schema (infer with include/exclude overrides); never hand-maintain lists. [×3 · 2026-01-25→27]

## Reference docs (imported; the file sits at `<repo>/.foundry/roles/<role>/domainKnowledge.md`)

@../../../docs/claude/JOBS.md
@../../../docs/claude/CONCURRENCY.md
@../../../docs/claude/SEGMENTS.md
@../../../docs/claude/FLOWS.md

_Budget note: REDIS.md and INQUIRIES.md are left out to fit the 80k budget (the Authority Warden reads INQUIRIES.md; the Inquiry rule is in the org node)._
