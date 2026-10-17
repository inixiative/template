# API-004: Route exposure tags — which surfaces may reach a route

**Status**: 🆕 Not Started
**Assignee**: Aron
**Priority**: Medium
**Created**: 2026-09-27
**Updated**: 2026-09-27

---

## Overview

Routes are reached through more than HTTP. WebSocket channels and data streams resolve an
operationId to its route in-process (`resolveOperation`, `apps/api/src/lib/openapi/`, from PR #124),
and an agent/MCP surface will do the same when it ports from Zealot (issue #75, Wave 3). Today
each surface keeps its own allowlist keyed by operationId: `WS_CHANNELS`, `STREAM_DEFINITIONS`.

Zealot declares exposure on the route itself as OpenAPI extensions (`x-auth-tier`,
`x-agent-hidden`, `x-user-only`, `x-write-scope`, read by `modules/mcp/services/agentSurface.ts`),
so the route definition is the one place that says who may reach it and how.

Decide once, for every surface, whether exposure lives on the route (tags) or in per-surface
registries, rather than growing one mechanism for WebSockets and another for MCP.

## Objectives

- One source of truth for which routes each non-HTTP surface may reach.
- Routes declare whether their result is per-caller, replacing the `isPerCallerScope` symbol tag on
  `scopeNarrowing` that `streamAudience.test.ts` reads today.

---

## Tasks

- [ ] Inventory what each surface needs to know about a route: exposure, per-caller data, write
      scope, auth tier.
- [ ] Choose tags vs registries per fact (stream schemas and actions likely stay in definitions).
- [ ] If tags: route templates emit the `x-` extensions; `resolveOperation` exposes them.
- [ ] Move the stream audience check onto the declared per-caller fact.
- [ ] Apply to the MCP port when it lands.

---

## Open Questions

- Tag vocabulary: reuse Zealot's names, or template-native (no `AuthTier` here; `buildTags({ admin, internal })`)?
- Does INFRA-023 (serializable `where` with context bindings) make per-caller derivable from the
  route's narrowing instead of declared?

---

## Definition of Done

- [ ] Every non-HTTP surface reads exposure from one place
- [ ] Documentation updated (`API_ROUTES.md`, `WEBSOCKETS.md`)
- [ ] Tests passing
