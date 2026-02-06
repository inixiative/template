# Tickets

Project task tracking using Mermaid kanban boards and markdown tickets.

## Structure

```
tickets/
├── README.md                          # This file
├── kanban-{person}.md                 # Individual kanban boards
├── {CATEGORY}-{NUM}-{slug}.md         # Individual ticket files
└── archived/                          # Completed tickets
    └── {CATEGORY}-{NUM}-{slug}.md
```

## Kanban Boards

Each team member has their own kanban board, plus a shared backlog:

- [Hernan's Board](./kanban-hernan.md) - Active work
- [Aron's Board](./kanban-aron.md) - Active work
- [Backlog Board](./kanban-backlog.md) - Future enhancements (unassigned)

## Ticket Format

Tickets use the naming convention: `{CATEGORY}-{NUM}-{slug}.md`

Examples:
- `OTEL-001-observability-infrastructure.md`
- `AUTH-002-oauth-providers.md`
- `DB-003-audit-logging.md`

### Categories

- **OTEL** - Observability, telemetry, monitoring
- **AUTH** - Authentication, authorization
- **DB** - Database, schema, migrations
- **API** - API endpoints, routes
- **FE** - Frontend, UI, UX
- **INFRA** - Infrastructure, deployment, CI/CD
- **COMM** - Communications, email, notifications
- **BRAND** - Marketing, branding, fundraising
- **FIN** - Financial systems, payments
- **DOC** - Documentation
- **BUG** - Bug fixes
- **FEAT** - New features

## Workflow

### Creating a Ticket

1. Create ticket file: `tickets/{CATEGORY}-{NUM}-{slug}.md`
2. Use the template structure (see below)
3. Add to assignee's kanban board in "Todo" column
4. Update the board's ticket list
5. Update board stats and timestamp

### Moving Tickets

1. Update ticket status in the ticket file
2. Move ticket in the Mermaid kanban board
3. Update the assignee's board ticket list
4. Update "Last Updated" timestamp

### Archiving Completed Tickets

When a ticket is fully complete and merged:

1. Move ticket file to `tickets/archived/`
2. Remove from kanban board
3. Update board stats
4. Optionally add to a "Recently Completed" section for visibility

This keeps the main tickets folder focused on active work while preserving history.

### Status Values

- 🆕 **Not Started** - Ticket created, not yet started
- 🚧 **In Progress** - Actively being worked on
- 🔄 **Blocked** - Waiting on external dependency
- 👀 **Review** - Ready for code review
- ✅ **Done** - Completed and merged

## Ticket Template

```markdown
# {CATEGORY}-{NUM}: {Title}

**Status**: 🆕 Not Started
**Assignee**: {Name}
**Priority**: {High|Medium|Low}
**Created**: YYYY-MM-DD
**Updated**: YYYY-MM-DD

---

## Overview

Brief description of the ticket.

## Objectives

- ✅ Main goal 1
- ✅ Main goal 2

---

## Tasks

### Task Category 1

- [ ] Subtask 1
- [ ] Subtask 2

### Task Category 2

- [ ] Subtask 1
- [ ] Subtask 2

---

## Open Questions

List any decisions needed or blockers.

---

## Implementation Notes

Technical details, code snippets, architecture decisions.

---

## Definition of Done

- [ ] Criteria 1
- [ ] Criteria 2
- [ ] Documentation updated
- [ ] Tests passing

---

## Resources

- Links to docs
- Related PRs
- External references

---

## Related Tickets

- Links to other tickets

---

## Comments

_Updates and notes as work progresses._
```

## Kanban Board Template

```markdown
# {Name}'s Kanban Board

\`\`\`mermaid
---
config:
  kanban:
    ticketBaseUrl: 'https://github.com/yourorg/template/blob/main/tickets/#TICKET#'
---
kanban
  Todo
    {TICKET-ID}
  In Progress
  Review
  Done
\`\`\`

## Tickets

### 🆕 Todo
- [{TICKET-ID}: {Title}](./{TICKET-ID}.md) - Brief description

### 🚧 In Progress
_No tickets currently in progress_

### 👀 Review
_No tickets currently in review_

### ✅ Done
_No completed tickets yet_

---

## Quick Stats

- **Total Tickets**: 0
- **In Progress**: 0
- **Blocked**: 0
- **Completed This Week**: 0

---

_Last Updated: YYYY-MM-DD_
```

---

_Last Updated: 2026-02-06_
