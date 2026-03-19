import {
  type InquiryReceivedItem,
  organizationReceivedManyInquiries,
  organizationReceivedManyInquiriesQueryKey,
} from '@template/ui/apiClient';
import { Badge, Card, CardContent, CardHeader, CardTitle, Table } from '@template/ui/components';
import { InquiryTargetControls } from '@template/ui/components/inquiries';
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

type OrganizationIncomingTransfersPageProps = {
  organizationId: string;
};

export const OrganizationIncomingTransfersPage = ({ organizationId }: OrganizationIncomingTransfersPageProps) => {
  const { data } = useQuery({
    queryKey: organizationReceivedManyInquiriesQueryKey({ path: { id: organizationId } }),
    queryFn: apiQuery((opts: Parameters<typeof organizationReceivedManyInquiries>[0]) =>
      organizationReceivedManyInquiries({ ...opts, path: { id: organizationId } }),
    ),
  });

  const transfers = (data?.data ?? [])
    .filter((inq) => inq.type === 'transferSpace')
    .map((inq) => ({ ...inq, targetOrganizationId: organizationId }));

  const columns = [
    {
      key: 'space',
      label: 'Space',
      render: (inq: InquiryReceivedItem) => inq.sourceSpace?.name ?? '—',
    },
    {
      key: 'status',
      label: 'Status',
      render: (inq: InquiryReceivedItem) => {
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
      render: (inq: InquiryReceivedItem) => (inq.sentAt ? new Date(inq.sentAt).toLocaleDateString() : '—'),
    },
    {
      key: 'actions',
      label: '',
      render: (inq: InquiryReceivedItem) => <InquiryTargetControls inquiry={inq} />,
    },
  ];

  return (
    <div className="p-8">
      <Card>
        <CardHeader>
          <CardTitle>Incoming Transfers</CardTitle>
        </CardHeader>
        <CardContent>
          <Table
            columns={columns}
            data={transfers}
            keyExtractor={(inq) => inq.id}
            emptyMessage="No incoming transfer requests"
          />
        </CardContent>
      </Card>
    </div>
  );
};
