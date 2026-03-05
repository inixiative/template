# FEAT-015: AI Dashboard Generator

**Status**: 🆕 Not Started
**Assignee**: Unassigned
**Priority**: Low
**Created**: 2026-03-04
**Updated**: 2026-03-04

---

## Overview

Allow users to generate dashboards from natural language prompts. The AI selects and arranges components (charts, tables, stat cards) from a predefined catalog, constrained by schema validation so output is always safe to render.

## Objectives

- ✅ Users describe what they want ("show me signups by week"), AI assembles a dashboard
- ✅ AI is constrained to registered components only (no arbitrary HTML/code)
- ✅ Streaming/progressive rendering as the model responds
- ✅ Saved dashboards persisted per user/org/space

---

## Open Questions

- Should this be org-level (shared dashboards) or user-level (personal), or both?
- What data sources does the AI have access to? Raw API endpoints? Pre-aggregated metrics?
- Do we build our own component catalog or use json-render's 36 shadcn/ui components as a base?
- Is this a superadmin tool, admin tool, or end-user feature?

---

## Implementation Notes

**Candidate library**: [`vercel-labs/json-render`](https://github.com/vercel-labs/json-render)
- Constrains LLM output to a registered component catalog (prevents arbitrary rendering)
- Progressive streaming support
- Zustand adapter (matches our store)
- shadcn/ui components included in catalog
- Caveat: Vercel Labs = experimental, watch stability

**Architecture sketch:**
- Register DataTables, charts, stat cards in json-render catalog
- User prompt → API route → LLM with component schema as system context → JSON → json-render renders
- Save dashboard layout as JSON in DB (replayable without re-running LLM)

---

## Resources

- [vercel-labs/json-render](https://github.com/vercel-labs/json-render)

---

## Related Tickets

- [FEAT-004: AI Providers](./FEAT-004-ai-providers.md) - LLM provider abstraction needed upstream

---

## Comments

_Added to backlog after evaluating json-render as a candidate library for generative UI._
