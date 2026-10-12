# Layout: template

- `#` aliases inside apps and `@pkg` imports across packages. No relative imports outside index barrels. [×10 · ↻2 · 2026-01-23→02-10 · ENTRYPOINT §8 · REC]
- Arrow functions throughout. [×3 · ↻2 · STYLE.md 2026-01-26 · REC]
- Separate route and controller files; route args go at the top of the spread object. [×2]
- Generated files are named `*.gen.*`, gitignored, and never edited or written into the tree by tools. [×9 · ↻1 · 2026-02-06→04-26 · MONOREPO.md · REC]
- Init script: everything async exec, no console logs, TUI-only output. [×6 · 2026-02-15→03-29 · INIT_SCRIPT_PATTERNS §7]
- Env lives at the root; app-level env files hold only specific overrides. [×2]
- Stay on the latest dependency versions, majors included. It's a template. [×2 · 2026-03-04→08]
- DX and elegance come first, not just "it works". [×2 · ENTRYPOINT §0]
- Keep things consistent everywhere: names, call patterns, store passing, package layout, shared constants for tags and models. [×18 · 2026-01-25→02-11]
- Package layering:
  - FE code lives in `ui`;
  - shared types live in `permissions`;
  - backend never imports `ui`;
  - permission logic lives in the permissions package.

  [×6 · MONOREPO.md / ARCHITECTURE.md]
- Clients and adapters are cached singletons behind a platform adapter. Interfaces exist only for external services. [×6 · ADAPTERS.md]

## Reference docs (imported; the file sits at `<repo>/.foundry/roles/<role>/domainKnowledge.md`)

@../../../docs/claude/STYLE.md
@../../../docs/claude/MODULES.md
@../../../docs/claude/MONOREPO.md
@../../../docs/claude/LOGGING.md
