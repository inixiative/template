# INFRA-032: Webhook poisoned records — one rejected record no longer kills its subscription

**Status**: 👀 Review
**Assignee**: Aron
**Priority**: High
**Created**: 2026-09-25
**Updated**: 2026-09-25

> Port of Zealot ZLT-5013 (#2452) and the ZLT-5044 follow-up (#2461). Zealot's model is
> `IntegrationSourceRecord`; here it is `IntegrationRecord`, keyed on `Integration`.

---

## Problem

`sendWebhook` disables a subscription (`isActive: false`) once its last five events, across all
resources, are non-success. When the receiver keeps rejecting ONE record terminally (HTTP 4xx →
`error`) and that record is written often, its failures fill the window and switch off a
subscription that is delivering every other record. Zealot hit this when Salesforce rejected one
foreign-org record.

## The mechanism

- **`IntegrationRecord`** (`packages/db/prisma/schema/integrationRecord.prisma`): one row per
  (Integration, model, record). False polymorphism over `WebhookModel`: `model` plus one nullable FK
  per value (`customerRefId` today), registered in `PolymorphismRegistry.IntegrationRecord`.
  `poisonedAt` / `poisonedReason`. Partial unique `[integrationId, customerRefId]`, cascades from
  Integration and CustomerRef.
- **Column projection** — `integrationRecordColumn(model: WebhookModel)` reads the registry axis.
  `PolymorphismRegistry` is now declared with `satisfies` instead of a type annotation, so its
  literal keys survive: a `WebhookModel` value with no FK in the axis is a compile error there.
  Indexing by a runtime `ModelName` goes through `getPolymorphismConfig` (used by the factory and
  `resolveFalsePolymorphismRef`).
- **Only integration-owned subscriptions take part** (`subscription.integrationId != null`).
  Subscriptions without an integration keep the current circuit unchanged.
- **Skip** — before signing, a record with `poisonedAt` set for the subscription's integration
  returns early: no `WebhookEvent`, no request, nothing fed to the circuit.
- **Classification rule** — only an `error` with `httpStatus` 400 or 422 counts as a record-level
  rejection (`RECORD_REJECTION` in `sendWebhook.ts`, used by both the streak query and the
  current-event check). A blocked redirect, 401, 403, 409, 429 or any other terminal 4xx neither
  counts nor resets. `unreachable` (5xx, 404, network) is transport and neither counts nor resets.
  `WebhookEvent.httpStatus Int?` stores the response status, so the rule needs no parsing of the
  `error` string. Whether this is the right set is still open; the change is to that one constant.
- **Detect** (`isRecordRejected`), run after a rejection is recorded and before the circuit check:
  1. `lastSuccess` = the record's latest `success` on this subscription.
  2. rejections = the record's rejection events after `lastSuccess`.
  3. fewer than `RECORD_FAILURE_THRESHOLD` (3) → no.
  4. yes only if another resource delivered successfully after the FIRST rejection of the streak.
  The first rejection is the anchor, not the latest burst. One user action sends about three
  events within seconds, and on a quiet tenant nothing else delivers inside that burst. A success
  from before the streak does not count: if nothing has delivered since, the subscription itself
  is failing. That is the circuit's job, and poisoning every record during an outage would be
  wrong and cannot be undone.
- **Ordering by id** — `WebhookEvent.id` is uuidv7, so the boundaries are `id > lastSuccess.id` /
  `id > firstRejection.id`, which order events within the same millisecond exactly. Zealot has v4
  ids and `DateTime(3)`, so it compares `createdAt` with `gt` and can put an error and a success
  from the same millisecond in the wrong order.
- **Poison write** — `poisonIntegrationRecord` runs `db.findForUpdate('IntegrationRecord',
  { integrationId, customerRefId }, { upserting: true })` inside `db.txn` (DB-002), then updates or
  creates. A record that is already poisoned keeps its first stamp and reason. No `.upsert(` and no
  parent-row lock (that was Zealot's workaround before DB-002).

## Files

- `packages/db/prisma/schema/integrationRecord.prisma` (new), `webhookEvent.prisma` (`httpStatus`),
  `integration.prisma` / `customerRef.prisma` (back-relations)
- `packages/db/src/registries/falsePolymorphism.ts`, `packages/db/src/test/factory.ts`
- `packages/db/src/test/factories/integrationRecordFactory.ts` (new)
- `apps/api/src/modules/integration/services/{integrationRecordColumn,isIntegrationRecordPoisoned,poisonIntegrationRecord}.ts` (new)
- `apps/api/src/jobs/handlers/sendWebhook.ts`

## Tests

`apps/api/src/jobs/handlers/tests/sendWebhook.test.ts` → `poisoned records`: poisons on the second
touch; no poison when the other delivery came before the streak or nothing else delivered;
`unreachable` neither counts nor resets; the record's own success resets; same-millisecond ordering
by id in both directions; a 429 never counts, and a 429 touch never poisons; a poisoned record is
skipped (no event, no fetch) while other records deliver; no integration → never poisons; five
rejections in a row leave the subscription active. Each test was checked by reverting the code it
covers and confirming it fails. `poisonIntegrationRecord.test.ts`: a second poison keeps the first
stamp; an existing unpoisoned row is stamped.

## Follow-ups

- **Un-poisoning** — nothing clears `poisonedAt` (Zealot ZLT-5014). A fixed record stays skipped
  until the row is cleared by hand.
- **No read-side surface** — the template does not expose `IntegrationRecord` in any route or UI.
  Zealot shows it on the reference board.
- **Classification** — confirm or widen the 400/422 set.

## Related

- Zealot ZLT-5013 (#2452), ZLT-5044 (#2461), ZLT-5014
- DB-002 (findForUpdate upserting mode)
