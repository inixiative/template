import {
  type InquirySentItem,
  organizationSentManyInquiries,
  organizationSentManyInquiriesQueryKey,
} from '@template/ui/apiClient';
import { Badge, Card, CardContent, CardHeader, CardTitle, Table } from '@template/ui/components';
import { InquirySourceControls } from '@template/ui/components/inquiries';
import { useQuery } from '@template/ui/hooks';
import { apiQuery } from '@template/ui/lib/apiQuery';
import type { InquiryStatus } from '@template/ui/lib/inquiryQueryKeys';

const STATUS_COLORS: Record<InquiryStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  changesRequested: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  denied: 'bg-red-100 text-red-700',
  canceled: 'bg-gray-100 text-gray-700',
};

type OrganizationSentInvitationsPageProps = {
  organizationId: string;
};

export const OrganizationSentInvitationsPage = ({ organizationId }: OrganizationSentInvitationsPageProps) => {
  const { data } = useQuery({
    queryKey: organizationSentManyInquiriesQueryKey({ path: { id: organizationId } }),
    queryFn: apiQuery((opts: Parameters<typeof organizationSentManyInquiries>[0]) =>
      organizationSentManyInquiries({ ...opts, path: { id: organizationId } }),
    ),
  });

  const invitations = (data?.data ?? []).filter((inq) => inq.type === 'inviteOrganizationUser');

  const columns = [
    {
      key: 'email',
      label: 'Email',
      render: (inq: InquirySentItem) => {
        const content = inq.content as { email?: string; role?: string } | null | undefined;
        return inq.targetUser?.email ?? content?.email ?? '—';
      },
    },
    {
      key: 'role',
      label: 'Role',
      render: (inq: InquirySentItem) => {
        const content = inq.content as { email?: string; role?: string } | null | undefined;
        return <span className="capitalize">{content?.role ?? '—'}</span>;
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (inq: InquirySentItem) => {
        const isExpired = inq.expiresAt && new Date(inq.expiresAt) < new Date();
        const label = isExpired ? 'expired' : inq.status;
        const color = isExpired ? STATUS_COLORS.canceled : STATUS_COLORS[inq.status];
        return (
          <Badge className={color}>
            <span className="capitalize">{label}</span>
          </Badge>
        );
      },
    },
    {
      key: 'sentAt',
      label: 'Sent',
      render: (inq: InquirySentItem) => (inq.sentAt ? new Date(inq.sentAt).toLocaleDateString() : '—'),
    },
    {
      key: 'actions',
      label: '',
      render: (inq: InquirySentItem) => <InquirySourceControls inquiry={inq} />,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending Invitations</CardTitle>
      </CardHeader>
      <CardContent>
        <Table
          columns={columns}
          data={invitations}
          keyExtractor={(inq) => inq.id}
          emptyMessage="No pending invitations"
        />
      </CardContent>
    </Card>
  );
};
