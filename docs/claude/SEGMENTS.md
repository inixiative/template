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

A segment is a named set of a provider's `CustomerRelationship` rows. Its owner is a User,
Organization or Space (`ProviderModel`), and every member must be a customer relationship
belonging to that provider. Segment rules do not describe an unrestricted set of users.

`CustomerRelationship` is the rule root. `customerRelationshipLens` declares the fields and relations that
rules may read, including contacts, tags, received communications and other segment
memberships. `resolvedCustomerRelationshipLens(ownerModel, ownerId)` binds the provider scope.
Shared lens conditions also restrict related tags and communications to the permitted owner.

## Static and dynamic membership

Every segment has `conditions`. A static segment is computed after creation or a rule
change; a dynamic segment also reacts to customer changes. A hand-picked audience is a
static rule over customer-relationship IDs. There is no direct member add/remove API.

- `reconcileSegment` evaluates the whole set through `toPrisma` and applies a membership diff.
- `reconcileCustomerRelationshipSegments` accepts `{ customers: [{ customerModel, customerId }] }`, finds
  those customers' relationships in one query, and reconciles them a provider at a time: one
  `fetchLens` hydrate per page of relationships, `check()` per dynamic segment in dependency order,
  and one membership diff per segment for the whole page. It is a plain job, not superseding: two runs
  over the same customer read live rows, so the second only repeats work. Enqueue it through
  `enqueueSegmentReconcileForCustomers` (`modules/segment/lib/enqueueSegmentReconcileForCustomers.ts`),
  which drops duplicates and sends every customer it is given in one job: an event that carries many
  rows (`tag.deleted`) makes one job, not one per row.
- `reconcileEveryHealthyDynamicSegment`, seeded for 04:00 UTC, queues healthy dynamic segments in dependency order.
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
their existing membership and are skipped by continuous reconciliation, the nightly reconcile and fan-out
selection. Evaluation errors still fail jobs and use normal retries.

## API

Paths below are relative to `/api/v1`:

| Operation | Routes |
| --- | --- |
| Read, update, delete a segment | `/segment/:id` |
| List members | `/segment/:id/segmentMembers` |
| List owned segments or memberships | `/me`, `/user/:id`, `/organization/:id`, `/space/:id`, each with `/segments` or `/segmentMemberships` |
| Create a segment | `/me/segments`, `/organization/:id/segments`, `/space/:id/segments` |
| Estimate rule reach without saving | `POST /me/segments/estimateReach`, `/organization/:id/segments/estimateReach`, `/space/:id/segments/estimateReach` |

`GET /segment/info` (public) describes what `conditions` may read: every field `customerRelationshipLens`
exposes (dotted path from `CustomerRelationship`, kind, enum values, list relations, and `sourced` fields that
take the id of a row the owner may name), built with `projectLens` (`lensFields` in
`@template/shared/rules`). `conditions` is tagged `rule`: its grammar is `@inixiative/json-rules` and
is not restated. Its `guide` says what each key means.

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
for the owner, and `customerRelationship.segmentsAdded` / `customerRelationship.segmentsRemoved` for the customer.
Owner events refetch the segment's member-list channel. For User customers, customer events
send a targeted `meReadManySegmentMemberships` refetch to that user's sockets. Segment deletion
captures member IDs before the members are tombstoned with it and publishes the removals too. A
removed member is tombstoned, not deleted, so the rules naming it are degraded; one that comes
back is revived (`revive` in `applyMembershipDiff`).

The email recipient lens exposes `customerRelationshipsAsCustomer.segmentMembers.segment`. Its owner scoping,
reference admission and degraded-segment filtering constrain which memberships a template
can inspect. See [COMMUNICATIONS.md](COMMUNICATIONS.md#the-email-lens).

## Remaining work

- `RECONCILE_TRIGGERS` covers the lens's reached models, but registry coverage is not proof of
  every writer emitting an event. `customerRelationship.created`, `user.updated`, `tag.deleted`,
  `tagAttachment.created` and `tagAttachment.deleted` have handlers without production emitters.
- Field/model-specific trigger narrowing and hydration of only the affected rule paths are pending.
- The rule editor, provider-side customer lists for User/Organization, and a last-active timestamp
  on `CustomerRelationship` (the TODO in `packages/db/prisma/schema/customerRelationship.prisma`) remain separate work.
- Whether `customerRelationshipLens` should become a general customer lens is an unresolved design question.
- Feature flags and flag-selected email variants are not implemented.

## Source map

- `packages/db/prisma/schema/segment.prisma`, `segmentMember.prisma`: data model.
- `apps/api/src/modules/customerRelationship/lib/lenses/`: the static lenses, `customerRelationshipLens` (vocabulary
  and ownership scope) and `customerRelationshipsByIdLens` (the rows a reconcile hydrates).
- `apps/api/src/modules/segment/`: routes, services, trigger registry and tests.
- `apps/api/src/jobs/handlers/`: segment reconciliation jobs.
- `apps/web/app/config/nav/features/segments.ts`, `apps/web/app/routes/_authenticated/segments/`:
  sidebar and child routes.
- `packages/ui/src/pages/SegmentsPage.tsx`: owned and membership views.

Decision history and remaining design work: [FEAT-021](../../tickets/FEAT-021-segments.md).
