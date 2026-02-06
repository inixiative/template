import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent, Button, Table } from '@template/ui';
import { InviteUserModal } from '../components/InviteUserModal';
import { checkPermission } from '#/lib';
import { useOptimisticListMutation } from '#/hooks';
import {
  organizationReadManyUsersOptions,
  organizationReadManyUsersQueryKey,
  organizationCreateOrganizationUserMutation,
  organizationUserDeleteMutation,
  type OrganizationReadManyUsersResponse,
} from '@template/shared/apiClient';
import { UserPlus, Trash2 } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useAppStore } from '#/store';

type OrganizationUser = NonNullable<OrganizationReadManyUsersResponse>['data'][number];

type OrganizationUsersPageProps = {
  organizationId: string;
};

export const OrganizationUsersPage = ({ organizationId }: OrganizationUsersPageProps) => {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const permissions = useAppStore((state) => state.permissions);
  const tenant = useAppStore((state) => state.tenant);
  const queryClient = useQueryClient();

  const { data: response, isLoading } = useQuery(
    organizationReadManyUsersOptions({ path: { id: organizationId } })
  );
  const users = response?.data || [];

  const deleteMutation = useOptimisticListMutation<OrganizationUser>({
    mutationFn: (variables) =>
      organizationUserDeleteMutation({ path: { id: variables.id } }).mutationFn({ path: { id: variables.id } }),
    queryKey: organizationReadManyUsersQueryKey({ path: { id: organizationId } }),
    operation: 'delete',
  });

  const createMutation = useMutation({
    mutationFn: (variables: { email: string; role: string }) =>
      organizationCreateOrganizationUserMutation({ path: { id: organizationId } }).mutationFn({
        path: { id: organizationId },
        body: variables,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationReadManyUsersQueryKey({ path: { id: organizationId } }) });
    },
  });

  const columns = [
    {
      key: 'user.name',
      label: 'Name',
      render: (orgUser: OrganizationUser) => orgUser.user?.name || 'N/A',
    },
    {
      key: 'user.email',
      label: 'Email',
      render: (orgUser: OrganizationUser) => orgUser.user?.email || 'N/A',
    },
    {
      key: 'role',
      label: 'Role',
      render: (orgUser: OrganizationUser) => (
        <span className="capitalize">{orgUser.role}</span>
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
              onClick={() => deleteMutation.mutate(orgUser)}
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
    createMutation.mutate({ email, role } as OrganizationUser);
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
              <p className="text-sm text-muted-foreground mt-1">
                Manage users and their roles in this organization
              </p>
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
