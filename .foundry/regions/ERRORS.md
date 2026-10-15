# Template errors

**Every error the corpus names, by class, with where it lives and what throws it. Each error's class and each thrower's errors also appear on their part-3 lines, so the pointer works from both sides.**

<!-- Generated with the region Warden docs (v1) by ~/.foundry/evals/warden-regions/assemble.py from consensus/errors.json. Classes are the ones ERRORS.md, API_ROUTES.md § Error Responses, HTTP_ERROR_MAP and the json-rules error classes define. -->

## Classes

| Class | Meaning | HTTP | Source |
|---|---|---|---|
| `bad-request` | Malformed request or client filter/query input (invalid operator or field, uncoercible value); also security violations such as a nested batch. Guidance: fixInput | 400 | docs/claude/ERRORS.md § Status conventions; docs/claude/API_ROUTES.md § Error Responses (HTTP_ERROR_MAP table) |
| `authentication-failed` | No authenticated user where one is required (auth 401). Guidance: reauthenticate | 401 | docs/claude/ERRORS.md § Status conventions; docs/claude/API_ROUTES.md § Error Responses (HTTP_ERROR_MAP table) |
| `permission-denied` | Authenticated but not allowed (forbidden 403). Guidance: requestPermission | 403 | docs/claude/ERRORS.md § Status conventions; docs/claude/API_ROUTES.md § Error Responses (HTTP_ERROR_MAP table) |
| `resource-not-found` | The addressed record does not exist (or is not visible); not found 404. Guidance: fixInput | 404 | docs/claude/ERRORS.md § Status conventions; docs/claude/API_ROUTES.md § Error Responses (HTTP_ERROR_MAP table) |
| `method-not-allowed` | HTTP method not supported on the route. Guidance: contactSupport | 405 | docs/claude/API_ROUTES.md § Error Responses (HTTP_ERROR_MAP table) |
| `conflict` | The request collides with current state: duplicate, ambiguous lookup, lock contention, illegal transition (conflict 409). Guidance: fixInput | 409 | docs/claude/ERRORS.md § Status conventions; docs/claude/API_ROUTES.md § Error Responses (HTTP_ERROR_MAP table) |
| `resource-gone` | The record existed but is no longer actionable (e.g. expired). Guidance: fixInput | 410 | docs/claude/API_ROUTES.md § Error Responses (HTTP_ERROR_MAP table) |
| `payload-too-large` | Request body too large. Guidance: fixInput | 413 | docs/claude/API_ROUTES.md § Error Responses (HTTP_ERROR_MAP table) |
| `unsupported-media-type` | Request content type not accepted. Guidance: contactSupport | 415 | docs/claude/API_ROUTES.md § Error Responses (HTTP_ERROR_MAP table) |
| `validation-error` | Submitted data fails schema validation or a business rule (Zod issues, RulesRegistry). Guidance: fixInput | 422 | docs/claude/ERRORS.md § Status conventions; docs/claude/API_ROUTES.md § Error Responses (HTTP_ERROR_MAP table) |
| `rate-limited` | A rate-limit bucket is over its max; carries Retry-After. Guidance: tryAgain | 429 | docs/claude/API_ROUTES.md § Error Responses (HTTP_ERROR_MAP table) |
| `server-error` | The server is broken or misconfigured, not the caller's fault: route misconfig, missing config, developer misuse, internal invariants. Raw Error on the request path becomes this via respond500. Guidance: contactSupport | 500 | docs/claude/ERRORS.md § The rule (genuine 500s); docs/claude/API_ROUTES.md § Error Responses (HTTP_ERROR_MAP table) |
| `bad-gateway` | Upstream returned an invalid response. Guidance: tryAgain | 502 | docs/claude/API_ROUTES.md § Error Responses (HTTP_ERROR_MAP table) |
| `service-unavailable` | Service temporarily unavailable. Guidance: refreshAndRetry | 503 | docs/claude/API_ROUTES.md § Error Responses (HTTP_ERROR_MAP table) |
| `gateway-timeout` | Upstream timed out. Guidance: tryAgain | 504 | docs/claude/API_ROUTES.md § Error Responses (HTTP_ERROR_MAP table) |
| `caller-error` | On the live HTTP request path the caller sent something wrong: throw makeError({ status, message, guidance? }) so the response is a 4xx with the structured body. Umbrella for the error carriers (AppError, HTTPException); each status family has its own class. | — | docs/claude/ERRORS.md § The rule; docs/claude/ERRORS.md § makeError / AppError |
| `off-request-path` | Raised where no live HTTP request is being served (job workers, app bootstrap, scripts, tests, frontend): plain Error is fine and nothing maps it to a status. | — | docs/claude/ERRORS.md § The rule |
| `usage` | json-rules UsageError: the caller's input is missing or malformed (no now for a relative date, invalid now or time zone, an unbound bind). Fix: supply the input. | — | @inixiative/json-rules/README.md § Error Handling |
| `lens-refusal` | json-rules LensRefusal (with code): the lens itself cannot do it (a later clamp reads what its parent hides, a clamp or source a compile has no form for, a link a source path cannot carry). Fix the lens; validateNarrowing reports it ahead of time. | — | @inixiative/json-rules/README.md § Error Handling; @inixiative/json-rules/docs/LENS.md |
| `rule-shape` | Any other Error json-rules throws: the rule is structurally invalid (array operator on a non-array, missing count, invalid date, unsupported backend translation). validateRule reports it; catch code rethrows it. | — | @inixiative/json-rules/README.md § Error Handling |

Basis: `documented` = a doc states the class; `convention` = no status documented, classed by ERRORS.md § Status conventions; `example-only` = the name appears only in example code. 19 of 60 errors are classed by convention.

## `bad-request`

| Error | Where | Region | Thrown by | Basis | Source |
|---|---|---|---|---|---|
| **BadRequestError** | `(none: appears only in catalog Use lines)` | [filtering-search](filtering-search/knowledge.md) | — | example-only | catalog isValidOperatorForField / validatePathNotation Use lines |
| **HttpError** | `(none: appears only in an example)` | [lens-usage](lens-usage/knowledge.md) | — | example-only | json-rules lens docs example (gate.ok check) |
| **makeError 400 BAD_REQUEST** | `apps/api/src/lib/errors/makeError.ts (labels from packages/shared/src/errors/types.ts HTTP_ERROR_MAP)` | [request-context-errors](request-context-errors/knowledge.md) | buildWhereClause, coerceValueForField, buildJsonWhere, POST /api/v1/batch/execute *(inferred: validatePathNotation, isValidOperatorForField)* | documented | docs/claude/API_ROUTES.md § Error Responses (HTTP_ERROR_MAP table) |
| **Prisma.PrismaClientValidationError** | `@prisma/client` | [request-context-errors](request-context-errors/knowledge.md) | — *(inferred: db, query)* | documented | docs/claude/ERRORS.md § The global handler |

## `authentication-failed`

| Error | Where | Region | Thrown by | Basis | Source |
|---|---|---|---|---|---|
| **makeError 401 AUTHENTICATION_FAILED** | `apps/api/src/lib/errors/makeError.ts (labels from packages/shared/src/errors/types.ts HTTP_ERROR_MAP)` | [auth-middleware-users](auth-middleware-users/knowledge.md) | validateUser, validateActor, validateNotToken, basicAuthMiddleware | documented | docs/claude/API_ROUTES.md § Error Responses (HTTP_ERROR_MAP table) |

## `permission-denied`

| Error | Where | Region | Thrown by | Basis | Source |
|---|---|---|---|---|---|
| **makeError 403 PERMISSION_DENIED** | `apps/api/src/lib/errors/makeError.ts (labels from packages/shared/src/errors/types.ts HTTP_ERROR_MAP)` | [permissions-roles](permissions-roles/knowledge.md) | validatePermission, validateNotToken, validateSuperadmin, validateOwnerPermission, Granular create permission via hydrated partial | documented | docs/claude/API_ROUTES.md § Error Responses (HTTP_ERROR_MAP table) |

## `resource-not-found`

| Error | Where | Region | Thrown by | Basis | Source |
|---|---|---|---|---|---|
| **makeError 404 RESOURCE_NOT_FOUND** | `apps/api/src/lib/errors/makeError.ts (labels from packages/shared/src/errors/types.ts HTTP_ERROR_MAP)` | [request-context-errors](request-context-errors/knowledge.md) | resourceContextMiddleware, flowRead, Not-found via HTTPException | documented | docs/claude/API_ROUTES.md § Error Responses (HTTP_ERROR_MAP table) |
| **Prisma P2025 (record not found)** | `@prisma/client PrismaClientKnownRequestError code P2025` | [request-context-errors](request-context-errors/knowledge.md) | — *(inferred: db, query)* | documented | docs/claude/ERRORS.md § The global handler |

## `method-not-allowed`

| Error | Where | Region | Thrown by | Basis | Source |
|---|---|---|---|---|---|
| **makeError 405 METHOD_NOT_ALLOWED** | `apps/api/src/lib/errors/makeError.ts (labels from packages/shared/src/errors/types.ts HTTP_ERROR_MAP)` | [request-context-errors](request-context-errors/knowledge.md) | — | documented | docs/claude/API_ROUTES.md § Error Responses (HTTP_ERROR_MAP table) |

## `conflict`

| Error | Where | Region | Thrown by | Basis | Source |
|---|---|---|---|---|---|
| **DivergentDuplicateSlugError** | `packages/email/src/errors/DivergentDuplicateSlugError.ts` | [email-render](email-render/knowledge.md) | — | convention | email-templates part 3 (Also here) |
| **FindForUpdateLockTimeoutError** | `packages/db/src/lock/findForUpdateLockTimeoutError.ts` | [database-client](database-client/knowledge.md) | db.findForUpdate, acquireFindForUpdateLock | convention | docs/claude/DATABASE.md § Transactions › Row Locks and Create-If-Missing |
| **isUniqueConstraintError** | `packages/db/src/utils/isUniqueConstraintError.ts#isUniqueConstraintError` | [request-context-errors](request-context-errors/knowledge.md) | — *(inferred: db, query)* | documented | catalog isUniqueConstraintError; docs/claude/ERRORS.md § The global handler |
| **isWriteConflictError** | `packages/db/src/utils/isWriteConflictError.ts#isWriteConflictError` | [request-context-errors](request-context-errors/knowledge.md) | — *(inferred: db.txn)* | convention | catalog isWriteConflictError |
| **makeError 409 CONFLICT** | `apps/api/src/lib/errors/makeError.ts (labels from packages/shared/src/errors/types.ts HTTP_ERROR_MAP)` | [request-context-errors](request-context-errors/knowledge.md) | resourceContextMiddleware, Alternate resource lookup, withOwnerLock, validate, Handler validate hook *(inferred: validateInquiryPreCreate, validateUniqueInquiry)* | documented | docs/claude/API_ROUTES.md § Error Responses (HTTP_ERROR_MAP table) |
| **Prisma P2002 (unique constraint)** | `@prisma/client PrismaClientKnownRequestError code P2002` | [request-context-errors](request-context-errors/knowledge.md) | — *(inferred: db, query)* | documented | docs/claude/ERRORS.md § The global handler |
| **Prisma P2034 (write conflict / deadlock)** | `@prisma/client PrismaClientKnownRequestError code P2034` | [request-context-errors](request-context-errors/knowledge.md) | — *(inferred: db.txn)* | convention | packages/db/src/utils/isWriteConflictError.ts (catalog) |

## `resource-gone`

| Error | Where | Region | Thrown by | Basis | Source |
|---|---|---|---|---|---|
| **makeError 410 RESOURCE_GONE** | `apps/api/src/lib/errors/makeError.ts (labels from packages/shared/src/errors/types.ts HTTP_ERROR_MAP)` | [inquiry-handlers](inquiry-handlers/knowledge.md) | validateInquiryNotExpired | documented | docs/claude/API_ROUTES.md § Error Responses (HTTP_ERROR_MAP table) |

## `payload-too-large`

| Error | Where | Region | Thrown by | Basis | Source |
|---|---|---|---|---|---|
| **makeError 413 PAYLOAD_TOO_LARGE** | `apps/api/src/lib/errors/makeError.ts (labels from packages/shared/src/errors/types.ts HTTP_ERROR_MAP)` | [request-context-errors](request-context-errors/knowledge.md) | — | documented | docs/claude/API_ROUTES.md § Error Responses (HTTP_ERROR_MAP table) |

## `unsupported-media-type`

| Error | Where | Region | Thrown by | Basis | Source |
|---|---|---|---|---|---|
| **makeError 415 UNSUPPORTED_MEDIA_TYPE** | `apps/api/src/lib/errors/makeError.ts (labels from packages/shared/src/errors/types.ts HTTP_ERROR_MAP)` | [request-context-errors](request-context-errors/knowledge.md) | — | documented | docs/claude/API_ROUTES.md § Error Responses (HTTP_ERROR_MAP table) |

## `validation-error`

| Error | Where | Region | Thrown by | Basis | Source |
|---|---|---|---|---|---|
| **ConditionValidationError** | `packages/email/src/errors/ConditionValidationError.ts` | [email-render](email-render/knowledge.md) | — *(inferred: assertValidConditions)* | documented | docs/claude/COMMUNICATIONS.md § Email › Rule References (the lens gate answers 422) |
| **DependentTemplateError** | `packages/email/src/errors/DependentTemplateError.ts` | [email-render](email-render/knowledge.md) | — *(inferred: validateDependents)* | convention | email-templates part 3 (Also here) |
| **makeError 422 VALIDATION_ERROR** | `apps/api/src/lib/errors/makeError.ts (labels from packages/shared/src/errors/types.ts HTTP_ERROR_MAP)` | [request-context-errors](request-context-errors/knowledge.md) | validateInquiryHandler, RulesRegistry, assertValidConditions, meCreateFlow *(inferred: validateSegmentConditions, assertSegmentReferencesOwned, findReferenceCycle, validateNotLastOwner, validateNoCycle)* | documented | docs/claude/API_ROUTES.md § Error Responses (HTTP_ERROR_MAP table) |
| **MjmlValidationError** | `packages/email/src/errors/MjmlValidationError.ts` | [email-templates](email-templates/knowledge.md) | validateMjml | convention | docs/claude/COMMUNICATIONS.md § Email › MJML Validation |
| **ParseBlocksError** | `packages/email/src/errors/ParseBlocksError.ts` | [email-render](email-render/knowledge.md) | — *(inferred: parseBlocks)* | convention | email-templates part 3 (Also here) |
| **RuleReferenceError** | `packages/db/src/utils/ruleReferenceError.ts#RuleReferenceError` | [json-rules](json-rules/knowledge.md) | syncRuleReferenceEdges, syncRuleReferences *(inferred: saveEmailTemplate)* | convention | docs/claude/COMMUNICATIONS.md § Email › Rule References |
| **TokenValidationError** | `packages/email/src/errors/TokenValidationError.ts` | [email-render](email-render/knowledge.md) | — *(inferred: assertValidTokens)* | convention | email-templates part 3 (Also here) |
| **ZodError** | `zod (apps/api/src/middleware/error/isZodError.ts detects it)` | [request-context-errors](request-context-errors/knowledge.md) | webhookUrlSchema, meCreateFlow *(inferred: createRoute, readRoute, updateRoute, deleteRoute, actionRoute, Generated Zod schemas)* | documented | docs/claude/ERRORS.md § The global handler |

## `rate-limited`

| Error | Where | Region | Thrown by | Basis | Source |
|---|---|---|---|---|---|
| **makeError 429 RATE_LIMITED** | `apps/api/src/lib/errors/makeError.ts (labels from packages/shared/src/errors/types.ts HTTP_ERROR_MAP)` | [redis-caching-rate-limits](redis-caching-rate-limits/knowledge.md) | rateLimit, apiRateLimit, authRateLimit | documented | docs/claude/API_ROUTES.md § Error Responses (HTTP_ERROR_MAP table) |

## `server-error`

| Error | Where | Region | Thrown by | Basis | Source |
|---|---|---|---|---|---|
| **Bulk write refusal (createMany / updateMany)** | `packages/db (hooked client)` | [mutation-hooks](mutation-hooks/knowledge.md) | createManyAndReturn, updateManyAndReturn *(inferred: db)* | convention | docs/claude/HOOKS.md § Supported Operations |
| **cache key Error** | `packages/db/src/redis/cache.ts (validateKey)` | [redis-caching-rate-limits](redis-caching-rate-limits/knowledge.md) | validateKey, cache | convention | catalog validateKey |
| **db.onCommit outside transaction Error** | `@template/db` | [database-client](database-client/knowledge.md) | db.onCommit | convention | docs/claude/DATABASE.md § Transactions › After Commit Callbacks |
| **db.parallel aggregated failure** | `apps/api/src/appEvents (makeAppEvent / db.parallel)` | [app-events-webhooks](app-events-webhooks/knowledge.md) | db.parallel | convention | docs/claude/APP_EVENTS.md § Purpose and execution |
| **engineGlobals.with async-callback Error** | `@inixiative/json-rules engineGlobals.with` | [json-rules-runtime](json-rules-runtime/knowledge.md) | engineGlobals.with | convention | @inixiative/json-rules/README.md § Engine Globals |
| **fetchAllPages cap Error** | `packages/shared/src/utils/fetchAllPages.ts#fetchAllPages` | [pagination](pagination/knowledge.md) | fetchAllPages | convention | catalog fetchAllPages |
| **makeError 500 SERVER_ERROR** | `apps/api/src/lib/errors/makeError.ts (labels from packages/shared/src/errors/types.ts HTTP_ERROR_MAP)` | [request-context-errors](request-context-errors/knowledge.md) | errorHandlerMiddleware, POST /api/v1/batch/execute | documented | docs/claude/API_ROUTES.md § Error Responses (HTTP_ERROR_MAP table) |
| **orderedList buildScope Error** | `apps/api/src/hooks/orderedList/` | [mutation-hooks](mutation-hooks/knowledge.md) | buildScope | convention | catalog buildScope |
| **ResponseValidationError** | `apps/api/src/lib/utils/makeController.ts` | [request-context-errors](request-context-errors/knowledge.md) | makeController | documented | docs/claude/ERRORS.md § The global handler |
| **RuleDegradedError** | `packages/shared/src/rules/errors.ts#RuleDegradedError` | [json-rules](json-rules/knowledge.md) | — *(inferred: withRule)* | convention | catalog RuleDegradedError |
| **RuleEvaluationError** | `packages/shared/src/rules/errors.ts#RuleEvaluationError` | [json-rules](json-rules/knowledge.md) | — *(inferred: withRule)* | convention | catalog RuleEvaluationError |
| **searchPaths stray-entry Error** | `apps/api/src/lib/prisma/paginate.ts` | [pagination](pagination/knowledge.md) | paginate | documented | docs/claude/API_ROUTES.md § Response Format › Search & Filtering |
| **validateJobId Error** | `apps/api/src/jobs/validateJobId.ts#validateJobId` | [jobs-cron](jobs-cron/knowledge.md) | validateJobId | convention | docs/claude/JOBS.md § Enqueuing Jobs; catalog validateJobId |
| **validateRole Error** | `apps/api/src/lib/permissions/validateRole.ts#validateRole` | [permissions-roles](permissions-roles/knowledge.md) | validateRole | documented | docs/claude/PERMISSIONS.md § Permission Setup › Role Validation |

## `bad-gateway`

| Error | Where | Region | Thrown by | Basis | Source |
|---|---|---|---|---|---|
| **makeError 502 BAD_GATEWAY** | `apps/api/src/lib/errors/makeError.ts (labels from packages/shared/src/errors/types.ts HTTP_ERROR_MAP)` | [request-context-errors](request-context-errors/knowledge.md) | — | documented | docs/claude/API_ROUTES.md § Error Responses (HTTP_ERROR_MAP table) |

## `service-unavailable`

| Error | Where | Region | Thrown by | Basis | Source |
|---|---|---|---|---|---|
| **makeError 503 SERVICE_UNAVAILABLE** | `apps/api/src/lib/errors/makeError.ts (labels from packages/shared/src/errors/types.ts HTTP_ERROR_MAP)` | [request-context-errors](request-context-errors/knowledge.md) | — | documented | docs/claude/API_ROUTES.md § Error Responses (HTTP_ERROR_MAP table) |

## `gateway-timeout`

| Error | Where | Region | Thrown by | Basis | Source |
|---|---|---|---|---|---|
| **makeError 504 GATEWAY_TIMEOUT** | `apps/api/src/lib/errors/makeError.ts (labels from packages/shared/src/errors/types.ts HTTP_ERROR_MAP)` | [request-context-errors](request-context-errors/knowledge.md) | — | documented | docs/claude/API_ROUTES.md § Error Responses (HTTP_ERROR_MAP table) |

## `caller-error`

| Error | Where | Region | Thrown by | Basis | Source |
|---|---|---|---|---|---|
| **AppError** | `apps/api/src/lib/errors/makeError.ts#AppError` | [request-context-errors](request-context-errors/knowledge.md) | makeError | documented | docs/claude/ERRORS.md § makeError / AppError |
| **HTTPException** | `hono/http-exception` | [request-context-errors](request-context-errors/knowledge.md) | Not-found via HTTPException, validateNotToken, validateOwnerPermission *(inferred: validatePermission)* | documented | docs/claude/API_ROUTES.md § Error Responses; docs/claude/PERMISSIONS.md § Validation Middleware |

## `off-request-path`

| Error | Where | Region | Thrown by | Basis | Source |
|---|---|---|---|---|---|
| **classifyResendError** | `packages/email (named in email-delivery part 3 "Also here"; catalog EmailProviderError Use line)` | [email-delivery](email-delivery/knowledge.md) | — | documented | catalog EmailProviderError |
| **EmailProviderError** | `packages/email/src/errors/EmailProviderError.ts#EmailProviderError` | [email-delivery](email-delivery/knowledge.md) | deliverEmailMessage | documented | docs/claude/COMMUNICATIONS.md § Email › Send Pipeline › Deliver (deliverEmail), step 8 |
| **EmailRenderError** | `packages/email/src/errors/EmailRenderError.ts#EmailRenderError` | [email-render](email-render/knowledge.md) | settleTemplate | documented | docs/claude/COMMUNICATIONS.md § Email › Send Pipeline › Deliver (deliverEmail) › Render issues |
| **flushRedis outside test Error** | `packages/db/src/redis/client.ts#flushRedis` | [test-harness](test-harness/knowledge.md) | flushRedis | documented | catalog flushRedis |
| **isEmailContentError** | `packages/email/src/errors/isEmailContentError.ts#isEmailContentError` | [email-delivery](email-delivery/knowledge.md) | — | documented | docs/claude/COMMUNICATIONS.md § Email › Send Pipeline › Deliver (deliverEmail), step 2 |
| **makeContextQueries missing-context Error** | `packages/ui/src/lib/makeContextQueries.ts#makeContextQueries` | [api-client](api-client/knowledge.md) | makeContextQueries | documented | docs/claude/FRONTEND/API_CLIENT.md § Context Queries |
| **retryWithTimeout timeout Error** | `init/utils/retry.ts` | [init-architecture](init-architecture/knowledge.md) | retryWithTimeout | documented | docs/claude/INIT_SCRIPT_PATTERNS.md § 9. Retry Logic for Async Initialization |
| **SupersededError** | `apps/api/src/jobs/types.ts#SupersededError` | [concurrency-locks](concurrency-locks/knowledge.md) | — | documented | catalog SupersededError; docs/claude/JOBS.md § Handler Patterns › Superseding Job |
| **Unknown job handler Error** | `apps/api/src/jobs (worker)` | [jobs-cron](jobs-cron/knowledge.md) | — | documented | docs/claude/JOBS.md § Error Boundaries |
| **VCR replayed provider error** | `packages/shared/src/vcr/vcr.ts` | [test-harness](test-harness/knowledge.md) | VCR, vcr.capture | documented | docs/claude/TESTING.md § VCR (external services) |

## `usage`

| Error | Where | Region | Thrown by | Basis | Source |
|---|---|---|---|---|---|
| **UsageError** | `@inixiative/json-rules#UsageError` | [json-rules-runtime](json-rules-runtime/knowledge.md) | check, toPrisma, toSql, materializeSourceQuery, materializeSources | documented | @inixiative/json-rules/README.md § Error Handling |

## `lens-refusal`

| Error | Where | Region | Thrown by | Basis | Source |
|---|---|---|---|---|---|
| **LensRefusal** | `@inixiative/json-rules#LensRefusal` | [lens-model](lens-model/knowledge.md) | toPrisma, toSql, toSourceQueries, toLensSelect, projectLens, lensVisit, narrowRule, materializeSources | documented | @inixiative/json-rules/README.md § Error Handling; @inixiative/json-rules/docs/LENS.md (One posture code path) |

## `rule-shape`

| Error | Where | Region | Thrown by | Basis | Source |
|---|---|---|---|---|---|
| **json-rules rule-shape Error** | `@inixiative/json-rules (plain Error)` | [json-rules-runtime](json-rules-runtime/knowledge.md) | check, toPrisma, toSql, assertValidRule *(inferred: assertValidFieldMaps, assertValidNarrowing)* | documented | @inixiative/json-rules/README.md § Error Handling |
