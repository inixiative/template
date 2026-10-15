# Error Handling

<!-- toc:start -->

## Contents

- [Overview](#overview)
- [The rule](#the-rule)
- [makeError / AppError](#makeerror--apperror)
- [The global handler](#the-global-handler)
- [Request validation](#request-validation)
- [Status conventions](#status-conventions)
- [Shared packages can't use makeError](#shared-packages-cant-use-makeerror)
- [Never swallow an error](#never-swallow-an-error)

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
  serializes as an opaque **500** — wrong for client errors. Never throw
  `new HTTPException` in `apps/api/src`: the `no-raw-http-exception` CI rule
  rejects it (the handler still wraps one that a library throws).
- **Genuine 500s** (route misconfig, missing registry config, developer misuse,
  internal invariants) stay raw `Error` — `respond500` already wraps them in
  `makeError({status:500})` + `requestId`, so converting buys nothing.
- **Off the request path** — job workers (`apps/api/src/jobs/**`), app
  bootstrap, scripts — normal `Error` is fine.

The test: **500 = the server is broken/misconfigured (not the caller's fault);
4xx = the caller sent something wrong.**

## makeError / AppError

`makeError(options) → AppError`, where `AppError extends HTTPException`. Options:
`{ status?, message?, guidance?, fieldErrors?, headers? }` (status defaults to 500;
`headers` rides on the response — the 429 limiter sets `Retry-After` this way).
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
| `ZodError` (request validation included) | 422 with `fieldErrors` (`respond422`) |
| `ResponseValidationError` | 500 (response failed its own schema) |
| `Prisma.PrismaClientValidationError` | 400 "Invalid query parameters" |
| `Prisma P2002` | 409 "Resource already exists: …" |
| `Prisma P2025` | 404 "Resource not found" |
| `AppError` | its body |
| plain `HTTPException` | `toAppError`: same status and message (status name when empty), label and guidance from `HTTP_ERROR_MAP` (by class, 400/500, for an unmapped status), its response headers kept, body always JSON |
| anything else (raw `Error`) | 500 via `respond500` |

`HTTPException`s at ≥500 and raw errors are reported to `errorReporter`; 4xx are not.

Every branch, and the not-found handler, answers through `respondAppError`, which
stamps `requestId` and builds the response through the Hono context so headers
set with `c.header()` (`Cache-Control: no-store`, `request-id`) are kept. A
request that failed before `prepareRequest` ran (a root-level 404) gets a fresh id.

Responses that do not go through the handler, and so are not the envelope:
better-auth's own `/api/auth/*` answers, the browser-telemetry beacon
(`routes/browserTelemetry.ts`, bodyless statuses by design), and a failed
WebSocket upgrade (426, answered in `index.ts` before the app). Anything else
that answers an error returns a response itself instead of throwing is a bug:
throw `makeError`.

## Request validation

`@hono/zod-openapi` answers a failed body/query/path/header validation with its
own `400 {"success":false,"error":{"name":"ZodError",...}}` unless a hook says
otherwise. The root app (`apps/api/src/app.ts`) and the test root
(`apps/api/tests/createTestApp.ts`) set `defaultHook: validationDefaultHook`
(`apps/api/src/lib/openapi/`), which rethrows the `ZodError`, so validation
failures are the same **422** envelope as everything else. Routers inherit the
root's hook through `route()` (resolved at request time by walking the parent
chain, `@hono/zod-openapi` ≥ 1.6), so no router sets its own. A router that is
never mounted under a hooked root (a bare `new OpenAPIHono()` in a unit test)
keeps the library's 400.

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

## Never swallow an error

An error either reaches something that reports it or fails the operation visibly. Nothing catches
an error and carries on as if it succeeded. — fb: 2026-02-13, 2026-02-14, 2026-02-15, 2026-03-02

| Where | The error goes to | So you don't write |
|---|---|---|
| API request path | `errorHandlerMiddleware` (throw `makeError` for caller errors) | a `try/catch` that logs and returns 200 or a default |
| Frontend query/mutation | the query client's `onError` → `handleApiError` toast ([API_CLIENT.md](FRONTEND/API_CLIENT.md#error-toasts)) | a component `try/catch` that toasts by hand |
| Job | BullMQ's failure + retry path ([JOBS.md](JOBS.md)) | a catch that marks the job done |
| Init / setup step | the step fails: `setError(section, message)`, no `markComplete`, the view returns to status and shows it ([INIT_SCRIPT_PATTERNS.md](INIT_SCRIPT_PATTERNS.md#13-atomic-progress-flags--idempotent-api-calls)) | a catch that sets the progress flag anyway |

A `catch` is right only when it does something specific with that error: translates it to the
right status at a boundary (as the global handler does for Prisma errors), retries it, or adds
context and rethrows.

Signs you're bypassing it: `catch {}` or `catch (e) { console.error(e) }`; a fallback value
returned from a catch; a step shown as ✓ right after a ✗ error line; "covering" an error so a
flow can continue.
