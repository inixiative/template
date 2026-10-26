/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import { Icon } from '@iconify/react';
import type { HydratedRecord } from '@template/db';
import { Role } from '@template/db/generated/client/enums';
import {
  type OrganizationReadManyUsersResponse,
  type OrganizationUserDeleteData,
  organizationCreateInquiry,
  organizationReadManyUsers,
  organizationReadManyUsersQueryKey,
  organizationUserDelete,
} from '@template/sdk';
import { Button, Page, Table } from '@template/ui/components';
import { InviteUserModal } from '@template/ui/components/users/InviteUserModal';
import {
  createOptimisticListTarget,
  useOptimisticMutation,
  useQuery,
  useSectionOpen,
} from '@template/ui/hooks';
import { useCreateInquiryMutation } from '@template/ui/hooks/inquiry/useCreateInquiryMutation';
import { checkPermission } from '@template/ui/hooks/usePermission';
import { apiMutation } from '@template/ui/lib/apiMutation';
import { apiQuery } from '@template/ui/lib/apiQuery';
import { useAppStore } from '@template/ui/store';

type OrganizationUser = OrganizationReadManyUsersResponse['data'][number];

type OrganizationUsersPageProps = {
  organizationId: string;
};

export const OrganizationUsersPage = ({ organizationId }: OrganizationUsersPageProps) => {
  const [isInviteModalOpen, setIsInviteModalOpen] = useSectionOpen('invite');
  const permissions = useAppStore((state) => state.permissions);
  const tenant = useAppStore((state) => state.tenant);

  // Filter roles to only those the current actor can invite via inquiry.send permission.
  // REBAC checks content.role against highRoles to determine if own vs manage is required.
  const inviteRoles = (Object.values(Role) as Role[]).filter((role) =>
    checkPermission(
      permissions,
      'inquiry',
      {
        id: '',
        type: 'inviteOrganizationUser',
        content: { role },
        sourceOrganization: { id: organizationId } as HydratedRecord,
        sourceOrganizationId: organizationId,
        sourceSpaceId: '',
        targetOrganizationId: '',
      } as unknown as HydratedRecord,
      'send',
    ),
  );

  const { data, isLoading } = useQuery({
    queryKey: organizationReadManyUsersQueryKey({ path: { id: organizationId } }),
    queryFn: apiQuery((requestOptions: Parameters<typeof organizationReadManyUsers>[0]) =>
      organizationReadManyUsers({ ...requestOptions, path: { id: organizationId } }),
    ),
  });
  const users = data?.data ?? [];

  const deleteMutation = useOptimisticMutation({
    mutationFn: apiMutation((requestOptions: Parameters<typeof organizationUserDelete>[0]) =>
      organizationUserDelete(requestOptions),
    ),
    targets: [
      createOptimisticListTarget<OrganizationUser, Omit<OrganizationUserDeleteData, 'url'>>({
        queryKey: organizationReadManyUsersQueryKey({ path: { id: organizationId } }),
        operation: 'delete',
      }),
    ],
  });

  const inviteMutation = useCreateInquiryMutation();

  const columns = [
    {
      key: 'user.name',
      label: 'Name',
      render: (orgUser: OrganizationUser) => (
        <span className="font-medium">{orgUser.name || 'N/A'}</span>
      ),
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
        const member = orgUser.organizationUser;
        const memberRecord = {
          ...member,
          organization: { id: member.organizationId },
          user: { id: member.userId },
        } as unknown as HydratedRecord;

        return (
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Remove member"
              onClick={() => deleteMutation.mutate({ path: { id: member.id } })}
              show={checkPermission(permissions, 'organizationUser', memberRecord, 'delete')}
            >
              <Icon icon="lucide:trash-2" className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        );
      },
    },
  ];

  const handleInvite = (email: string, role: string) => {
    inviteMutation.mutate(
      {
        inquiry: {
          type: 'inviteOrganizationUser',
          sourceOrganizationId: organizationId,
          sourceSpaceId: null,
          targetOrganizationId: null,
        },
        call: () =>
          apiMutation(organizationCreateInquiry)({
            path: { id: organizationId },
            body: {
              type: 'inviteOrganizationUser',
              status: 'sent',
              content: { role },
              targetModel: 'User',
              targetEmail: email,
            },
          }),
        optimisticItem: { type: 'inviteOrganizationUser', status: 'sent', targetEmail: email },
      },
      { onSuccess: () => setIsInviteModalOpen(false) },
    );
  };

  const _organization = tenant.context.organization;

  return (
    <>
      <Page
        title="Members"
        description="Manage who belongs to this organization and the role each user has."
        actions={
          <Button onClick={() => setIsInviteModalOpen(true)} show={inviteRoles.length > 0}>
            <Icon icon="lucide:user-plus" className="h-4 w-4 mr-2" />
            Invite member
          </Button>
        }
      >
        {isLoading ? (
          <div className="h-40 animate-pulse rounded-xl bg-muted/50" />
        ) : (
          <Table
            columns={columns}
            data={users}
            keyExtractor={(user) => user.id}
            emptyMessage="No users in this organization yet"
            empty={{
              icon: 'lucide:users',
              description: 'Invite people to collaborate in this organization.',
              action:
                inviteRoles.length > 0
                  ? { label: 'Invite member', onClick: () => setIsInviteModalOpen(true) }
                  : undefined,
            }}
          />
        )}
      </Page>

      <InviteUserModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onSubmit={handleInvite}
        title="Invite User to Organization"
        roles={inviteRoles}
      />
    </>
  );
};
