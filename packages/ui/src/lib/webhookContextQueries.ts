import {
  meCreateWebhookSubscription,
  meReadManyWebhookSubscriptions,
  meReadManyWebhookSubscriptionsQueryKey,
  organizationCreateWebhookSubscription,
  organizationReadManyWebhookSubscriptions,
  organizationReadManyWebhookSubscriptionsQueryKey,
  spaceCreateWebhookSubscription,
  spaceReadManyWebhookSubscriptions,
  spaceReadManyWebhookSubscriptionsQueryKey,
  webhookSubscriptionDelete,
} from '@template/ui/apiClient';
import { apiMutation } from '@template/ui/lib/apiMutation';
import { apiQuery } from '@template/ui/lib/apiQuery';
import { type MutationSlot, makeContextQueries, type QuerySlot } from '@template/ui/lib/makeContextQueries';

type WebhookQueries = { readMany: QuerySlot; create: MutationSlot; delete: MutationSlot };

export const webhookContextQueries = makeContextQueries({
  user: (): WebhookQueries => ({
    readMany: {
      queryKey: meReadManyWebhookSubscriptionsQueryKey(),
      queryFn: apiQuery((opts: Parameters<typeof meReadManyWebhookSubscriptions>[0]) =>
        meReadManyWebhookSubscriptions(opts),
      ),
    },
    create: {
      mutationFn: apiMutation((opts: Parameters<typeof meCreateWebhookSubscription>[0]) =>
        meCreateWebhookSubscription(opts),
      ),
    },
    delete: {
      mutationFn: apiMutation((opts: Parameters<typeof webhookSubscriptionDelete>[0]) =>
        webhookSubscriptionDelete(opts),
      ),
    },
  }),
  organization: ({ organization }): WebhookQueries => ({
    readMany: {
      queryKey: organizationReadManyWebhookSubscriptionsQueryKey({ path: { id: organization.id } }),
      queryFn: apiQuery((opts: Parameters<typeof organizationReadManyWebhookSubscriptions>[0]) =>
        organizationReadManyWebhookSubscriptions({ ...opts, path: { id: organization.id } }),
      ),
    },
    create: {
      mutationFn: apiMutation((opts: Parameters<typeof meCreateWebhookSubscription>[0]) =>
        organizationCreateWebhookSubscription({ ...opts, path: { id: organization.id } }),
      ),
    },
    delete: {
      mutationFn: apiMutation((opts: Parameters<typeof webhookSubscriptionDelete>[0]) =>
        webhookSubscriptionDelete(opts),
      ),
    },
  }),
  space: ({ space }): WebhookQueries => ({
    readMany: {
      queryKey: spaceReadManyWebhookSubscriptionsQueryKey({ path: { id: space.id } }),
      queryFn: apiQuery((opts: Parameters<typeof spaceReadManyWebhookSubscriptions>[0]) =>
        spaceReadManyWebhookSubscriptions({ ...opts, path: { id: space.id } }),
      ),
    },
    create: {
      mutationFn: apiMutation((opts: Parameters<typeof meCreateWebhookSubscription>[0]) =>
        spaceCreateWebhookSubscription({ ...opts, path: { id: space.id } }),
      ),
    },
    delete: {
      mutationFn: apiMutation((opts: Parameters<typeof webhookSubscriptionDelete>[0]) =>
        webhookSubscriptionDelete(opts),
      ),
    },
  }),
});
