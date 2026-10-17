# AUTH-006: Enforce webhook tenant isolation

**Status**: ⏸ Postponed (design agreed 2026-10-15; build later)
**Assignee**: Unassigned
**Priority**: High
**Created**: 2026-09-30
**Updated**: 2026-10-15

## Problem

An owner-scoped webhook subscription can be targeted with a mutation belonging to an unrelated actor. Subscription creation is scoped to User, Organization, or Space, but the mutation hook selects all active subscriptions for an enabled webhook model without establishing their owners' entitlement to the affected record.

Related-model routing also loses context: `webhookRelatedModels.User` declares a CustomerRef relationship, but the hook uses only the target model name. A User mutation consequently produces a CustomerRef webhook carrying the User row and User resource ID, without resolving a corresponding CustomerRef or its authorized audience.

## Verified reproduction

Reviewed local source at `66b44293b9537e2f91f9f8de081decefb90fdf37` on 2026-09-30. The probe used the repository's real database client, factories, and webhook hook, with a spy at `enqueueJob` to prevent external delivery:

1. Create an organization and a separate user using `createOrganization` and `createUser`.
2. Create an active `CustomerRef` webhook subscription with `ownerModel: 'Organization'`, that organization's `organizationId`, and null `userId` / `spaceId`.
3. Confirm there are no CustomerRef relationships connecting the user and organization, in either customer/provider direction.
4. Register `registerWebhookHook()` and intercept `enqueueJob` with `spyOn`.
5. Update the unrelated user's name through `db.user.update`.
6. Observe a `sendWebhook` enqueue call with the organization's subscription ID, the unrelated user's resource ID, and the user's changed name in `data`.

Observed result:

```json
{
  "probe": "webhook-tenant-boundary",
  "noCustomerRelationship": true,
  "unrelatedSubscriptionTargeted": true
}
```

This establishes unauthorized targeting at the enqueue boundary. No external webhook was sent by the probe, and no hosted disclosure was established. The current delivery worker checks subscription activity and poisoned-record state but does not enforce the subscription owner's access to the payload.

## Seen in production (2026-10-15)

An outside-agent test of Kingdom prod (GPT-6-Astra and GPT-6.1-Sol, each in its own sandbox organization) reproduced this end to end. Sol's organization created a `CustomerRef` subscription; it then received six events about Astra's Space, in a different organization, all delivered to the subscriber's URL. Each Space change was delivered twice, because `webhookRelatedModels.Space` lists two axes and the hook enqueues once per axis without deduplicating.

## Design (agreed with Aron, 2026-10-15)

Tenancy comes from `CustomerRef`. Zealot's brand-based filter (`eligibleWebhookSubscriptionsWhere` in Zealot's `hooks/webhooks/hook.ts`) is not the model: Zealot tenancy is one owner per record, while a CustomerRef is a relationship between two parties, either of which may listen. Only its per-target deduplication carries over.

- **A webhook event is about one CustomerRef.** `resourceId` is the CustomerRef id, so `IntegrationRecord` and poisoning stay per relationship.
- **Triggers.** A CustomerRef row is created, updated or deleted; or a party (User, Organization, Space) changes, which fans out to every live CustomerRef that party stands on, through the axes declared in `webhookRelatedModels`. One event per (subscription, CustomerRef) per mutation.
- **Audience: the two parties of that CustomerRef.** The provider hears about its customers ("my customer changed"); the customer hears about its provider ("my organization changed"). No one else.
- **Both axes for every party.** `CustomerModel` and `ProviderModel` both allow User, Organization and Space, so each party model is registered on both `customerModel` and `providerModel` axes (today User and Organization are on the customer axis only).
- **Inheritance must work.** An organization's subscription also hears about the CustomerRefs of the organization's spaces (Aron: "Inheritance should be able to work"). Resolve it through the existing ownership relations, not a second registry.
- **Payload.** The CustomerRef plus the counterpart party's columns (scalar only, redacted), plus which side changed: `customer`, `provider` or `relationship`.
- **Delivery-time check.** `sendWebhook` re-checks that the CustomerRef is still live and the subscriber is still one of its parties (or inherits one); otherwise it sends nothing and stores no `WebhookEvent`.

## Open questions

- **Own record.** Does an owner's subscription hear changes to the owner itself (an organization listening to its own row) without a CustomerRef? Aron said "I can listen to my own org"; it is unresolved whether that means the owner's own row or a member listening to their organization.
- **Who creates CustomerRefs.** Nothing in template, Kingdom or Tribe creates CustomerRefs outside factories, so after this fix those apps deliver no webhooks until each app decides which relationships are CustomerRefs (for example whether organization membership makes a user a customer of the organization).
- **Counterpart visibility.** Which of a provider's fields its customers may receive, and the reverse.

## Implementation references

- [Webhook hook](../apps/api/src/hooks/webhooks/hook.ts): `registerWebhookHook` selects subscriptions by model and activity; `processSingleRecord` excludes the originating integration but does not filter by ownership.
- [Related-model registry](../packages/db/src/registries/webhook/relatedModels.ts): declares the CustomerRef axes for User, Organization, and Space mutations.
- [Subscription schema](../packages/db/prisma/schema/webhookSubscription.prisma): records User/Organization/Space ownership.
- [Organization subscription creation](../apps/api/src/modules/organization/controllers/organizationCreateWebhookSubscription.ts): stamps the organization owner at creation.
- [Delivery worker](../apps/api/src/jobs/handlers/sendWebhook.ts): sends the queued payload without an owner-entitlement check.
- [Existing hook tests](../apps/api/src/hooks/webhooks/hook.test.ts): cover mutation actions, no-op suppression, and integration-origin suppression; add explicit ownership isolation coverage.

## Scope and decisions

- Define which records each User, Organization, and Space subscription is entitled to receive, including any intended organization-to-space inheritance and customer/provider direction.
- Resolve related-model changes through the declared relationships before choosing recipients.
- Define the CustomerRef event's payload and resource ID: a CustomerRef snapshot or an explicitly identified related-resource change. Preserve the intended integration contract while preventing unrelated-row exposure.
- Enforce recipient isolation before enqueueing, and define the delivery-time behavior when the relationship or subscription ownership changes while work is queued.
- Preserve integration-origin suppression, inactive-subscription handling, poisoned-record isolation, and no-op suppression.

This ticket concerns recipient authority and payload scoping. Existing transaction and post-commit semantics remain the intended contract. WebSocket permission-change interruption is tracked separately in AUTH-005 and remains an accepted deferred follow-up.

## Definition of Done

- [ ] The verified unrelated-organization/User reproduction becomes a regression asserting zero unauthorized enqueue calls.
- [ ] User-, Organization-, and Space-owned subscriptions have positive entitlement tests and negative unrelated-owner tests.
- [ ] Related User/Organization/Space mutations reach only the audience established by their CustomerRef relationships, with a documented payload/resource-ID contract.
- [ ] Direct CustomerRef mutations, bulk mutations, and deletes preserve ownership isolation; delete handling retains the relationship context needed for an authorized event.
- [ ] Tests cover a queued delivery whose owner relationship changes before execution, according to the documented authorization policy.
- [ ] Denied deliveries perform no outbound fetch and persist no unauthorized payload in WebhookEvent.
- [ ] Origin suppression, inactive subscriptions, poisoned records, no-op suppression, and post-commit scheduling retain their existing behavior.
- [ ] Webhook documentation states the ownership and delivery-time authorization guarantees.

## Related tickets

- [INFRA-006: Tenant Isolation Test Matrix](./INFRA-006-tenant-isolation-test-matrix.md)
- [INFRA-032: Webhook poisoned records](./INFRA-032-webhook-poisoned-records.md)
- [AUTH-005: WebSocket permission-change interruption](./AUTH-005-websocket-permission-change-interruption.md)
