# Feature Flags

<!-- toc:start -->

## Contents

- [What a flag is](#what-a-flag-is)
- [Owners, subjects and audiences](#owners-subjects-and-audiences)
- [Resolution](#resolution)
- [Reading a flag](#reading-a-flag)
- [Writing flags and variants](#writing-flags-and-variants)
- [Invalidation and live updates](#invalidation-and-live-updates)
- [API](#api)
- [Source map](#source-map)

<!-- toc:end -->

## What a flag is

A `FeatureFlag` is a slug owned by a provider that resolves to a typed value for each of that
provider's customers. Its `valueType` (`boolean | string | number | json`) is immutable, as are
`slug` and `subjectModel`. Its rules are `FeatureFlagVariant` rows walked in `position` order;
every rule is "the subject is a member of this segment" and nothing else. One variant may be
`isDefault`: it has no segment and serves whoever no rule matched. Exactly the value column
matching the flag's type is set on each variant.

Two namespaces resolve the same way. A bare slug (`dark-mode`) may be created only by the
platform. Every other owner's slug carries `custom:` (`custom:dark-mode`). Inheritance down the
provider chain is undefined in v1; see FEAT-022.

## Owners, subjects and audiences

The owner is a `ProviderModel` (`platform | User | Organization | Space`); the platform is the
one owner with no key column. A subject is a `CustomerRef` whose provider is the owner, so a
flag never addresses staff (`OrganizationUser` / `SpaceUser`). `subjectModel` names which kind of
customer the flag addresses and is enforced at resolution.

Every user, organization and space is provisioned a platform `CustomerRef` on create
(`hooks/platformCustomerRef`), with `db:backfill:platformCustomerRefs` for existing rows.

A variant's audience is a `Segment` of the same owner: a shared one the owner named, or an inline
one carrying `Segment.featureFlagVariantId`. An inline segment is created and edited only through
its variant, deleted with it, excluded from segment lists, pickers and the lens `Segment.id` source,
and refused as a gate or audience by any other flag or variant. A percentage rollout is an inline
static segment whose rule is `id in [...]`, sampled from the owner's customers of the subject kind
or from a named segment (`sample: { percent, from? }`). A boolean flag is created with an `on`
variant over an inline open dynamic segment, so create → toggle `enabled` is the whole kill switch.

## Resolution

`resolveFlags(refs)` folds, per customer ref and per flag that addresses its kind:

1. `enabled` false → the type's zero (`false`, `""`, `0`, `null`). Never the default variant.
2. The flag's gate `segmentId` is set and the ref is not a live member → default variant, else zero.
3. Rule variants in `position` order; the first whose live segment contains the ref wins.
4. No match → default variant, else zero.

A soft-deleted segment never matches. Nothing is stored per subject: membership is materialized by
FEAT-021, values are a fold over cached rows (the owner's flags, each flag's variants, the ref's
memberships, each referenced segment's row).

Reordering variants moves what overlapping subjects are served and nothing else; an owner who wants
experiment arms to hold still makes the segments disjoint.

## Reading a flag

On a request, `requestFeatureFlags(c)` resolves once for the caller's refs (their own, plus the
platform refs of the organizations and spaces they act in) and memoizes on `c.var.featureFlags`,
cloned into batch sub-requests. `checkFlag(resolved, owner, slug, type, subject?)` returns the value
typed as `type`; a missing flag or a mismatched type is `null`, logged once per slug. Off-request
callers (jobs, event handlers, email render) call `resolveFlags` directly.

`GET /me/featureFlagValues` is the subject-facing read: owner, customer, slug, type, value. Variant
labels and rules are owner-side only.

## Writing flags and variants

Row-local invariants live in `hooks/featureFlag` and `hooks/featureFlagVariant`: slug shape and
namespace, gate/audience owned by the flag's owner and not another variant's inline segment, default
row segment-less, rule row with a segment, exactly one value column. Label uniqueness and the single
default are partial unique indexes. `writeVariant.ts` owns the inline-segment lifecycle: create with
the rule, re-point, detach (tombstone) and delete, and refuses more than one audience per write.

## Invalidation and live updates

`cacheReference` busts `<owner>:featureFlags`, `featureFlag:<id>:variants`, `segment:<id>` and
`customerRef:<id>:segmentMembers` on the corresponding row writes; `FeatureFlagVariant.position` is
exempt from `NOOP_FIELDS` so a reorder busts and emits. Any flag or variant write emits
`featureFlag.changed`, broadcast as a `meReadManyFeatureFlagValues` refetch; membership events send
the same refetch to the affected user.

## API

Paths relative to `/api/v1` unless noted:

| Operation | Routes |
| --- | --- |
| Create, list an owner's flags | `/me/featureFlags`, `/organization/:id/featureFlags`, `/space/:id/featureFlags`; platform: `/admin/featureFlag` |
| Read, update, delete a flag | `/featureFlag/:id` |
| Add a variant | `POST /featureFlag/:id/featureFlagVariants` with `segmentId` \| `inlineSegment` \| `sample` |
| Edit, reorder, delete a variant | `PATCH` / `DELETE /featureFlagVariant/:id` (`position` reorders) |
| Values for the caller | `GET /me/featureFlagValues` |
| Every owner's flags (superadmin) | `GET /admin/featureFlag`, filter `searchFields[ownerModel]=platform` |

## Source map

- `packages/db/prisma/schema/featureFlag.prisma`, `segment.prisma` (`featureFlagVariantId`).
- `apps/api/src/modules/featureFlag/`: schemas, services (`resolveFlags`, `checkFlag`,
  `requestFeatureFlags`, `writeVariant`, `sampleCustomerRefIds`, `createFeatureFlag`), routes, tests.
- `apps/api/src/hooks/featureFlag`, `featureFlagVariant`, `featureFlagChanged`, `platformCustomerRef`.
- `packages/shared/src/utils/slug.ts`: slug and `custom:` schema shared by API and UI.

Decision history: [FEAT-003](../../tickets/FEAT-003-feature-flags.md); inheritance: FEAT-022.
