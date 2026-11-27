/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses primitive:sdk
 */

import { Icon } from '@iconify/react';
import { useQuery } from '@tanstack/react-query';
import type { HydratedRecord } from '@template/db';
import { Role } from '@template/db/generated/client/enums';
import { memberRemoval } from '@template/permissions/rebac/rebacSchemaRules';
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
  useSectionOpen,
} from '@template/ui/hooks';
import { useCreateInquiryMutation } from '@template/ui/hooks/inquiry/useCreateInquiryMutation';
import { apiMutation } from '@template/ui/lib/apiMutation';
import { apiQuery } from '@template/ui/lib/apiQuery';
import { canActOnRecordIfPresent } from '@template/ui/lib/canActOnRecordIfPresent';
import { inquiryRecordForPermissionCheck } from '@template/ui/lib/inquiries/inquiryRecordForPermissionCheck';
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
  const inviteRoles = (Object.values(Role) as Role[]).filter((role) =>
    canActOnRecordIfPresent(
      permissions,
      'inquiry',
      inquiryRecordForPermissionCheck(
        {
          type: 'inviteOrganizationUser',
          sourceModel: 'Organization',
          targetModel: 'User',
          content: { role },
        },
        'source',
        { organization: { id: organizationId } },
      ),
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
              show={canActOnRecordIfPresent(
                permissions,
                'organizationUser',
                memberRecord,
                memberRemoval('organization'),
              )}
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
          isLoading={isLoading}
        />
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
