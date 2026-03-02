# FEAT-014: AI Developer Experience

**Status**: 🆕 Not Started
**Assignee**: TBD
**Priority**: High
**Created**: 2026-03-02
**Updated**: 2026-03-02

---

## Overview

Make the template **AI-native** as a first-class feature. Ship built-in skills, rules, agent configurations, and MCP servers so that AI coding assistants (Claude Code, Cursor, Windsurf, Copilot, etc.) can immediately understand and productively work in any project built on the template.

This is a differentiating feature — most templates ship code for humans. This template ships code *and* the AI context to work with it.

## Objectives

- ✅ AI assistants can immediately be productive in any template-based project
- ✅ Built-in skills for common workflows (commits, PRs, migrations, testing)
- ✅ Rules files that teach AI the codebase patterns, conventions, and architecture
- ✅ Agent configurations for specialized tasks (code review, security audit, migration)
- ✅ MCP servers for template-specific tooling
- ✅ Works across major AI coding tools (Claude Code, Cursor, Windsurf, Copilot)

---

## Tasks

### 1. Skills (Claude Code Slash Commands)

Pre-built skills that ship with the template for common workflows:

- [ ] `/db-migrate` — Generate Prisma schema change, push, generate client, update Zod schemas
- [ ] `/add-module` — Scaffold a new API module (controller, routes, hooks, tests, factory)
- [ ] `/add-encrypted-field` — Walk through adding a new encrypted field (schema, env, registry)
- [ ] `/add-job` — Scaffold a new background job (handler, registration, BullBoard config)
- [ ] `/security-check` — Scan for common vulnerabilities (exposed secrets, missing auth, SQL injection)
- [ ] `/test-module` — Run tests for a specific module with proper setup/teardown
- [ ] `/add-permission` — Add a new permission to the permix system with role assignments
- [ ] `/deploy-check` — Pre-deployment validation (encryption versions, schema drift, env vars)

**Implementation**: Skills as markdown files in `.claude/skills/` or equivalent per-tool format.

### 2. Rules Files

Contextual rules that teach AI assistants the codebase patterns:

- [ ] **Claude Code**: `.claude/rules/` — rules files that load contextually
  - `api-routes.md` — Route template patterns, controller conventions
  - `database.md` — Prisma patterns, typed IDs, model utilities
  - `encryption.md` — Field encryption patterns, registry usage
  - `testing.md` — Factory patterns, test utilities, test structure
  - `hooks.md` — Mutation lifecycle, validation, webhook patterns
  - `permissions.md` — Permix patterns, role validation
  - `frontend.md` — React patterns, data tables, state management
  - `imports.md` — Absolute imports, path aliases, cross-package rules
- [ ] **Cursor**: `.cursorrules` — consolidated rules for Cursor AI
- [ ] **Windsurf**: `.windsurfrules` — consolidated rules for Windsurf
- [ ] **Generic**: `.github/copilot-instructions.md` — GitHub Copilot instructions

**Source material**: The existing `docs/claude/*.md` files are the knowledge base — rules files should be distilled, actionable versions optimized for AI context windows.

### 3. Agent Configurations

Pre-built agent personas for specialized tasks:

- [ ] **Code Reviewer** — Reviews PRs against template patterns, catches anti-patterns
- [ ] **Security Auditor** — Checks for OWASP top 10, encryption gaps, auth bypasses
- [ ] **Migration Assistant** — Helps with schema migrations, data backfills, version upgrades
- [ ] **Module Builder** — Generates complete modules following all template conventions
- [ ] **Test Writer** — Generates tests using factory patterns, test utilities
- [ ] **Documentation Agent** — Keeps docs/claude/* in sync with code changes

**Implementation**: Agent configurations as YAML/markdown in `.claude/agents/` or equivalent.

### 4. MCP Servers (Model Context Protocol)

Template-specific MCP servers that give AI tools direct access to template internals:

- [ ] **Schema MCP** — Query Prisma schema, relationships, field types
- [ ] **Module MCP** — List modules, their routes, controllers, hooks
- [ ] **Encryption MCP** — Check encryption status, key versions, rotation state
- [ ] **Permission MCP** — Query permission matrix, roles, entitlements
- [ ] **Job MCP** — List background jobs, check queue status, trigger runs

**Implementation**: MCP servers in `packages/mcp/` or `tools/mcp/`.

### 5. AI Onboarding & Context

First-run experience for AI assistants:

- [ ] **Project summary** — Auto-generated context about the specific project (not just the template)
- [ ] **Architecture diagram** — Mermaid diagram of the actual deployed architecture
- [ ] **Module index** — Machine-readable index of all modules, routes, and capabilities
- [ ] **Pattern catalog** — Extracted patterns from codebase with examples
- [ ] **CLAUDE.md generation** — Script to regenerate CLAUDE.md from doc sources when docs change

### 6. Init Script Integration

- [ ] Add AI tool setup to init script (INFRA-001)
  - Detect which AI tools are installed
  - Generate appropriate rules files
  - Configure MCP servers
  - Set up skills
- [ ] Generate project-specific context on `bun run init`

---

## Open Questions

1. **Scope for MVP**: Skills + rules files first? Or MCP servers too?
2. **Cross-tool strategy**: Maintain separate rules per tool, or single source with generators?
3. **Rules vs CLAUDE.md**: Move pattern docs into rules files and simplify CLAUDE.md?
4. **MCP server priority**: Which MCP servers would provide the most value first?
5. **Versioning**: How do we keep AI context in sync as the template evolves?

---

## Implementation Notes

### Existing Foundation

The template already has a strong AI foundation:
- `CLAUDE.md` — comprehensive project instructions
- `docs/claude/*.md` — 20+ detailed documentation files
- Pattern-based architecture — consistent conventions across modules
- Factory-based testing — predictable test patterns

### What's Missing

- **No skills** — common workflows require manual steps
- **No contextual rules** — AI must read CLAUDE.md + navigate to docs manually
- **No agents** — no pre-built specialized personas
- **No MCP servers** — AI can't query project internals programmatically
- **No cross-tool support** — only Claude Code via CLAUDE.md, nothing for Cursor/Windsurf/Copilot
- **No auto-generation** — context files are manually maintained

### Recommended MVP

1. **Phase 1**: Rules files (`.claude/rules/`, `.cursorrules`) — highest impact, lowest effort
2. **Phase 2**: Skills (3-5 core skills) — automate common workflows
3. **Phase 3**: Agent configurations — specialized AI personas
4. **Phase 4**: MCP servers — programmatic access to template internals

---

## Definition of Done

- [ ] Rules files ship with template for Claude Code, Cursor, and Copilot
- [ ] At least 5 skills for common workflows
- [ ] At least 3 agent configurations
- [ ] At least 1 MCP server (schema or module index)
- [ ] Init script detects and configures AI tools
- [ ] Documentation covers AI DX features
- [ ] Cross-tool rules generation from single source

---

## Resources

- [CLAUDE.md](../CLAUDE.md) — current AI instructions
- [docs/claude/](../docs/claude/) — documentation knowledge base
- [Claude Code Skills docs](https://docs.anthropic.com/en/docs/claude-code)
- [Cursor Rules docs](https://docs.cursor.com)
- [MCP specification](https://modelcontextprotocol.io)

---

## Related Tickets

- [FEAT-004: AI Providers](./FEAT-004-ai-providers.md) — AI provider integration (complementary)
- [INFRA-001: Init Script](./INFRA-001-init-script.md) — AI tool setup during init
- [FEAT-013: Encryption](./FEAT-013-encryption.md) — encryption skill/MCP server

---

## Comments

_2026-03-02: Created. The template's existing documentation (CLAUDE.md, docs/claude/) is a strong foundation. This ticket is about packaging that knowledge into formats every AI tool can consume, plus adding skills and MCP servers for workflow automation._
