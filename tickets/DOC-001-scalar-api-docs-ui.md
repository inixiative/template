# DOC-001: Scalar API Documentation UI

**Status**: 🆕 Not Started
**Assignee**: TBD
**Priority**: Medium
**Created**: 2026-03-31
**Updated**: 2026-03-31

---

## Overview

Add Scalar as the interactive API documentation UI. The OpenAPI spec is already generated and served at `/openapi/docs` via `@hono/zod-openapi` + `app.doc31()`, but there's no human-friendly viewer. Scalar provides a polished, interactive docs experience with zero config on Hono.

## Objectives

- ✅ Install `@scalar/hono-api-reference` and mount it on a docs route
- ✅ Serve interactive API documentation from the running API server

---

## Tasks

### Backend (apps/api)

- [ ] `bun add @scalar/hono-api-reference` in `apps/api`
- [ ] Add Scalar middleware in `apps/api/src/app.ts` pointing at the existing `/openapi/docs` spec
- [ ] Choose route path (recommendation: `/docs` or `/reference`)
- [ ] Verify Scalar UI loads and all endpoints are browsable

### Configuration

- [ ] Decide on Scalar theme/branding (default is fine for now)
- [ ] Ensure authentication info is displayed (if applicable)

---

## Implementation Notes

Minimal change — roughly 3 lines in `app.ts`:

```ts
import { apiReference } from '@scalar/hono-api-reference';

app.get('/reference', apiReference({
  spec: { url: '/openapi/docs' },
}));
```

The `app.ts` CLAUDE.md already references `/docs` as the Scalar route, so `/docs` or `/reference` both work.

### Key files

- `apps/api/src/app.ts` — mount Scalar middleware
- `apps/api/package.json` — add dependency

---

## Definition of Done

- [ ] Scalar UI accessible at chosen route
- [ ] All existing OpenAPI endpoints visible and testable
- [ ] No regressions to existing `/openapi/docs` JSON endpoint
- [ ] `bun run check` passes

---

## Related Tickets

- DOC-002: AI-Discoverable API Metadata (page metadata for agent discovery)
- FEAT-014: AI Developer Experience

---

_Stub ticket — expand when prioritized._
