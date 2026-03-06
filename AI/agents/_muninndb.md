# MuninnDB — AI Memory System

Three vaults, three scopes:

| Vault | MCP server | Scope | Endpoint |
|-------|-----------|-------|----------|
| Template | `muninndb_template` | Read-only golden rules shipped with the template | Seeded from `__template/muninndb/`, local container |
| Local | `muninndb_local` | Current developer session | `http://localhost:8750/mcp` (MCP) · `http://localhost:8475` (REST) |
| Team | `muninndb_team` | Shared across all agents and devs | Railway URL + team token |

**Read order**: `muninndb_template` → `muninndb_team` → `muninndb_local`

## Starting local

```sh
docker compose up muninndb
# REST API:  http://localhost:8475
# Admin UI:  http://localhost:8476
# MCP:       http://localhost:8750/mcp
```

Handled automatically by `bun run setup`.

## MCP server names

Use underscores — avoids bracket access in JS:
- `muninndb_local`
- `muninndb_team`

## Write discipline

| Write to template | Write to team | Write to local |
|-------------------|---------------|----------------|
| Template-wide golden rules (via `__template/muninndb/` seed) | Validated project-specific decisions | In-progress debug, drafts, session state |
| Stack conventions true for any project from this template | Resolved bugs with root cause | Temporary context |

Template vault is treated as read-only at runtime — update it via `__template/muninndb/` and re-seed.
Promote local → team only after a finding is validated (working code, verified pattern).

## Provisioning

- **Local**: `docker compose up muninndb` — bind mount at `./volumes/muninndb/`, survives `docker compose down -v`
- **Shared**: `bun run init` → Railway Setup (auto-provisions MuninnDB as part of Railway setup)
- **`.mcp.json`**: written by init script post-Railway-setup; gitignored. Reference: `.mcp.json.example`

## Seeding

Initial golden memory lives in `__template/muninndb/`. Seeded into the team vault on first `bun run init`.
