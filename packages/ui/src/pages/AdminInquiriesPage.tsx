import {
  adminInquiryReadMany,
  adminInquiryReadManyQueryKey,
  type AdminInquiryReadManyResponses,
} from '@template/ui/apiClient';
import { Badge, Card, CardContent, CardHeader, CardTitle, Table } from '@template/ui/components';
import { useQuery } from '@template/ui/hooks';
import { apiQuery } from '@template/ui/lib/apiQuery';
import { INQUIRY_STATUS_COLORS, INQUIRY_TYPE_LABELS } from '@template/ui/lib/inquiryQueryKeys';

type Inquiry = AdminInquiryReadManyResponses[200]['data'][number];

type AdminInquiriesPageProps = {
  view: 'platform' | 'all';
};

export const AdminInquiriesPage = ({ view }: AdminInquiriesPageProps) => {
  const { data, isLoading } = useQuery({
    queryKey: adminInquiryReadManyQueryKey(),
    queryFn: apiQuery((opts: Parameters<typeof adminInquiryReadMany>[0]) => adminInquiryReadMany(opts)),
  });

  const allInquiries = data?.data ?? [];
  const inquiries = view === 'platform' ? allInquiries.filter((inq) => inq.targetModel === 'admin') : allInquiries;

  const columns = [
    {
      key: 'type',
      label: 'Type',
      render: (inq: Inquiry) => INQUIRY_TYPE_LABELS[inq.type],
    },
    {
      key: 'status',
      label: 'Status',
      render: (inq: Inquiry) => {
        const isExpired = inq.expiresAt && new Date(inq.expiresAt) < new Date();
        const label = isExpired ? 'expired' : inq.status;
        const color = isExpired ? INQUIRY_STATUS_COLORS.expired : INQUIRY_STATUS_COLORS[inq.status];
        return (
          <Badge className={color}>
            <span className="capitalize">{label}</span>
          </Badge>
        );
      },
    },
    {
      key: 'source',
      label: 'Source',
      render: (inq: Inquiry) => {
        if (inq.sourceUser) return inq.sourceUser.name || inq.sourceUser.email;
        if (inq.sourceOrganization) return inq.sourceOrganization.name;
        if (inq.sourceSpace) return inq.sourceSpace.name;
        return inq.sourceModel;
      },
    },
    {
      key: 'target',
      label: 'Target',
      render: (inq: Inquiry) => {
        if (inq.targetUser) return inq.targetUser.name || inq.targetUser.email;
        if (inq.targetOrganization) return inq.targetOrganization.name;
        if (inq.targetSpace) return inq.targetSpace.name;
        return inq.targetModel;
      },
    },
    {
      key: 'sentAt',
      label: 'Sent',
      render: (inq: Inquiry) => (inq.sentAt ? new Date(inq.sentAt).toLocaleDateString() : '—'),
    },
    {
      key: 'expiresAt',
      label: 'Expires',
      render: (inq: Inquiry) => (inq.expiresAt ? new Date(inq.expiresAt).toLocaleDateString() : '—'),
    },
  ];

  if (isLoading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{view === 'platform' ? 'Platform Inquiries' : 'All Inquiries'}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table
            columns={columns}
            data={inquiries}
            keyExtractor={(inq) => inq.id}
            emptyMessage={view === 'platform' ? 'No platform inquiries' : 'No inquiries'}
          />
        </CardContent>
      </Card>
    </div>
  );
};
