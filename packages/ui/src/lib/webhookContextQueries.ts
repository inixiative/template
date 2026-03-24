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
import { makeContextQueries, mutation, query } from '@template/ui/lib/makeContextQueries';

export const webhookContextQueries = makeContextQueries()({
  user: () => ({
    readMany: query({
      queryKey: meReadManyWebhookSubscriptionsQueryKey(),
      queryFn: apiQuery((opts: Parameters<typeof meReadManyWebhookSubscriptions>[0]) =>
        meReadManyWebhookSubscriptions(opts),
      ),
    }),
    create: mutation({
      mutationFn: apiMutation((opts: Parameters<typeof meCreateWebhookSubscription>[0]) =>
        meCreateWebhookSubscription(opts),
      ),
    }),
    delete: mutation({
      mutationFn: apiMutation((opts: Parameters<typeof webhookSubscriptionDelete>[0]) =>
        webhookSubscriptionDelete(opts),
      ),
    }),
  }),
  organization: ({ organization }) => ({
    readMany: query({
      queryKey: organizationReadManyWebhookSubscriptionsQueryKey({ path: { id: organization.id } }),
      queryFn: apiQuery((opts: Parameters<typeof organizationReadManyWebhookSubscriptions>[0]) =>
        organizationReadManyWebhookSubscriptions({ ...opts, path: { id: organization.id } }),
      ),
    }),
    create: mutation({
      mutationFn: apiMutation((opts: Parameters<typeof meCreateWebhookSubscription>[0]) =>
        organizationCreateWebhookSubscription({ ...opts, path: { id: organization.id } }),
      ),
    }),
    delete: mutation({
      mutationFn: apiMutation((opts: Parameters<typeof webhookSubscriptionDelete>[0]) =>
        webhookSubscriptionDelete(opts),
      ),
    }),
  }),
  space: ({ space }) => ({
    readMany: query({
      queryKey: spaceReadManyWebhookSubscriptionsQueryKey({ path: { id: space.id } }),
      queryFn: apiQuery((opts: Parameters<typeof spaceReadManyWebhookSubscriptions>[0]) =>
        spaceReadManyWebhookSubscriptions({ ...opts, path: { id: space.id } }),
      ),
    }),
    create: mutation({
      mutationFn: apiMutation((opts: Parameters<typeof meCreateWebhookSubscription>[0]) =>
        spaceCreateWebhookSubscription({ ...opts, path: { id: space.id } }),
      ),
    }),
    delete: mutation({
      mutationFn: apiMutation((opts: Parameters<typeof webhookSubscriptionDelete>[0]) =>
        webhookSubscriptionDelete(opts),
      ),
    }),
  }),
});
