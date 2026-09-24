/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import { Icon } from '@iconify/react';
import type {
  MeCreateTokenData,
  MeReadManyTokensResponse,
  OrganizationReadManyTokensResponse,
  SpaceReadManyTokensResponse,
} from '@template/sdk';
import { Button, Page, Table } from '@template/ui/components';
import { CreateTokenModal } from '@template/ui/components/settings/CreateTokenModal';
import { createOptimisticListTarget, useOptimisticMutation, useQuery } from '@template/ui/hooks';
import { tokenContextQueries } from '@template/ui/lib/tokenContextQueries';
import { useAppStore } from '@template/ui/store';
import type { AuthenticatedContext } from '@template/ui/store/types/tenant';
import { useState } from 'react';

type Token =
  | MeReadManyTokensResponse['data'][number]
  | OrganizationReadManyTokensResponse['data'][number]
  | SpaceReadManyTokensResponse['data'][number];

export const TokensPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const context = useAppStore((state) => state.tenant.context) as AuthenticatedContext;
  const tokenQueries = tokenContextQueries(context);

  const { data, isLoading } = useQuery({
    queryKey: tokenQueries.readMany.queryKey,
    queryFn: tokenQueries.readMany.queryFn,
  });

  const tokens = data?.data ?? [];

  const deleteMutation = useOptimisticMutation({
    mutationFn: tokenQueries.delete.mutationFn,
    targets: [
      createOptimisticListTarget<Token>({
        queryKey: tokenQueries.readMany.queryKey,
        operation: 'delete',
      }),
    ],
  });

  const createMutation = useOptimisticMutation({
    mutationFn: tokenQueries.create.mutationFn,
    targets: [
      createOptimisticListTarget<Token>({
        queryKey: tokenQueries.readMany.queryKey,
        operation: 'create',
      }),
    ],
  });

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (item: Token) => <span className="font-medium">{item.name}</span>,
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (item: Token) => (
        <span className="text-muted-foreground">{new Date(item.createdAt).toLocaleDateString()}</span>
      ),
    },
    {
      key: 'lastUsedAt',
      label: 'Last Used',
      render: (item: Token) => (
        <span className="text-muted-foreground">
          {item.lastUsedAt ? new Date(item.lastUsedAt).toLocaleDateString() : 'Never'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (item: Token) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate({ path: { id: item.id } })}>
            <Icon icon="lucide:trash-2" className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const handleCreate = (data: Pick<MeCreateTokenData['body'], 'name' | 'role'>) => {
    createMutation.mutate({ body: data });
    setIsModalOpen(false);
  };

  return (
    <>
      <Page
        title="API tokens"
        description="Create and manage API tokens for programmatic access"
        actions={
          <Button onClick={() => setIsModalOpen(true)}>
            <Icon icon="lucide:plus" className="h-4 w-4 mr-2" />
            Create token
          </Button>
        }
      >
        {isLoading ? (
          <div className="h-40 animate-pulse rounded-xl bg-muted/50" />
        ) : (
          <Table
            columns={columns}
            data={tokens}
            keyExtractor={(item) => item.id}
            emptyMessage="No API tokens created yet"
            empty={{
              icon: 'lucide:key-round',
              description: 'Tokens let scripts and integrations call the API on your behalf.',
              action: { label: 'Create token', onClick: () => setIsModalOpen(true) },
            }}
          />
        )}
      </Page>

      <CreateTokenModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={handleCreate} />
    </>
  );
};
