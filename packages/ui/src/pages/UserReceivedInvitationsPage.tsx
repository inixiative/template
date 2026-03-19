import { type InquiryReceivedItem, meReceivedManyInquiries, meReceivedManyInquiriesQueryKey } from '@template/ui/apiClient';
import { Card, CardContent, CardHeader, CardTitle, Table } from '@template/ui/components';
import { InquiryTargetControls } from '@template/ui/components/inquiries';
import { useQuery } from '@template/ui/hooks';
import { apiQuery } from '@template/ui/lib/apiQuery';

export const UserReceivedInvitationsPage = () => {
  const { data } = useQuery({
    queryKey: meReceivedManyInquiriesQueryKey(),
    queryFn: apiQuery((opts: Parameters<typeof meReceivedManyInquiries>[0]) => meReceivedManyInquiries(opts)),
  });

  const invitations = (data?.data ?? []).filter((inq) => inq.type === 'inviteOrganizationUser');

  const columns = [
    {
      key: 'organization',
      label: 'Organization',
      render: (inq: InquiryReceivedItem) => inq.sourceOrganization?.name ?? '—',
    },
    {
      key: 'role',
      label: 'Role',
      render: (inq: InquiryReceivedItem) => {
        const content = inq.content as { email?: string; role?: string } | null | undefined;
        return <span className="capitalize">{content?.role ?? '—'}</span>;
      },
    },
    {
      key: 'sentAt',
      label: 'Sent',
      render: (inq: InquiryReceivedItem) => (inq.sentAt ? new Date(inq.sentAt).toLocaleDateString() : '—'),
    },
    {
      key: 'actions',
      label: '',
      render: (inq: InquiryReceivedItem) => <InquiryTargetControls inquiry={inq} />,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization Invitations</CardTitle>
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
