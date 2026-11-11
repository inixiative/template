# API-005: A route declares its permission; the route template runs the check

**Status**: 🆕 Not Started (deferred by Aron, 2026-11-10: after the Entitlement table, #267, and its Kingdom and Tribe backport)
**Assignee**: Unassigned
**Priority**: Medium
**Created**: 2026-11-10
**Updated**: 2026-11-10

---

## Overview

Today each template route lists its own check: `middleware: [validatePermission('manage')]`, and a submodel route adds `submodel: Modules.x` beside it. A route that forgets the middleware has no check, and nothing can read from the route definition what it requires.

Zealot moved to declaring the permission as route config in [Zealot-Monorepo #2859](https://github.com/userevidence/Zealot-Monorepo/pull/2859) (ZLT-4135, merged 2026-11-10): a route sets `permission: 'read'` (an action on the loaded record) or `submodelPermission: 'manage'` (an action on a pseudo row placed under the loaded owner), and the route templates run the check through the permission engine (`apps/api/src/lib/auth/permissionAccess.ts`, `apps/api/src/lib/requestTemplates/*`). Person-only actions are `<verb>AsUser` actions with `actorIsUser` in the rebac schema, not route flags, so `userOnly` / `agentHidden` are gone. The engine and placement are the template's own (`validateSubmodelPermission`, `placeSubmodel`, `submodelOwnerWhere` came from here); only the way a route declares its permission differs.

Why: the check can't be forgotten, a CI rule can require every route to declare one, and a surface can answer from the route list what a caller can reach (Zealot's MCP tool list uses `actionReachable` for this). It touches every route, so it waits until #267 and its backport have landed, to avoid colliding with both.

## Objectives

- Every route declares `permission` or `submodelPermission` (or an explicit public/none) in its route template call; the template adds the check. No hand-listed `validatePermission` middleware.
- A CI rule fails a route that declares neither.
- Person-only checks live in the rebac schema (`actorIsUser`), as in Zealot.

---

## Tasks

- [ ] Read Zealot #2859's route-template and `permissionAccess` changes; list what ports as is and what differs in template (route templates, `validatePermission`, `validateSubmodelPermission`, resource loading).
- [ ] Add `permission` / `submodelPermission` to the template route config types and have `createRoute`, `readRoute`, `updateRoute`, `deleteRoute` and `actionRoute` run the check.
- [ ] Move every route off `middleware: [validatePermission(...)]`.
- [ ] CI rule: a route declares its permission.
- [ ] Revisit [API-004](./API-004-route-exposure-tags.md): Zealot's `x-user-only` / `x-agent-hidden` exposure tags are gone after #2859, so its tags-vs-registries question changes.
- [ ] Docs: `docs/claude/API_ROUTES.md`, `docs/claude/PERMISSIONS.md`; then backport to Kingdom and Tribe.
