# Frontend: template

- Admin and superadmin surfaces need no permission checks and no searchable-field declarations. [×3 · 2026-03-03→03-18]
- Superadmin is deployed separately, not with the user app.
- Flows: banner and Modal share one `flowNext` rule, the store holds only `flowId`, and `useStartFlow` returns `{ started, flow }`. [template #177 review]

## Reference docs (imported; the file sits at `<repo>/.foundry/roles/<role>/domainKnowledge.md`)

@../../../docs/claude/ZUSTAND.md

_Budget note: FRONTEND.md (70 KB) is left out: alone it nearly fills the 80k budget. Import its parts once FRONTEND.md is split by topic._
