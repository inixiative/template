# Claude Code Agent

## Startup sequence

1. Read `AI/ENTRYPOINT.md` (canonical rules)
2. Read task from `tickets/` if applicable
3. Check `AI/rules/` for domain-specific conventions

## Subagent patterns

- Delegate large codebase exploration to fast subagents (Haiku)
- Orchestrate parallel work through the Agent tool with subagent_type=general
- Pass relevant `AI/rules/` context to subagents explicitly

## Skills

Stored in `.claude/commands/`. Invoke with `/skill-name`.
See `AI/ENTRYPOINT.md` §11 for doc routing before implementing.

## Handoff to Codex

Leave structured context in:
- PR description (implementation state, decisions made)
- Ticket in `tickets/` if task is ongoing
