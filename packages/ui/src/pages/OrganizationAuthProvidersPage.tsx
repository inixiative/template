import {
  type OrganizationCreateAuthProviderData,
  type OrganizationReadAuthProviderResponse,
  organizationCreateAuthProvider,
  organizationReadAuthProvider,
  organizationReadAuthProviderQueryKey,
  type AuthProviderDeleteData,
  type AuthProviderUpdateData,
  authProviderDelete,
  authProviderUpdate,
} from '@template/ui/apiClient';
import { apiMutation } from '@template/ui/lib/apiMutation';
import { apiQuery } from '@template/ui/lib/apiQuery';
import { AuthProviderModal } from '@template/ui/components/AuthProviderModal';
import { MasterDetailLayout, DetailPanel } from '@template/ui/components/layout';
import { useOptimisticListMutation, useQuery } from '@template/ui/hooks';
import { useAppStore } from '@template/ui/store';
import { Button, Table, Badge } from '@template/ui/components';
import { Trash2, Plus, Pencil } from 'lucide-react';
import { useState } from 'react';

type AuthProvider = OrganizationReadAuthProviderResponse['organization'][number];

export const OrganizationAuthProvidersPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<AuthProvider | null>(null);
  const organizationId = useAppStore((state) => state.tenant.context.organization?.id);

  const { data, isLoading } = useQuery({
    queryKey: organizationReadAuthProviderQueryKey({ path: { id: organizationId! } }),
    queryFn: apiQuery((requestOptions: Parameters<typeof organizationReadAuthProvider>[0]) =>
      organizationReadAuthProvider({ ...requestOptions, path: { id: organizationId! } })),
    enabled: !!organizationId,
  });

  const providers = data?.organization ?? [];

  const deleteMutation = useOptimisticListMutation<AuthProvider, Omit<AuthProviderDeleteData, 'url'>>({
    mutationFn: apiMutation((requestOptions: Parameters<typeof authProviderDelete>[0]) =>
      authProviderDelete(requestOptions)),
    queryKey: organizationReadAuthProviderQueryKey({ path: { id: organizationId! } }),
    operation: 'delete',
  });

  const createMutation = useOptimisticListMutation<AuthProvider, Omit<OrganizationCreateAuthProviderData, 'url'>>({
    mutationFn: apiMutation((requestOptions: Parameters<typeof organizationCreateAuthProvider>[0]) =>
      organizationCreateAuthProvider(requestOptions)),
    queryKey: organizationReadAuthProviderQueryKey({ path: { id: organizationId! } }),
    operation: 'create',
  });

  const updateMutation = useOptimisticListMutation<AuthProvider, Omit<AuthProviderUpdateData, 'url'>>({
    mutationFn: apiMutation((requestOptions: Parameters<typeof authProviderUpdate>[0]) =>
      authProviderUpdate(requestOptions)),
    queryKey: organizationReadAuthProviderQueryKey({ path: { id: organizationId! } }),
    operation: 'update',
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
      render: (item: AuthProvider) => (
        <span className="text-muted-foreground">{getTypeLabel(item.type)}</span>
      ),
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
        <Badge variant={item.enabled ? 'success' : 'secondary'}>
          {item.enabled ? 'Enabled' : 'Disabled'}
        </Badge>
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
            <Pencil className="h-4 w-4" />
          </Button>
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
                  <h1 className="text-2xl font-bold">Authentication Providers</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Configure custom SSO and OAuth providers for your organization
                  </p>
                </div>
                <Button onClick={() => setIsModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Provider
                </Button>
              </div>
            }
          >
            <div className="p-6">
              <Table
                columns={columns}
                data={providers}
                keyExtractor={(item) => item.id}
                emptyMessage="No custom auth providers configured. Platform email/password authentication is enabled by default."
              />
            </div>
          </DetailPanel>
        }
      />

      <AuthProviderModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingProvider(null);
        }}
        onSubmit={editingProvider ? handleEdit : handleAdd}
        provider={editingProvider || undefined}
      />
    </>
  );
};
