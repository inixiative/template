# Authority: template

- Authorization goes through permix/rebac rules (`docs/claude/PERMISSIONS.md`). No separate entitlement helpers. [×8 · 2026-01-26→02-02]
- The permissions package holds the permission logic and shared types; the frontend imports from there. [×6]
- Open for Aron: the `intersectEntitlements` null-drop. [COORDINATION 10-11]

## Reference docs (imported; the file sits at `<repo>/.foundry/roles/<role>/domainKnowledge.md`)

@../../../docs/claude/PERMISSIONS.md
@../../../docs/claude/INQUIRIES.md

_Budget note: AUTH.md (44 KB) is left out to fit the 80k budget; import its authentication half once AUTH.md is split._
