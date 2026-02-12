import {
  meReadManyWebhookSubscriptions,
  meReadManyWebhookSubscriptionsQueryKey,
  meCreateWebhookSubscription,
  organizationReadManyWebhookSubscriptions,
  organizationReadManyWebhookSubscriptionsQueryKey,
  organizationCreateWebhookSubscription,
  webhookSubscriptionDelete,
  type MeCreateWebhookSubscriptionData,
  type OrganizationCreateWebhookSubscriptionData,
  type WebhookSubscriptionDeleteData,
} from '@template/ui/apiClient';
import { apiMutation } from '@template/ui/lib/apiMutation';
import { apiQuery } from '@template/ui/lib/apiQuery';
import { MasterDetailLayout, DetailPanel } from '@template/ui/components/layout';
import { useOptimisticListMutation, useQuery } from '@template/ui/hooks';
import { useAppStore } from '@template/ui/store';
import { Button, Table } from '@template/ui/components';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

type WebhookSubscription = {
  id: string;
  url: string;
  events: string[];
  createdAt: string;
};

export const WebhooksPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const context = useAppStore((state) => state.tenant.context);
  const contextId = context.organization?.id;

  const endpoints = {
    user: {
      queryKey: meReadManyWebhookSubscriptionsQueryKey(),
      queryFn: apiQuery((opts: Parameters<typeof meReadManyWebhookSubscriptions>[0]) =>
        meReadManyWebhookSubscriptions(opts)),
      createFn: meCreateWebhookSubscription,
    },
    organization: {
      queryKey: organizationReadManyWebhookSubscriptionsQueryKey({ path: { id: contextId! } }),
      queryFn: apiQuery((opts: Parameters<typeof organizationReadManyWebhookSubscriptions>[0]) =>
        organizationReadManyWebhookSubscriptions({ ...opts, path: { id: contextId! } })),
      createFn: organizationCreateWebhookSubscription,
    },
  }[context.type];

  const { data, isLoading } = useQuery({
    queryKey: endpoints.queryKey,
    queryFn: endpoints.queryFn,
    enabled: context.type === 'user' || !!contextId,
  });

  const webhooks = data?.data ?? [];

  const deleteMutation = useOptimisticListMutation<WebhookSubscription, Omit<WebhookSubscriptionDeleteData, 'url'>>({
    mutationFn: apiMutation((opts: Parameters<typeof webhookSubscriptionDelete>[0]) => webhookSubscriptionDelete(opts)),
    queryKey: endpoints.queryKey,
    operation: 'delete',
  });

  type CreateData = Omit<MeCreateWebhookSubscriptionData | OrganizationCreateWebhookSubscriptionData, 'url'>;

  const createMutation = useOptimisticListMutation<WebhookSubscription, CreateData>({
    mutationFn: apiMutation((opts: any) => endpoints.createFn(opts)),
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
      key: 'events',
      label: 'Events',
      render: (item: WebhookSubscription) => (
        <span className="text-muted-foreground">{item.events.join(', ')}</span>
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

  const handleCreate = (data: { url: string; events: string[] }) => {
    const payload = context.type === 'user'
      ? { body: data }
      : { path: { id: contextId! }, body: data };
    createMutation.mutate(payload as any);
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
