# FE-001: Web App TanStack Start Migration (SEO)

**Status**: 🆕 Not Started
**Assignee**: TBD
**Priority**: High
**Created**: 2026-02-07
**Updated**: 2026-02-07

---

## Overview

Migrate `apps/web` to TanStack Start as the template-default for SEO and public web rendering. Keep `apps/admin` and `apps/superadmin` on SPA.

## Goals

- TanStack Start is the chosen direction for `apps/web`
- Remove mixed SSR/client leftovers and keep one coherent runtime model
- Keep auth, routing, and build/dev DX stable
- Preserve app contract with shared packages

## Tasks

- [ ] Document migration boundaries (`apps/web` only, no admin/superadmin changes)
- [ ] Establish clean TanStack Start entrypoints and remove hybrid leftovers
- [ ] Validate route generation and route typing
- [ ] Validate auth/session flow and redirect behavior in Start mode
- [ ] Validate context-switch flows and nav behavior
- [ ] Update web scripts and root docs (`typecheck:fe`, `test:fe`, frontend docs)

## Exit Criteria

- [ ] `web` typecheck passes
- [ ] `web` build passes
- [ ] `web` local dev works without manual workarounds
- [ ] No duplicate routing/runtime entrypoints (`app/main.tsx` vs Start leftovers)
- [ ] Public routes render crawlable HTML
- [ ] FE contract tests pass (route/nav integrity + auth smoke)

## Related Tickets

- INFRA-003 (CI/CD baseline checks)
- INFRA-005 (platform baseline)
- DX-001 (frontend test harness standardization, proposed)
