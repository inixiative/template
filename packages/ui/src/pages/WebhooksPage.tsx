import type {
  MeCreateWebhookSubscriptionData,
  MeReadManyWebhookSubscriptionsResponse,
  OrganizationReadManyWebhookSubscriptionsResponse,
  SpaceReadManyWebhookSubscriptionsResponse,
  WebhookSubscriptionDeleteData,
} from '@template/ui/apiClient';
import { Button, Table } from '@template/ui/components';
import { DetailPanel, MasterDetailLayout } from '@template/ui/components/layout';
import { createOptimisticListTarget, useOptimisticMutation, useQuery } from '@template/ui/hooks';
import { webhookContextQueries } from '@template/ui/lib/webhookContextQueries';
import { useAppStore } from '@template/ui/store';
import type { AuthenticatedContext } from '@template/ui/store/types/tenant';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

type WebhookSubscription =
  | MeReadManyWebhookSubscriptionsResponse['data'][number]
  | OrganizationReadManyWebhookSubscriptionsResponse['data'][number]
  | SpaceReadManyWebhookSubscriptionsResponse['data'][number];

export const WebhooksPage = () => {
  const [_isModalOpen, setIsModalOpen] = useState(false);
  const context = useAppStore((state) => state.tenant.context) as AuthenticatedContext;
  const webhookQueries = webhookContextQueries(context);

  const { data, isLoading } = useQuery({
    queryKey: webhookQueries.readMany.queryKey,
    queryFn: webhookQueries.readMany.queryFn,
  });

  const webhooks = data?.data ?? [];

  const deleteMutation = useOptimisticMutation({
    mutationFn: webhookQueries.delete.mutationFn,
    targets: [
      createOptimisticListTarget<WebhookSubscription, Omit<WebhookSubscriptionDeleteData, 'url'>>({
        queryKey: webhookQueries.readMany.queryKey,
        operation: 'delete',
      }),
    ],
  });

  const createMutation = useOptimisticMutation({
    mutationFn: webhookQueries.create.mutationFn,
    targets: [
      createOptimisticListTarget<WebhookSubscription, Omit<MeCreateWebhookSubscriptionData, 'url'>>({
        queryKey: webhookQueries.readMany.queryKey,
        operation: 'create',
      }),
    ],
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
      render: (item: WebhookSubscription) => <span className="text-muted-foreground">{item.model}</span>,
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (item: WebhookSubscription) => (
        <span className="text-muted-foreground">{new Date(item.createdAt).toLocaleDateString()}</span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (item: WebhookSubscription) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate({ path: { id: item.id } })}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const _handleCreate = (data: Pick<MeCreateWebhookSubscriptionData['body'], 'model' | 'url'>) => {
    createMutation.mutate({ body: data });
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
