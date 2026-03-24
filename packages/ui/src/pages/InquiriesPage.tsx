import type { InquiryReceivedItem, InquirySentItem } from '@template/ui/apiClient';
import { Badge, Card, CardContent, CardHeader, CardTitle, Table } from '@template/ui/components';
import { InquirySourceControls, InquiryTargetControls } from '@template/ui/components/inquiries';
import { useQuery } from '@template/ui/hooks';
import { inquiryContextQueries } from '@template/ui/lib/inquiries/contextQueries';
import {
  INQUIRY_STATUS_COLORS,
  INQUIRY_TYPE_LABELS,
  type InquiryFilters,
  type InquiryStatus,
  inquiryFiltersToSearchFields,
  mergeInquiryFilters,
} from '@template/ui/lib/inquiries/queryKeys';
import { getInquiryInterface } from '@template/ui/lib/inquiries/registry';
import type { QuerySlot } from '@template/ui/lib/makeContextQueries';
import { useAppStore } from '@template/ui/store';
import { useMemo, useState } from 'react';

type Row = InquirySentItem | InquiryReceivedItem;

const getEntityLabel = (inq: Row, direction: 'sent' | 'received'): string => {
  if (direction === 'received') {
    const r = inq as InquiryReceivedItem;
    if (r.sourceUser) return r.sourceUser.name || r.sourceUser.email;
    if (r.sourceOrganization) return r.sourceOrganization.name;
    if (r.sourceSpace) return r.sourceSpace.name;
    return r.sourceModel;
  }
  const s = inq as InquirySentItem;
  if (s.targetUser) return s.targetUser.name || s.targetUser.email;
  if (s.targetOrganization) return s.targetOrganization.name;
  if (s.targetSpace) return s.targetSpace.name;
  return s.targetModel;
};

type InquiriesPageProps = {
  direction: 'sent' | 'received';
  /** External hard constraints — sent to the server as searchFields filters */
  filters?: InquiryFilters;
  title?: string;
  emptyMessage?: string;
};

export const InquiriesPage = ({ direction, filters, title, emptyMessage }: InquiriesPageProps) => {
  const context = useAppStore((state) => state.tenant.context);

  const [statusFilter, setStatusFilter] = useState<InquiryStatus | ''>('');
  // external includeExpired:false forces hide; otherwise user controls the checkbox
  const [hideExpired, setHideExpired] = useState(filters?.includeExpired === false);

  // Memoized so the expiresAt cutoff stays stable while hideExpired is unchanged —
  // only recomputed (producing a new query key + fresh fetch) when the toggle changes.
  const expiredCutoff = useMemo(() => (hideExpired ? new Date() : undefined), [hideExpired]);

  // hideExpired drives includeExpired in the merged filters → translates to expiresAt[gte]=now server-side
  const merged = mergeInquiryFilters(filters, {
    statuses: statusFilter ? [statusFilter] : undefined,
    includeExpired: filters?.includeExpired !== undefined ? undefined : hideExpired ? false : undefined,
  });
  const searchFields = inquiryFiltersToSearchFields(merged, expiredCutoff);
  const hasSearchFields = Object.keys(searchFields).length > 0;

  const inquiryQueries = inquiryContextQueries(context, hasSearchFields ? { query: { searchFields } } : undefined);
  const querySlot = (direction === 'sent' ? inquiryQueries.sent : inquiryQueries.received) as QuerySlot;

  const { data } = useQuery({
    queryKey: querySlot.queryKey,
    queryFn: querySlot.queryFn,
  });

  const inquiries = ((data as { data?: Row[] } | undefined)?.data ?? []) as Row[];

  // Derive page title: registry label for single-type filter, else prop title, else default
  const singleType = filters?.types?.length === 1 ? filters.types[0] : undefined;
  const registryLabel = singleType ? getInquiryInterface(singleType)?.label : undefined;
  const pageTitle = title ?? registryLabel ?? (direction === 'sent' ? 'Sent Inquiries' : 'Received Inquiries');

  const columns = [
    {
      key: 'summary',
      label: direction === 'sent' ? 'To' : 'From',
      render: (inq: Row) => {
        if (direction === 'sent') {
          const entry = getInquiryInterface(inq.type);
          const Summary = entry?.source?.summary;
          if (Summary) return <Summary inquiry={inq as InquirySentItem} />;
        } else {
          const entry = getInquiryInterface(inq.type);
          const Summary = entry?.target?.summary;
          if (Summary) return <Summary inquiry={inq as InquiryReceivedItem} />;
        }
        return getEntityLabel(inq, direction);
      },
    },
    // Type column only shown when not filtered to a single type
    ...(singleType
      ? []
      : [
          {
            key: 'type',
            label: 'Type',
            render: (inq: Row) => INQUIRY_TYPE_LABELS[inq.type] ?? inq.type,
          },
        ]),
    {
      key: 'status',
      label: 'Status',
      render: (inq: Row) => {
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
      key: 'sentAt',
      label: 'Sent',
      render: (inq: Row) => (inq.sentAt ? new Date(inq.sentAt).toLocaleDateString() : '—'),
    },
    {
      key: 'expiresAt',
      label: 'Expires',
      render: (inq: Row) => (inq.expiresAt ? new Date(inq.expiresAt).toLocaleDateString() : '—'),
    },
    {
      key: 'actions',
      label: '',
      render: (inq: Row) =>
        direction === 'sent' ? (
          <InquirySourceControls inquiry={inq as InquirySentItem} />
        ) : (
          <InquiryTargetControls inquiry={inq as InquiryReceivedItem} />
        ),
    },
  ];

  const defaultEmptyMessage = `No ${direction} inquiries`;

  return (
    <div className="p-8 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>{pageTitle}</CardTitle>
          <div className="flex items-center gap-3">
            {!filters?.statuses && (
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
            )}
            {filters?.includeExpired === undefined && (
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hideExpired}
                  onChange={(e) => setHideExpired(e.target.checked)}
                  className="h-4 w-4"
                />
                Hide expired
              </label>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table
            columns={columns}
            data={inquiries}
            keyExtractor={(inq) => inq.id}
            emptyMessage={emptyMessage ?? defaultEmptyMessage}
          />
        </CardContent>
      </Card>
    </div>
  );
};
