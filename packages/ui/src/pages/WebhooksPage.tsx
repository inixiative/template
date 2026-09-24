/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import { Icon } from '@iconify/react';
import type {
  MeCreateWebhookSubscriptionData,
  MeReadManyWebhookSubscriptionsResponse,
  OrganizationReadManyWebhookSubscriptionsResponse,
  SpaceReadManyWebhookSubscriptionsResponse,
} from '@template/sdk';
import { Button, Page, Table } from '@template/ui/components';
import { CreateWebhookModal } from '@template/ui/components/settings/CreateWebhookModal';
import { createOptimisticListTarget, useOptimisticMutation, useQuery } from '@template/ui/hooks';
import { webhookContextQueries } from '@template/ui/lib/webhookContextQueries';
import { useAppStore } from '@template/ui/store';
import type { AuthenticatedContext } from '@template/ui/store/types/tenant';
import { useState } from 'react';

type WebhookSubscription =
  | MeReadManyWebhookSubscriptionsResponse['data'][number]
  | OrganizationReadManyWebhookSubscriptionsResponse['data'][number]
  | SpaceReadManyWebhookSubscriptionsResponse['data'][number];

export const WebhooksPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
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
      createOptimisticListTarget<WebhookSubscription>({
        queryKey: webhookQueries.readMany.queryKey,
        operation: 'delete',
      }),
    ],
  });

  const createMutation = useOptimisticMutation({
    mutationFn: webhookQueries.create.mutationFn,
    targets: [
      createOptimisticListTarget<WebhookSubscription>({
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
            <Icon icon="lucide:trash-2" className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const handleCreate = (data: Pick<MeCreateWebhookSubscriptionData['body'], 'model' | 'url'>) => {
    createMutation.mutate({ body: data });
    setIsModalOpen(false);
  };

  return (
    <Page
      title="Webhooks"
      description="Configure webhooks to receive real-time notifications"
      actions={
        <Button onClick={() => setIsModalOpen(true)}>
          <Icon icon="lucide:plus" className="h-4 w-4 mr-2" />
          Create webhook
        </Button>
      }
    >
      {isLoading ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted/50" />
      ) : (
        <Table
          columns={columns}
          data={webhooks}
          keyExtractor={(item) => item.id}
          emptyMessage="No webhooks configured yet"
          empty={{
            icon: 'lucide:webhook',
            description: 'Webhooks send an HTTP request to your URL whenever a subscribed model changes.',
            action: { label: 'Create webhook', onClick: () => setIsModalOpen(true) },
          }}
        />
      )}
      <CreateWebhookModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={handleCreate} />
    </Page>
  );
};
