# Segments

<!-- toc:start -->

## Contents

- [Purpose and ownership](#purpose-and-ownership)
- [Static and dynamic membership](#static-and-dynamic-membership)
- [Rule health and references](#rule-health-and-references)
- [API](#api)
- [Web navigation](#web-navigation)
- [Events and email integration](#events-and-email-integration)
- [Remaining work](#remaining-work)
- [Source map](#source-map)

<!-- toc:end -->

## Purpose and ownership

A segment is a named set of a provider's `CustomerRef` rows. Its owner is the platform, a User,
an Organization or a Space (`ProviderModel`), and every member must be a customer reference
belonging to that provider. Segment rules do not describe an unrestricted set of users.

The platform is the one owner without a key column: its rows carry `ownerModel = platform` and
no FK, and a platform customer is a `CustomerRef` with `providerModel = platform`. The lens binds
that owner by its discriminator (`polymorphicIs` grows one `in`-bound arm per no-key value), and
`providerWhere` / `providerOf` in `segmentOwner.ts` give the same rows their Prisma shape. Only a
superadmin reaches a platform segment: the rebac owner walk finds no relation on it, so the
superadmin bypass is the sole admission.

`CustomerRef` is the rule root. `customerRefLens` declares the fields and relations that
rules may read, including contacts, tags, received communications and other segment
memberships. `resolvedCustomerRefLens(ownerModel, ownerId)` binds the provider scope.
Shared lens conditions also restrict related tags and communications to the permitted owner.

A segment carrying `featureFlagInternal` is a feature flag variant's internal audience, reached only
through the variant's `segmentId`: created and edited only through that variant, tombstoned with it,
excluded from the `Segment.name` uniques, and hidden from lists, pickers, the lens `Segment.id` source
and the membership routes. See [FEATURE_FLAGS.md](FEATURE_FLAGS.md).

`Segment.sample` keeps only the customers whose id bucket falls in `[from, to)`: three hex digits of the
id's random tail, read from digit position `offset` counted from the end (0–12), as a point on 0–100.
The API takes `{ from, to }`; the segmentConditions hook assigns `offset` at random when a sample is
first set and preserves it on later edits (a variant's internal segment copies its flag's
`sampleOffset`), so widening a range keeps everyone already in.
It is a post-filter applied after rule evaluation on both rails (`apps/api/src/modules/segment/lib/sample.ts`),
so rules, the builder and reach counts know nothing about it. Changing it triggers a reconcile.

## Static and dynamic membership

Every segment has `conditions`. A static segment is computed after creation or a rule
change; a dynamic segment also reacts to customer changes. A hand-picked audience is a
static rule over customer-reference IDs. There is no direct member add/remove API.

- `reconcileSegment` evaluates the whole set through `toPrisma` and applies a membership diff.
- `reconcileCustomerRefSegments` accepts `{ customerModel, customerId }`, finds that customer's
  references, hydrates each through `fetchLens`, and evaluates dynamic segments with `check()`
  in dependency order. Its superseding key is the customer model and ID.
- `sweepSegments`, seeded for 04:00 UTC, queues sound dynamic segments in dependency order.
  It is the backstop for writes that do not emit business events.

Controllers emit business events; event handlers enqueue reconciliation jobs. Reconciliation
is not a lookup performed inside a model's write hook. Changing dynamic to static preserves
membership; changing static to dynamic schedules a fresh reconciliation.

## Rule health and references

The save gate validates the lens vocabulary and refuses self-reference, cycles, unsupported
path-to-path comparisons, and references outside the owner's live segments. `RuleReference`
edges record named segments. Health is derived from those edges and their dependency closure;
a live segment can be degraded because a segment it depends on is degraded.

Owner reads include `ruleIssues`. Customer-facing membership reads expose segment identity,
name, owner, type and creation date, without the rule or its issues. Degraded segments retain
their existing membership and are skipped by continuous reconciliation and sweep/fan-out
selection. Evaluation errors still fail jobs and use normal retries.

## API

Paths below are relative to `/api/v1`:

| Operation | Routes |
| --- | --- |
| Read, update, delete a segment | `/segment/:id` |
| List members | `/segment/:id/segmentMembers` |
| List owned segments or memberships | `/me`, `/user/:id`, `/organization/:id`, `/space/:id`, each with `/segments` or `/segmentMemberships` |
| Create a segment | `/me/segments`, `/organization/:id/segments`, `/space/:id/segments`; platform-owned: `POST /admin/segment` |
| Estimate rule reach without saving | `POST /me/segments/reach`, `/organization/:id/segments/reach`, `/space/:id/segments/reach`, `/admin/segment/reach` |
| Every owner's segments (superadmin) | `GET /admin/segment`, filter with `searchFields[ownerModel]=platform` |

Reach accepts `{ conditions }` and returns `{ count }`, using the same rule and reference
admission checks as saving. Existing route permissions govern each owner context.

## Web navigation

The web sidebar nests two pages under **Segments**, in personal, organization and space contexts:

- **Owned** — `/segments/owned`: the provider's segments, with rule-health status.
- **Memberships** — `/segments/memberships`: segments the current customer belongs to.

`/segments` redirects to Owned while preserving organization, space and spoof context.
`SegmentsPage` receives `view: 'owned' | 'memberships'`; only the selected query is enabled.
The pages are read-only. Conditions are still authored through the API; a segment rule editor
has not shipped.

## Events and email integration

Membership diffs publish two event pairs: `segment.membersAdded` / `segment.membersRemoved`
for the owner, and `customerRef.segmentsAdded` / `customerRef.segmentsRemoved` for the customer.
Owner events refetch the segment's member-list channel. For User customers, customer events
send a targeted `meReadManySegmentMemberships` refetch to that user's sockets. Segment deletion
captures member IDs before the junction is removed and publishes the removals too.

The email recipient lens exposes `providerRefs.segmentMembers.segment`. Its owner scoping,
reference admission and degraded-segment filtering constrain which memberships a template
can inspect. See [COMMUNICATIONS.md](COMMUNICATIONS.md#the-email-lens).

## Remaining work

- `RECONCILE_TRIGGERS` covers the lens's reached models, but registry coverage is not proof of
  every writer emitting an event. `customerRef.created`, `user.updated`, `tag.deleted`,
  `tagAttachment.created` and `tagAttachment.deleted` have handlers without production emitters.
- Field/model-specific trigger narrowing and hydration of only the affected rule paths are pending.
- The rule editor, provider-side customer lists for User/Organization, and `CustomerRef.lastActiveAt`
  remain separate work.
- Whether `customerRefLens` should become a general customer lens is an unresolved design question.
- Flag-selected email variants are not implemented; feature flags are, see [FEATURE_FLAGS.md](FEATURE_FLAGS.md).

## Source map

- `packages/db/prisma/schema/segment.prisma`, `segmentMember.prisma`: data model.
- `apps/api/src/modules/customerRef/lib/customerRefLens.ts`: vocabulary and ownership scope.
- `apps/api/src/modules/segment/`: routes, services, trigger registry and tests.
- `apps/api/src/jobs/handlers/`: reconciliation and sweep jobs.
- `apps/web/app/config/nav/features/segments.ts`, `apps/web/app/routes/_authenticated/segments/`:
  sidebar and child routes.
- `packages/ui/src/pages/SegmentsPage.tsx`: owned and membership views.

Decision history and remaining design work: [FEAT-021](../../tickets/FEAT-021-segments.md).
