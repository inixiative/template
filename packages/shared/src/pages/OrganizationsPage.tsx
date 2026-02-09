import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type MeReadManyOrganizationsResponse,
  meReadManyOrganizationsOptions,
  meReadManyOrganizationsQueryKey,
  organizationCreateMutation,
  organizationDeleteMutation,
} from '@template/shared/apiClient';
import { CreateOrganizationModal } from '@template/shared/components/CreateOrganizationModal';
import { checkPermission } from '@template/shared/hooks/usePermission';
import { useAppStore } from '@template/shared/store';
import { Button, Card, CardContent, CardHeader, CardTitle, Table } from '@template/ui';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

type Organization = NonNullable<MeReadManyOrganizationsResponse>['data'][number];

export const OrganizationsPage = () => {
  const permissions = useAppStore((state) => state.permissions);
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { data: response, isLoading } = useQuery(meReadManyOrganizationsOptions());
  const organizations = response?.data || [];

  const deleteMutation = useMutation({
    ...organizationDeleteMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: meReadManyOrganizationsQueryKey() });
    },
  });

  const createMutation = useMutation({
    ...organizationCreateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: meReadManyOrganizationsQueryKey() });
    },
  });

  const columns = useMemo(
    () => [
      {
        key: 'name',
        label: 'Organization',
      },
      {
        key: 'role',
        label: 'Your Role',
        render: (org: Organization) => <span className="capitalize">{org.organizationUser.role}</span>,
      },
      {
        key: 'spacesCount',
        label: 'Spaces',
        render: () => '—',
      },
      {
        key: 'createdAt',
        label: 'Joined',
        render: (org: Organization) => new Date(org.createdAt).toLocaleDateString(),
      },
      {
        key: 'actions',
        label: '',
        render: (org: Organization) => {
          return (
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.location.assign(`/org/${org.id}/users`)}
                show={checkPermission(permissions, 'organization', org, 'read')}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteMutation.mutate({ path: { id: org.id } })}
                show={checkPermission(permissions, 'organization', org, 'own')}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          );
        },
      },
    ],
    [permissions, deleteMutation],
  );

  const handleCreate = (name: string, slug: string) => {
    createMutation.mutate({ body: { name, slug } });
    setIsCreateModalOpen(false);
  };

  if (isLoading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <>
      <div className="p-8 space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Your Organizations</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">View organizations you belong to</p>
            </div>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Organization
            </Button>
          </CardHeader>
          <CardContent>
            <Table
              columns={columns}
              data={organizations}
              keyExtractor={(org) => org.id}
              emptyMessage="You don't belong to any organizations yet"
            />
          </CardContent>
        </Card>
      </div>

      <CreateOrganizationModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreate}
      />
    </>
  );
};
