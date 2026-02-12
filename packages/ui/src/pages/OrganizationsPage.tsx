import {
  type MeReadManyOrganizationsResponse,
  meReadManyOrganizations,
  meReadManyOrganizationsQueryKey,
  type OrganizationCreateData,
  type OrganizationDeleteData,
  organizationCreate,
  organizationDelete,
} from '@template/ui/apiClient';
import { apiMutation } from '@template/ui/lib/apiMutation';
import { apiQuery } from '@template/ui/lib/apiQuery';
import { CreateOrganizationModal } from '@template/ui/components/CreateOrganizationModal';
import { useOptimisticListMutation, useQuery } from '@template/ui/hooks';
import { checkPermission } from '@template/ui/hooks/usePermission';
import { useAppStore } from '@template/ui/store';
import { Button, Card, CardContent, CardHeader, CardTitle, Table } from '@template/ui/components';
import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

type Organization = NonNullable<MeReadManyOrganizationsResponse>['data'][number];

export const OrganizationsPage = () => {
  const permissions = useAppStore((state) => state.permissions);
  const queryClient = useAppStore((state) => state.client);
  const navigatePreservingSpoof = useAppStore((state) => state.navigation.navigatePreservingSpoof);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: meReadManyOrganizationsQueryKey(),
    queryFn: apiQuery((requestOptions: Parameters<typeof meReadManyOrganizations>[0]) => meReadManyOrganizations(requestOptions)),
  });
  const organizations = data?.data ?? [];

  const deleteMutation = useOptimisticListMutation<Organization, Omit<OrganizationDeleteData, 'url'>>({
    mutationFn: apiMutation((requestOptions: Parameters<typeof organizationDelete>[0]) => organizationDelete(requestOptions)),
    queryKey: meReadManyOrganizationsQueryKey(),
    operation: 'delete',
  });

  const createMutation = useOptimisticListMutation<Organization, Omit<OrganizationCreateData, 'url'>>({
    mutationFn: apiMutation((requestOptions: Parameters<typeof organizationCreate>[0]) => organizationCreate(requestOptions)),
    queryKey: meReadManyOrganizationsQueryKey(),
    operation: 'create',
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
                onClick={(e) => {
                  e.stopPropagation();
                  deleteMutation.mutate({ path: { id: org.id } });
                }}
                show={checkPermission(permissions, 'organization', org, 'own')}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          );
        },
      },
    ],
    [permissions],
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
              onRowClick={(org) => navigatePreservingSpoof(`/dashboard?org=${org.id}`)}
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
