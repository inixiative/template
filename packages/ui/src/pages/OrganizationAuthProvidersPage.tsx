/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import { Icon } from '@iconify/react';
import {
  type AuthProviderDeleteData,
  type AuthProviderUpdateData,
  authProviderDelete,
  authProviderUpdate,
  type OrganizationCreateAuthProviderData,
  type OrganizationReadAuthProviderResponses,
  organizationCreateAuthProvider,
  organizationReadAuthProvider,
  organizationReadAuthProviderQueryKey,
} from '@template/sdk';
import { Badge, Button, Page, Table } from '@template/ui/components';
import { AuthProviderModal } from '@template/ui/components/settings/AuthProviderModal';
import { createOptimisticListTarget, useOptimisticMutation, useQuery } from '@template/ui/hooks';
import { apiMutation } from '@template/ui/lib/apiMutation';
import { apiQuery } from '@template/ui/lib/apiQuery';
import { useAppStore } from '@template/ui/store';
import { useState } from 'react';

type AuthProvider = OrganizationReadAuthProviderResponses[200]['data']['organization'][number];

export const OrganizationAuthProvidersPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<AuthProvider | null>(null);
  const organizationId = useAppStore((state) => state.tenant.context.organization?.id);

  const { data, isLoading } = useQuery({
    queryKey: organizationReadAuthProviderQueryKey({ path: { id: organizationId! } }),
    queryFn: apiQuery((requestOptions: Parameters<typeof organizationReadAuthProvider>[0]) =>
      organizationReadAuthProvider({ ...requestOptions, path: { id: organizationId! } }),
    ),
    enabled: !!organizationId,
  });

  const providers = data?.data?.organization ?? [];

  const deleteMutation = useOptimisticMutation({
    mutationFn: apiMutation((requestOptions: Parameters<typeof authProviderDelete>[0]) =>
      authProviderDelete(requestOptions),
    ),
    targets: [
      createOptimisticListTarget<AuthProvider, Omit<AuthProviderDeleteData, 'url'>>({
        queryKey: organizationReadAuthProviderQueryKey({ path: { id: organizationId! } }),
        operation: 'delete',
      }),
    ],
  });

  const createMutation = useOptimisticMutation({
    mutationFn: apiMutation((requestOptions: Parameters<typeof organizationCreateAuthProvider>[0]) =>
      organizationCreateAuthProvider(requestOptions),
    ),
    targets: [
      createOptimisticListTarget<AuthProvider, Omit<OrganizationCreateAuthProviderData, 'url'>>({
        queryKey: organizationReadAuthProviderQueryKey({ path: { id: organizationId! } }),
        operation: 'create',
      }),
    ],
  });

  const updateMutation = useOptimisticMutation({
    mutationFn: apiMutation((requestOptions: Parameters<typeof authProviderUpdate>[0]) =>
      authProviderUpdate(requestOptions),
    ),
    targets: [
      createOptimisticListTarget<AuthProvider, Omit<AuthProviderUpdateData, 'url'>>({
        queryKey: organizationReadAuthProviderQueryKey({ path: { id: organizationId! } }),
        operation: 'update',
      }),
    ],
  });

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'EMAIL':
        return 'Email/Password';
      case 'OAUTH':
        return 'OAuth';
      case 'SAML':
        return 'SAML/SSO';
      default:
        return type;
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (item: AuthProvider) => <span className="font-medium">{item.name}</span>,
    },
    {
      key: 'type',
      label: 'Type',
      render: (item: AuthProvider) => <span className="text-muted-foreground">{getTypeLabel(item.type)}</span>,
    },
    {
      key: 'provider',
      label: 'Provider',
      render: (item: AuthProvider) => <span className="capitalize">{item.provider}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (item: AuthProvider) => (
        <Badge variant={item.enabled ? 'default' : 'secondary'}>{item.enabled ? 'Enabled' : 'Disabled'}</Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (item: AuthProvider) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditingProvider(item);
              setIsModalOpen(true);
            }}
          >
            <Icon icon="lucide:pencil" className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate({ path: { id: item.id } })}>
            <Icon icon="lucide:trash-2" className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const handleAdd = (data: OrganizationCreateAuthProviderData['body']) => {
    createMutation.mutate({
      path: { id: organizationId! },
      body: data,
    });
    setIsModalOpen(false);
  };

  const handleEdit = (data: AuthProviderUpdateData['body']) => {
    if (!editingProvider) return;
    updateMutation.mutate({
      path: { id: editingProvider.id },
      body: data,
    });
    setIsModalOpen(false);
    setEditingProvider(null);
  };

  return (
    <>
      <Page
        title="Authentication providers"
        description="Configure custom SSO and OAuth providers for your organization"
        actions={
          <Button onClick={() => setIsModalOpen(true)}>
            <Icon icon="lucide:plus" className="h-4 w-4 mr-2" />
            Add provider
          </Button>
        }
      >
        {isLoading ? (
          <div className="h-40 animate-pulse rounded-xl bg-muted/50" />
        ) : (
          <Table
            columns={columns}
            data={providers}
            keyExtractor={(item) => item.id}
            emptyMessage="No custom auth providers configured"
            empty={{
              icon: 'lucide:shield-check',
              description:
                'Platform email/password authentication is enabled by default. Add SSO or OAuth for your members.',
              action: { label: 'Add provider', onClick: () => setIsModalOpen(true) },
            }}
          />
        )}
      </Page>

      <AuthProviderModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingProvider(null);
        }}
        onSubmit={editingProvider ? handleEdit : handleAdd}
        provider={
          editingProvider
            ? {
                id: editingProvider.id,
                type: editingProvider.type,
                provider: editingProvider.provider,
                name: editingProvider.name,
              }
            : undefined
        }
      />
    </>
  );
};
