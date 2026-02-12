import {
  meReadManyTokens,
  meReadManyTokensQueryKey,
  meCreateToken,
  organizationReadManyTokens,
  organizationReadManyTokensQueryKey,
  organizationCreateToken,
  spaceReadManyTokens,
  spaceReadManyTokensQueryKey,
  spaceCreateToken,
  tokenDelete,
  type MeCreateTokenData,
  type OrganizationCreateTokenData,
  type SpaceCreateTokenData,
  type TokenDeleteData,
} from '@template/ui/apiClient';
import { apiMutation } from '@template/ui/lib/apiMutation';
import { apiQuery } from '@template/ui/lib/apiQuery';
import { CreateTokenModal } from '@template/ui/components/CreateTokenModal';
import { MasterDetailLayout, DetailPanel } from '@template/ui/components/layout';
import { useOptimisticListMutation, useQuery } from '@template/ui/hooks';
import { useAppStore } from '@template/ui/store';
import { Button, Table } from '@template/ui/components';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

type Token = {
  id: string;
  name: string;
  lastUsed: string | null;
  createdAt: string;
};

export const TokensPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const context = useAppStore((state) => state.tenant.context);
  const contextId = context.space?.id || context.organization?.id;

  // Select endpoints based on context type
  const endpoints = {
    user: {
      queryKey: meReadManyTokensQueryKey(),
      queryFn: apiQuery((opts: Parameters<typeof meReadManyTokens>[0]) => meReadManyTokens(opts)),
      createFn: meCreateToken,
    },
    organization: {
      queryKey: organizationReadManyTokensQueryKey({ path: { id: contextId! } }),
      queryFn: apiQuery((opts: Parameters<typeof organizationReadManyTokens>[0]) =>
        organizationReadManyTokens({ ...opts, path: { id: contextId! } })),
      createFn: organizationCreateToken,
    },
    space: {
      queryKey: spaceReadManyTokensQueryKey({ path: { id: contextId! } }),
      queryFn: apiQuery((opts: Parameters<typeof spaceReadManyTokens>[0]) =>
        spaceReadManyTokens({ ...opts, path: { id: contextId! } })),
      createFn: spaceCreateToken,
    },
  }[context.type];

  const { data, isLoading } = useQuery({
    queryKey: endpoints.queryKey,
    queryFn: endpoints.queryFn,
    enabled: context.type === 'user' || !!contextId,
  });

  const tokens = data?.data ?? [];

  const deleteMutation = useOptimisticListMutation<Token, Omit<TokenDeleteData, 'url'>>({
    mutationFn: apiMutation((opts: Parameters<typeof tokenDelete>[0]) => tokenDelete(opts)),
    queryKey: endpoints.queryKey,
    operation: 'delete',
  });

  type CreateData = Omit<MeCreateTokenData | OrganizationCreateTokenData | SpaceCreateTokenData, 'url'>;

  const createMutation = useOptimisticListMutation<Token, CreateData>({
    mutationFn: apiMutation((opts: any) => endpoints.createFn(opts)),
    queryKey: endpoints.queryKey,
    operation: 'create',
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
        <span className="text-muted-foreground">
          {new Date(item.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'lastUsed',
      label: 'Last Used',
      render: (item: Token) => (
        <span className="text-muted-foreground">
          {item.lastUsed ? new Date(item.lastUsed).toLocaleDateString() : 'Never'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (item: Token) => (
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

  const handleCreate = (data: { name: string }) => {
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

      <CreateTokenModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreate}
      />
    </>
  );
};
