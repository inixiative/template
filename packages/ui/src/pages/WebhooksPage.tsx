import {
  meReadManyWebhookSubscriptions,
  meReadManyWebhookSubscriptionsQueryKey,
  type MeReadManyWebhookSubscriptionsResponse,
  meCreateWebhookSubscription,
  organizationReadManyWebhookSubscriptions,
  organizationReadManyWebhookSubscriptionsQueryKey,
  type OrganizationReadManyWebhookSubscriptionsResponse,
  organizationCreateWebhookSubscription,
  spaceReadManyWebhookSubscriptions,
  spaceReadManyWebhookSubscriptionsQueryKey,
  type SpaceReadManyWebhookSubscriptionsResponse,
  spaceCreateWebhookSubscription,
  webhookSubscriptionDelete,
  type MeCreateWebhookSubscriptionData,
  type OrganizationCreateWebhookSubscriptionData,
  type SpaceCreateWebhookSubscriptionData,
  type WebhookSubscriptionDeleteData,
} from '@template/ui/apiClient';
import { apiMutation } from '@template/ui/lib/apiMutation';
import { apiQuery } from '@template/ui/lib/apiQuery';
import { MasterDetailLayout, DetailPanel } from '@template/ui/components/layout';
import { useOptimisticListMutation, useQuery } from '@template/ui/hooks';
import { useAppStore } from '@template/ui/store';
import type { AuthenticatedContext } from '@template/ui/store/types/tenant';
import { Button, Table } from '@template/ui/components';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

type WebhookSubscription =
  | MeReadManyWebhookSubscriptionsResponse['data'][number]
  | OrganizationReadManyWebhookSubscriptionsResponse['data'][number]
  | SpaceReadManyWebhookSubscriptionsResponse['data'][number];

export const WebhooksPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const context = useAppStore((state) => state.tenant.context) as AuthenticatedContext;
  const organizationId = context.organization?.id;
  const spaceId = context.space?.id;

  const endpoints = (() => {
    switch (context.type) {
      case 'user':
        return {
          queryKey: meReadManyWebhookSubscriptionsQueryKey(),
          queryFn: apiQuery((opts: Parameters<typeof meReadManyWebhookSubscriptions>[0]) =>
            meReadManyWebhookSubscriptions(opts)),
        };
      case 'organization':
        return {
          queryKey: organizationReadManyWebhookSubscriptionsQueryKey({ path: { id: organizationId! } }),
          queryFn: apiQuery((opts: Parameters<typeof organizationReadManyWebhookSubscriptions>[0]) =>
            organizationReadManyWebhookSubscriptions({ ...opts, path: { id: organizationId! } })),
        };
      case 'space':
        return {
          queryKey: spaceReadManyWebhookSubscriptionsQueryKey({ path: { id: spaceId! } }),
          queryFn: apiQuery((opts: Parameters<typeof spaceReadManyWebhookSubscriptions>[0]) =>
            spaceReadManyWebhookSubscriptions({ ...opts, path: { id: spaceId! } })),
        };
    }
  })();

  const { data, isLoading } = useQuery({
    queryKey: endpoints.queryKey,
    queryFn: endpoints.queryFn,
    enabled: context.type === 'user' || !!organizationId || !!spaceId,
  });

  const webhooks = data?.data ?? [];

  const deleteMutation = useOptimisticListMutation<WebhookSubscription, Omit<WebhookSubscriptionDeleteData, 'url'>>({
    mutationFn: apiMutation((opts: Parameters<typeof webhookSubscriptionDelete>[0]) => webhookSubscriptionDelete(opts)),
    queryKey: endpoints.queryKey,
    operation: 'delete',
  });

  type CreateData = Omit<
    MeCreateWebhookSubscriptionData | OrganizationCreateWebhookSubscriptionData | SpaceCreateWebhookSubscriptionData,
    'url'
  >;

  const createMutation = useOptimisticListMutation<WebhookSubscription, CreateData>({
    mutationFn: async (vars) => {
      switch (context.type) {
        case 'user':
          return apiMutation((opts: Parameters<typeof meCreateWebhookSubscription>[0]) => meCreateWebhookSubscription(opts))(
            vars as Omit<MeCreateWebhookSubscriptionData, 'url'>,
          );
        case 'organization':
          return apiMutation((opts: Parameters<typeof organizationCreateWebhookSubscription>[0]) =>
            organizationCreateWebhookSubscription(opts))(vars as Omit<OrganizationCreateWebhookSubscriptionData, 'url'>);
        case 'space':
          return apiMutation((opts: Parameters<typeof spaceCreateWebhookSubscription>[0]) =>
            spaceCreateWebhookSubscription(opts))(vars as Omit<SpaceCreateWebhookSubscriptionData, 'url'>);
      }
    },
    queryKey: endpoints.queryKey,
    operation: 'create',
  });

  const columns = [
    {
      key: 'url',
      label: 'URL',
      render: (item: WebhookSubscription) => <span className="font-medium">{item.url}</span>,
    },
    {
      key: 'model',
      label: 'Model',
      render: (item: WebhookSubscription) => (
        <span className="text-muted-foreground">{item.model}</span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (item: WebhookSubscription) => (
        <span className="text-muted-foreground">
          {new Date(item.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (item: WebhookSubscription) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => deleteMutation.mutate({ path: { id: item.id } })}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const buildCreatePayload = (body: Pick<MeCreateWebhookSubscriptionData['body'], 'model' | 'url'>): CreateData => {
    switch (context.type) {
      case 'user':
        return { body };
      case 'organization':
        return { path: { id: organizationId! }, body };
      case 'space':
        return { path: { id: spaceId! }, body };
    }
  };

  const handleCreate = (data: Pick<MeCreateWebhookSubscriptionData['body'], 'model' | 'url'>) => {
    const payload = buildCreatePayload(data);
    createMutation.mutate(payload);
    setIsModalOpen(false);
  };

  if (isLoading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <MasterDetailLayout
      detail={
        <DetailPanel
          header={
            <div className="px-6 py-4 flex items-center justify-between border-b">
              <div>
                <h1 className="text-2xl font-bold">Webhooks</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure webhooks to receive real-time notifications
                </p>
              </div>
              <Button onClick={() => setIsModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Webhook
              </Button>
            </div>
          }
        >
          <div className="p-6">
            <Table
              columns={columns}
              data={webhooks}
              keyExtractor={(item) => item.id}
              emptyMessage="No webhooks configured yet"
            />
          </div>
        </DetailPanel>
      }
    />
  );
};
