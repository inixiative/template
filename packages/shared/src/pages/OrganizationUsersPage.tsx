import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type OrganizationReadManyUsersResponse,
  organizationCreateOrganizationUserMutation,
  organizationReadManyUsersOptions,
  organizationReadManyUsersQueryKey,
  organizationUserDeleteMutation,
} from '@template/shared/apiClient';
import { InviteUserModal } from '@template/shared/components/InviteUserModal';
import { checkPermission } from '@template/shared/hooks/usePermission';
import { useAppStore } from '@template/shared/store';
import { Button, Card, CardContent, CardHeader, CardTitle, Table } from '@template/ui';
import { Trash2, UserPlus } from 'lucide-react';
import { useState } from 'react';

type OrganizationUser = NonNullable<OrganizationReadManyUsersResponse>['data'][number];

type OrganizationUsersPageProps = {
  organizationId: string;
};

export const OrganizationUsersPage = ({ organizationId }: OrganizationUsersPageProps) => {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const permissions = useAppStore((state) => state.permissions);
  const tenant = useAppStore((state) => state.tenant);
  const queryClient = useQueryClient();

  const { data: response, isLoading } = useQuery(organizationReadManyUsersOptions({ path: { id: organizationId } }));
  const users = response?.data || [];

  const deleteMutation = useMutation({
    ...organizationUserDeleteMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationReadManyUsersQueryKey({ path: { id: organizationId } }) });
    },
  });

  const createMutation = useMutation({
    ...organizationCreateOrganizationUserMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationReadManyUsersQueryKey({ path: { id: organizationId } }) });
    },
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
        <span className="capitalize">{(orgUser as any).organizationUser?.role ?? 'member'}</span>
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
      body: { email, role: role as any },
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
