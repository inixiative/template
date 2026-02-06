import { useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent, Button, Table } from '@template/ui';
import { checkPermission } from '#/lib';
import { useOptimisticListMutation } from '#/hooks';
import { CreateOrganizationModal } from '../components/CreateOrganizationModal';
import { meReadManyOrganizationsOptions, meReadManyOrganizationsQueryKey, organizationsDeleteMutation, organizationsCreateMutation, type MeReadManyOrganizationsResponse } from '@template/shared/apiClient';
import { Plus, ExternalLink, Trash2 } from 'lucide-react';
import { useAppStore } from '#/store';
import { useState, useMemo } from 'react';

type Organization = NonNullable<MeReadManyOrganizationsResponse>['data'][number];

export const OrganizationsPage = () => {
  const navigate = useNavigate();
  const permissions = useAppStore((state) => state.permissions);
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { data: response, isLoading } = useQuery(meReadManyOrganizationsOptions());
  const organizations = response?.data || [];

  const deleteMutation = useOptimisticListMutation<Organization>({
    mutationFn: (variables) => organizationsDeleteMutation({ path: { id: variables.id } }).mutationFn({ path: { id: variables.id } }),
    queryKey: meReadManyOrganizationsQueryKey(),
    operation: 'delete',
  });

  const createMutation = useMutation({
    mutationFn: (variables: { name: string; slug: string }) => organizationsCreateMutation().mutationFn({ body: variables }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: meReadManyOrganizationsQueryKey() });
    },
  });

  const columns = useMemo(() => [
    {
      key: 'name',
      label: 'Organization',
    },
    {
      key: 'role',
      label: 'Your Role',
      render: (org: Organization) => (
        <span className="capitalize">{org.role}</span>
      ),
    },
    {
      key: 'spacesCount',
      label: 'Spaces',
      render: (org: Organization) => `${org.spacesCount} ${org.spacesCount === 1 ? 'space' : 'spaces'}`,
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
              onClick={() => navigate({ to: '/org/$organizationId/users', params: { organizationId: org.id } })}
              show={checkPermission(permissions, 'organization', org, 'read')}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => deleteMutation.mutate(org)}
              show={checkPermission(permissions, 'organization', org, 'own')}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        );
      },
    },
  ], [navigate, permissions, deleteMutation]);

  const handleCreate = (name: string, slug: string) => {
    createMutation.mutate({ name, slug } as Organization);
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
              <p className="text-sm text-muted-foreground mt-1">
                View organizations you belong to
              </p>
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
