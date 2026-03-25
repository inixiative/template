# Claude Code Agent

## Startup sequence

1. Query `muninndb_team` for prior context on the current task domain
2. Query `muninndb_local` for current session state
3. Read task from `tickets/` if applicable
4. Check `AI/rules/` for domain-specific conventions

## MCP connection

After `bun run setup`, `.mcp.json` is written with:
- `muninndb_local` → `http://localhost:8750/mcp`
- `muninndb_team` → Railway URL with team token

If `.mcp.json` is missing, run `bun run init` → Railway Setup to regenerate it.

## Memory discipline

| Write here | When |
|------------|------|
| `muninndb_local` | In-progress debug, drafts, session state |
| `muninndb_team` | Validated patterns, architectural decisions, resolved bugs |

Promote local → team only after a finding is verified (working code, confirmed pattern).

## Subagent patterns

- Delegate large codebase exploration to fast subagents (Haiku)
- Orchestrate parallel work through the Agent tool with subagent_type=general
- Pass relevant `AI/rules/` context to subagents explicitly

## Skills

Custom skills stored in `.claude/commands/`. Invoke with `/skill-name`.
See `AI/ENTRYPOINT.md` §10 for doc routing before implementing.

### External skills

Declared in `AI/skills/manifest.json`. Install with `bun run setup:skills`.

- **superpowers** (plugin) — structured workflow: brainstorm → plan → TDD → debug
- **react-best-practices** (skills-cli) — 40+ React performance rules
- **web-design-guidelines** (skills-cli) — 100+ accessibility/UX rules
- **composition-patterns** (skills-cli) — React component design patterns

Plugin skills require interactive install: `/plugin install superpowers@claude-plugins-official`

## Handoff to Codex

Leave structured context in:
- PR description (implementation state, decisions made)
- `muninndb_team` (validated findings)
- Ticket in `tickets/` if task is ongoing
