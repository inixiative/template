import type {
  MeCreateTokenData,
  MeReadManyTokensResponse,
  OrganizationReadManyTokensResponse,
  SpaceReadManyTokensResponse,
} from '@template/ui/apiClient';
import { Button, Table } from '@template/ui/components';
import { DetailPanel, MasterDetailLayout } from '@template/ui/components/layout';
import { CreateTokenModal } from '@template/ui/components/settings/CreateTokenModal';
import { createOptimisticListTarget, useOptimisticMutation, useQuery } from '@template/ui/hooks';
import { tokenContextQueries } from '@template/ui/lib/tokenContextQueries';
import { useAppStore } from '@template/ui/store';
import type { AuthenticatedContext } from '@template/ui/store/types/tenant';
import { Plus, Trash2 } from 'lucide-react';
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
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const handleCreate = (data: Pick<MeCreateTokenData['body'], 'name' | 'role'>) => {
    createMutation.mutate({ body: data });
    setIsModalOpen(false);
  };

  if (isLoading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <>
      <MasterDetailLayout
        detail={
          <DetailPanel
            header={
              <div className="px-6 py-4 flex items-center justify-between border-b">
                <div>
                  <h1 className="text-2xl font-bold">API Tokens</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create and manage API tokens for programmatic access
                  </p>
                </div>
                <Button onClick={() => setIsModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Token
                </Button>
              </div>
            }
          >
            <div className="p-6">
              <Table
                columns={columns}
                data={tokens}
                keyExtractor={(item) => item.id}
                emptyMessage="No API tokens created yet"
              />
            </div>
          </DetailPanel>
        }
      />

      <CreateTokenModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={handleCreate} />
    </>
  );
};
