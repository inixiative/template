import {
  type OrganizationCreateOrganizationUserData,
  type OrganizationCreateOrganizationUserResponses,
  type OrganizationReadManyUsersResponse,
  type OrganizationUserDeleteData,
  organizationCreateOrganizationUser,
  organizationReadManyUsers,
  organizationReadManyUsersQueryKey,
  organizationUserDelete,
} from '@template/ui/apiClient';
import { apiMutation } from '@template/ui/lib/apiMutation';
import { apiQuery } from '@template/ui/lib/apiQuery';
import type { Role } from '@template/db';
import { InviteUserModal } from '@template/ui/components/InviteUserModal';
import { useOptimisticListMutation, useQuery } from '@template/ui/hooks';
import { checkPermission } from '@template/ui/hooks/usePermission';
import { useAppStore } from '@template/ui/store';
import { Button, Card, CardContent, CardHeader, CardTitle, Table } from '@template/ui/components';
import { Trash2, UserPlus } from 'lucide-react';
import { useState } from 'react';

type OrganizationUser = OrganizationReadManyUsersResponse['data'][number];

type OrganizationUsersPageProps = {
  organizationId: string;
};

export const OrganizationUsersPage = ({ organizationId }: OrganizationUsersPageProps) => {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const permissions = useAppStore((state) => state.permissions);
  const tenant = useAppStore((state) => state.tenant);
  const queryClient = useAppStore((state) => state.client);

  const { data, isLoading } = useQuery({
    queryKey: organizationReadManyUsersQueryKey({ path: { id: organizationId } }),
    queryFn: apiQuery((requestOptions: Parameters<typeof organizationReadManyUsers>[0]) =>
      organizationReadManyUsers({ ...requestOptions, path: { id: organizationId } })),
  });
  const users = data?.data ?? [];

  const deleteMutation = useOptimisticListMutation<OrganizationUser, Omit<OrganizationUserDeleteData, 'url'>>({
    mutationFn: apiMutation((requestOptions: Parameters<typeof organizationUserDelete>[0]) =>
      organizationUserDelete(requestOptions)),
    queryKey: organizationReadManyUsersQueryKey({ path: { id: organizationId } }),
    operation: 'delete',
  });

  const createMutation = useOptimisticListMutation<OrganizationUser, Omit<OrganizationCreateOrganizationUserData, 'url'>>({
    mutationFn: async (vars) => {
      const result = await apiMutation((requestOptions: Parameters<typeof organizationCreateOrganizationUser>[0]) =>
        organizationCreateOrganizationUser(requestOptions))(vars);
      // Special case: API returns { user, ...organizationUser } but we need { ...user, organizationUser }
      const { user, ...organizationUser } = result.data!;
      return { data: { ...user, organizationUser }, request: result.request, response: result.response };
    },
    queryKey: organizationReadManyUsersQueryKey({ path: { id: organizationId } }),
    operation: 'create',
  });

  const columns = [
    {
      key: 'user.name',
      label: 'Name',
      render: (orgUser: OrganizationUser) => orgUser.name || 'N/A',
    },
    {
      key: 'user.email',
      label: 'Email',
      render: (orgUser: OrganizationUser) => orgUser.email || 'N/A',
    },
    {
      key: 'role',
      label: 'Role',
      render: (orgUser: OrganizationUser) => (
        <span className="capitalize">{orgUser.organizationUser.role}</span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Joined',
      render: (orgUser: OrganizationUser) => new Date(orgUser.createdAt).toLocaleDateString(),
    },
    {
      key: 'actions',
      label: '',
      render: (orgUser: OrganizationUser) => {
        const orgUserRecord = { ...orgUser, organizationId };

        return (
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => deleteMutation.mutate({ path: { id: orgUser.id } })}
              show={checkPermission(permissions, 'organizationUser', orgUserRecord, 'manage')}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        );
      },
    },
  ];

  const handleInvite = (email: string, role: string) => {
    createMutation.mutate({
      path: { id: organizationId },
      body: { email, role: role as Role },
    });
    setIsInviteModalOpen(false);
  };

  const organization = tenant.context.organization;

  if (isLoading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <>
      <div className="p-8 space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Organization Users</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Manage users and their roles in this organization</p>
            </div>
            <Button
              onClick={() => setIsInviteModalOpen(true)}
              show={organization ? checkPermission(permissions, 'organization', organization, 'assign') : false}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Invite User
            </Button>
          </CardHeader>
          <CardContent>
            <Table
              columns={columns}
              data={users}
              keyExtractor={(user) => user.id}
              emptyMessage="No users in this organization yet"
            />
          </CardContent>
        </Card>
      </div>

      <InviteUserModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onSubmit={handleInvite}
        title="Invite User to Organization"
      />
    </>
  );
};
