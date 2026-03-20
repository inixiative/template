import {
  type AdminInquiryReadManyResponses,
  adminInquiryReadMany,
  adminInquiryReadManyQueryKey,
  type InquiryReceivedItem,
  type InquirySentItem,
} from '@template/ui/apiClient';
import { Badge, Card, CardContent, CardHeader, CardTitle, Table } from '@template/ui/components';
import { InquirySourceControls, InquiryTargetControls } from '@template/ui/components/inquiries';
import { useQuery } from '@template/ui/hooks';
import { apiQuery } from '@template/ui/lib/apiQuery';
import {
  INQUIRY_STATUS_COLORS,
  INQUIRY_TYPE_LABELS,
  type InquiryFilters,
  type InquiryStatus,
  inquiryFiltersToSearchFields,
  mergeInquiryFilters,
} from '@template/ui/lib/inquiries/queryKeys';
import { getInquiryInterface } from '@template/ui/lib/inquiries/registry';
import { useMemo, useState } from 'react';

type Inquiry = AdminInquiryReadManyResponses[200]['data'][number];

type AdminInquiriesPageProps = {
  view: 'platform' | 'all';
  filters?: InquiryFilters;
};

export const AdminInquiriesPage = ({ view, filters }: AdminInquiriesPageProps) => {
  const [statusFilter, setStatusFilter] = useState<InquiryStatus | ''>('');

  const merged = mergeInquiryFilters(filters, {
    statuses: statusFilter ? [statusFilter] : undefined,
  });
  // Stable on mount — filters prop doesn't change; useMemo prevents key churn on re-renders
  const expiredCutoff = useMemo(() => (merged.includeExpired === false ? new Date() : undefined), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const searchFields = inquiryFiltersToSearchFields(merged, expiredCutoff);
  if (view === 'platform') searchFields.targetModel = { in: ['admin'] };
  const hasSearchFields = Object.keys(searchFields).length > 0;

  const { data, isLoading } = useQuery({
    // searchFields supported server-side for all fields; cast because generated type omits it
    queryKey: adminInquiryReadManyQueryKey(
      hasSearchFields ? ({ query: { searchFields } } as Parameters<typeof adminInquiryReadManyQueryKey>[0]) : undefined,
    ),
    queryFn: apiQuery((opts: Parameters<typeof adminInquiryReadMany>[0]) => adminInquiryReadMany(opts)),
  });

  const inquiries = data?.data ?? [];

  const statusDropdown = !filters?.statuses && (
    <select
      value={statusFilter}
      onChange={(e) => setStatusFilter(e.target.value as InquiryStatus | '')}
      className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <option value="">All statuses</option>
      <option value="draft">Draft</option>
      <option value="sent">Sent</option>
      <option value="changesRequested">Changes Requested</option>
      <option value="approved">Approved</option>
      <option value="denied">Denied</option>
      <option value="canceled">Canceled</option>
    </select>
  );

  if (isLoading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>{view === 'platform' ? 'Platform Inquiries' : 'All Inquiries'}</CardTitle>
          {statusDropdown}
        </CardHeader>
        <CardContent>
          {view === 'all' ? (
            <AdminAllInquiryTable inquiries={inquiries} />
          ) : (
            <Table
              columns={[
                { key: 'type', label: 'Type', render: (inq: Inquiry) => INQUIRY_TYPE_LABELS[inq.type] },
                {
                  key: 'status',
                  label: 'Status',
                  render: (inq: Inquiry) => <StatusBadge inq={inq} />,
                },
                {
                  key: 'source',
                  label: 'Source',
                  render: (inq: Inquiry) => actorLabel(inq, 'source'),
                },
                {
                  key: 'target',
                  label: 'Target',
                  render: (inq: Inquiry) => actorLabel(inq, 'target'),
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
              ]}
              data={inquiries}
              keyExtractor={(inq) => inq.id}
              emptyMessage="No platform inquiries"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const actorLabel = (inq: Inquiry, side: 'source' | 'target'): string => {
  if (side === 'source') {
    if (inq.sourceUser) return inq.sourceUser.name || inq.sourceUser.email;
    if (inq.sourceOrganization) return inq.sourceOrganization.name;
    if (inq.sourceSpace) return inq.sourceSpace.name;
    return inq.sourceModel;
  }
  if (inq.targetUser) return inq.targetUser.name || inq.targetUser.email;
  if (inq.targetOrganization) return inq.targetOrganization.name;
  if (inq.targetSpace) return inq.targetSpace.name;
  return inq.targetModel;
};

const StatusBadge = ({ inq }: { inq: Inquiry }) => {
  const isExpired = inq.expiresAt && new Date(inq.expiresAt) < new Date();
  const label = isExpired ? 'expired' : inq.status;
  const color = isExpired ? INQUIRY_STATUS_COLORS.expired : INQUIRY_STATUS_COLORS[inq.status];
  return (
    <Badge className={color}>
      <span className="capitalize">{label}</span>
    </Badge>
  );
};

const AdminAllInquiryTable = ({ inquiries }: { inquiries: Inquiry[] }) => {
  if (inquiries.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No inquiries</div>;
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted/50 border-b">
          <tr>
            {['Type', 'Status', 'Actor', 'Sent', 'Expires', ''].map((h) => (
              <th key={h} className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        {inquiries.map((inq) => {
          const entry = getInquiryInterface(inq.type);
          const SourceSummary = entry?.source?.summary;
          const TargetSummary = entry?.target?.summary;

          // Registry components expect InquirySentItem / InquiryReceivedItem; admin item is structurally compatible
          const sourceNode = SourceSummary ? (
            <SourceSummary inquiry={inq as unknown as InquirySentItem} />
          ) : (
            actorLabel(inq, 'source')
          );
          const targetNode = TargetSummary ? (
            <TargetSummary inquiry={inq as unknown as InquiryReceivedItem} />
          ) : (
            actorLabel(inq, 'target')
          );

          return (
            // group on tbody so both rows highlight together on hover
            <tbody key={inq.id} className="group border-b last:border-b-0">
              <tr className="group-hover:bg-muted/30 transition-colors">
                <td rowSpan={2} className="px-4 py-3 text-sm align-middle">
                  {INQUIRY_TYPE_LABELS[inq.type] ?? inq.type}
                </td>
                <td rowSpan={2} className="px-4 py-3 text-sm align-middle">
                  <StatusBadge inq={inq} />
                </td>
                <td className="px-4 pt-3 pb-1 text-sm">
                  <span className="text-xs text-muted-foreground mr-1">↑</span>
                  {sourceNode}
                </td>
                <td rowSpan={2} className="px-4 py-3 text-sm align-middle">
                  {inq.sentAt ? new Date(inq.sentAt).toLocaleDateString() : '—'}
                </td>
                <td rowSpan={2} className="px-4 py-3 text-sm align-middle">
                  {inq.expiresAt ? new Date(inq.expiresAt).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 pt-3 pb-1">
                  <InquirySourceControls inquiry={inq as unknown as InquirySentItem} />
                </td>
              </tr>
              <tr className="group-hover:bg-muted/30 transition-colors">
                <td className="px-4 pb-3 pt-1 text-sm">
                  <span className="text-xs text-muted-foreground mr-1">↓</span>
                  {targetNode}
                </td>
                <td className="px-4 pb-3 pt-1">
                  <InquiryTargetControls inquiry={inq as unknown as InquiryReceivedItem} />
                </td>
              </tr>
            </tbody>
          );
        })}
      </table>
    </div>
  );
};
