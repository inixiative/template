# Schema: template

- `db push` for now; migrations come later (pre-users). [×2 · 2026-01-27→02-02]
- All timestamps are UTC. [×1 · 2026-01-25]
- Soft-delete scope is a client extension, always on; the engine lives in `packages/db` (#172). `authProviderDelete` must soft-delete (an audit-enabled model), using a partial unique index. Open follow-up. [COORDINATION]
- Template tests must not wipe soft-delete models with `deleteMany({})`. [COORDINATION 10-10]

## Reference docs (imported; the file sits at `<repo>/.foundry/roles/<role>/domainKnowledge.md`)

@../../../docs/claude/DATABASE.md
@../../../docs/claude/HOOKS.md

_Budget note: BATCH.md is summarized in the org node (bulk writes keep hooks); left out to fit the 80k budget._
