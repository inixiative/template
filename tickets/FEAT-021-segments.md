# FEAT-021: Segments — named sets of a provider's customer references

**Status**: 👀 Review
**Assignee**: Aron
**Priority**: Medium
**Created**: 2026-09-09
**Updated**: 2026-09-09

> Zealot's `Groups` / `FanUsersGroup` (ZLT-4331, ZLT-4441, the `segmentLens.ts` / `reconciliation.ts` / `categorizeDynamicSegmentsForReconcile.ts` line) ported onto the template's `CustomerRef`. FEAT-020, INFRA-014 and INFRA-024 already assumed a segment consumer existed; this is the model they were pointing at.

---

## Decisions

- **Entry point is `CustomerRef`, not `User`.** Zealot's `FanUsers` is a fan-times-brand row and every segment is brand-scoped through a `brandUuid` bind on the lens root. `CustomerRef` is the same shape (customer-times-provider), so the lens roots there and the tenancy bind is the provider FK.
- **Owner is false-polymorphic User | Organization | Space**, the template's owner convention (Contact, Tag, Integration). The owner is the *provider* whose customers are segmented, so the owner axis is coupled to `CustomerRef.providerModel`. Today only the Space branch has a provider FK; a User- or Organization-owned segment is legal but has nothing to select from and a dynamic one is refused at the persistence hook (`no provider branch for User`). Growing `ProviderModel` (the FK + registry entry the CustomerRef file already anticipates) lights those branches up with no segment code change — the lens builder reads the FK from `PolymorphismRegistry`.
- **Two kinds, one junction.** `type` static | dynamic on the segment; `SegmentMember.source` rule | manual on the row. A manual member is never evicted by reconcile; a rule member is owned by reconcile. Static = no conditions, manual members only.
- **Lens is the single source.** `segmentLensFor(ownerModel)` (`apps/api/src/modules/segment/lib/segmentLens.ts`) declares the vocabulary (CustomerRef scalars, the three customer branches with contacts / tag attachments / received communications, and `segmentMembers → segment.id` for segment-of-segment), the tenancy bind, and the `Segment.id` source (`mapDefaults`) that makes "members of segment X" a picker with options. Validation, evaluation, hydration and reference extraction all read it. A boot probe asserts the membership source is reachable, as Zealot's does.
- **Inbound triggers are DB hooks, not app events.** AuditLog is the row-level event log (ZLT-3109 ruling); app events are business events. Zealot triggers off app events because its events pre-existed for other consumers, its hydration include was hand-written, and legacy write paths bypassed the client — none of which hold here. `segmentReconcile` registers on every model the lens reaches (the list is derived, and `customerRefIdsForRows` refuses to boot if the lens reaches a model it cannot map back to customer references), skips no-op updates, and enqueues on commit — the webhook hook's shape.
- **Recalculation lives in jobs.** Two rails, one AST: `reconcileSegment` (superseding by segment id) is set-based — `toPrisma` over the resolved lens, one query per segment, diff against the junction. `reconcileCustomerRefSegments` (superseding by customer ref id) hydrates the one customer reference through `fetchLens` on the same lens and runs `check()` per dynamic segment in dependency order, updating the in-memory memberships between segments so segment-of-segment resolves in one pass. `sweepSegments` (cron, 04:00 UTC) is the backstop: applies the pause verdicts and enqueues the rest in dependency order.
- **Outbound is one app event.** `segment.membershipChanged` carries added / removed customer ref ids and the affected customer user ids; the websocket channel refetches the segment's member list and pushes a `meReadManySegmentMemberships` refetch to those users. That is the seam FEAT-012 notifications and INFRA-004 targeting subscribe to.
- **Pause, don't guess.** `reconcilePausedAt / Reason / Detail` with `cycle | danglingReference | dynamicReference | evaluationError`. The save gate refuses self-reference, `path`-read references, out-of-vocabulary rules, and references to segments the owner does not have live, so the sweep's structural verdicts only bite on rows that arrived out of band. An evaluation error pauses on the final attempt rather than re-failing every run, and that one pause stays retryable: the next reconcile (a conditions edit, the sweep) runs the segment and clears it on success.
- **Freeze, don't orphan.** Flipping a dynamic segment to static converts its rule members to manual, so the audience the provider was looking at is what the static segment holds. Pinning a customer the rule already selected converts that row to manual instead of failing on the unique.
- **Every lens branch re-asserts the owner.** Contacts and tags are the customer's own rows; received communications are not, so that branch admits only messages the owner (or the platform) sent. Otherwise a provider could read, through membership, which of its customers other providers are messaging.
- **Left behind from Zealot**: `GroupConditions`, integer ids, dual timestamps, `referencesSegments`, `inviteNewMembersOnly`, visibility / origin / programTypeOverride, `legacyConditionsToRules`, and the per-user `hydrateUserContext` (INFRA-014's anti-pattern; `fetchLens` + `includeFromLens` replace it).

## What shipped

- Schema: `segment.prisma`, `segmentMember.prisma`; `segments` relation on User / Organization / Space; `segmentMembers` on CustomerRef; AuditLog subject FK + audit-enabled.
- Registries: `PolymorphismRegistry.Segment`, audit, factories (`createSegment`, `createSegmentMember`), rebac (`db:segment` owner walk, `db:segmentMember` through its segment), WS channel `segmentReadManySegmentMembers`, cron seed row.
- Hooks: `segmentConditions` (validate + normalize + refuse self / dynamic / unowned references, static ⇔ no conditions), `segmentFreeze` (dynamic → static converts rule members to manual), `segmentMemberOwner` (member's customer ref must belong to the segment's owner as provider), `segmentReconcile` (trigger).
- Services under `apps/api/src/modules/segment/services/`: `validateSegmentConditions`, `segmentReferences`, `segmentReferenceGraph`, `evaluateSegment` (+ `estimateSegmentReach`), `hydrateCustomerRefs`, `applyMembershipDiff`, `reconcileSegment`, `reconcileCustomerRef`, `segmentReconcilePause`, `customerRefIdsForRows`, `publishMembershipChange`.
- Jobs: `reconcileSegment`, `reconcileCustomerRefSegments`, `sweepSegments`.
- App event: `segment.membershipChanged`.
- Routes: `/segment/:id` read / update / delete, `/segment/:id/segmentMembers` list + manual add, `/segmentMember/:id` delete (manual only); `/me|/organization/:id|/space/:id` `segments` list + create and `segmentMemberships` list.
- Web: Segments page (owned + member-of) in user, organization and space contexts.
- Tests: `apps/api/src/modules/segment/tests/` (36) — conditions hook, reference graph, pause verdicts, reconcile (set-based, provider scoping, pinned members, member-owner refusal, user-write trigger, contact-write trigger through the owner, cross-provider communications excluded, segment-of-segment in one pass and in dependency order, evaluation-error retry, freeze on flip to static, static never reconciled), routes end to end (customer-facing membership shape, pin-converts-rule-row).
- Adversarial review (4 confirmed tenant/correctness findings, 2 lifecycle findings) folded in before the PR: sender bind on communications, in-memory segment row carries owner columns, retryable evaluation pause, customer-facing segment pick, unowned references refused at save, freeze on flip.

## Open

- **`ProviderModel` growth.** The owner axis is declared over all three models on the architect's call; whether User / Organization become providers is a CustomerRef decision, not a segment one. Until then the two branches are dead on the owner side and live on the member side.
- **Field-level trigger narrowing.** FEAT-020 specifies reconcile "keyed off which segments reference a field". The hook narrows by model and no-op today; recording the lens paths each segment reads at save time (next to the INFRA-030 edges) and intersecting with the changed columns is the next cut, and it lands with the EAV substrate whose contribution rows are the hot writer.
- **INFRA-030 reference registry.** `segmentReferences` extracts edges from the lens via `ruleSourceValues` exactly as INFRA-030's `syncRuleReferences` does; when that branch lands, Segment registers as an owner surface (`conditions`) and a referenced model, and `referencedBy` becomes an indexed read instead of a per-owner tree scan.
- **Builder surface.** `conditions` is authored as JSON through the API today. The rules-builder descriptor over `segmentLensFor(owner)` is INFRA-017 / INFRA-024's first real per-surface consumer, as those tickets already say.
- **`estimateSegmentReach`** exists as a service and has no route yet; it is the "estimated reach" affordance of Zealot's editor and belongs with the builder.
- **`CustomerRef.lastActiveAt`** (the TODO on the model) is the one column an "active within" segment needs; it was Zealot's most requested card.
