# Error Handling

<!-- toc:start -->

## Contents

- [Overview](#overview)
- [The rule](#the-rule)
- [makeError / AppError](#makeerror--apperror)
- [The global handler](#the-global-handler)
- [Status conventions](#status-conventions)
- [Shared packages can't use makeError](#shared-packages-cant-use-makeerror)

<!-- toc:end -->

---

## Overview

API error responses are structured and status-correct. The primitives:
`makeError` / `AppError` (`apps/api/src/lib/errors`), the global
`errorHandlerMiddleware` (`apps/api/src/middleware/error/`), and the
`HTTP_ERROR_MAP` (`@template/shared/errors`).

## The rule

- **On the live HTTP request path**, a *caller error* throws
  `makeError({ status, message, guidance? })` so the response carries the right
  status + structured body. A raw `throw new Error(...)` on the request path
  serializes as an opaque **500** — wrong for client errors.
- **Genuine 500s** (route misconfig, missing registry config, developer misuse,
  internal invariants) stay raw `Error` — `respond500` already wraps them in
  `makeError({status:500})` + `requestId`, so converting buys nothing.
- **Off the request path** — job workers (`apps/api/src/jobs/**`), app
  bootstrap, scripts — normal `Error` is fine.

The test: **500 = the server is broken/misconfigured (not the caller's fault);
4xx = the caller sent something wrong.**

## makeError / AppError

`makeError(options) → AppError`, where `AppError extends HTTPException`. Options:
`{ status?, message?, guidance?, fieldErrors? }` (status defaults to 500).
`requestId` is **not** an option — it's stamped onto the thrown `AppError` by the
handler. `AppError.getResponse()` emits:

```json
{ "error": "...", "message": "...", "guidance": "...", "fieldErrors": {...}, "requestId": "..." }
```

Defaults (`error` label, `message`, `guidance`) come from `HTTP_ERROR_MAP[status]`
unless overridden.

## The global handler

`app.onError(errorHandlerMiddleware)` resolves, in order:

| Thrown | Response |
|--------|----------|
| `ZodError` | 422 with formatted field issues (`respond422`) |
| `ResponseValidationError` | 500 (response failed its own schema) |
| `Prisma.PrismaClientValidationError` | 400 "Invalid query parameters" |
| `Prisma P2002` | 409 "Resource already exists: …" |
| `Prisma P2025` | 404 "Resource not found" |
| `HTTPException` / `AppError` | its `getResponse()`; `requestId` set on every `AppError`; ≥500 also reported to `errorReporter` |
| anything else (raw `Error`) | 500 via `respond500` (wrapped in `makeError` + `requestId`) |

So `requestId` is present on every `AppError` response (4xx and 5xx), and on the
generic 500 fallback.

## Status conventions

- Client filter/query input (invalid operator/field, uncoercible value) → **400**
  (see `apps/api/src/lib/prisma/buildWhereClause.ts`, `coerceValue.ts`, `jsonFilter.ts`).
- Submitted data failing a business rule → **422** (`apps/api/src/hooks/rules/hook.ts`).
- Auth 401 · forbidden 403 · not found 404 · conflict 409.
- A request-path invariant that's genuinely the server's fault → leave it a raw
  `Error` (becomes a wrapped 500). Don't convert it just for the envelope —
  `respond500` already provides it. See INFRA-019 for the json-rules target
  sharp edges that surface as throws.

## Shared packages can't use makeError

`makeError` imports `hono`, so it lives in `apps/api` only. `packages/*`
(`db`, `permissions`, `shared`) throw plain errors; the handler **translates at
the boundary** (the Prisma rows above are exactly this). Do not import `makeError`
into a package — it would couple the package to the API.
