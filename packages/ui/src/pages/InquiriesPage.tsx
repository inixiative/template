/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import { useQuery } from '@tanstack/react-query';
import type { InquiryItem } from '@template/sdk';
import { Badge, Page, SkeletonText, Table } from '@template/ui/components';
import {
  InquirySourceControls,
  InquirySourceControlsSkeleton,
  InquiryStatusBadge,
  InquiryTargetControls,
  InquiryTargetControlsSkeleton,
} from '@template/ui/components/inquiries';
import {
  receivedInquiryContextQueries,
  sentInquiryContextQueries,
} from '@template/ui/lib/inquiries/contextQueries';
import { inquiryPartyDisplayName } from '@template/ui/lib/inquiries/inquiryPartyDisplayName';
import {
  INQUIRY_TYPE_LABELS,
  type InquiryFilters,
  type InquiryStatus,
  inquiryFiltersToSearchFields,
  narrowInquiryFiltersWithinPageBounds,
} from '@template/ui/lib/inquiries/queryKeys';
import { inquiryTypeComponentsFor } from '@template/ui/lib/inquiries/registry';
import { useAppStore } from '@template/ui/store';
import { useMemo, useState } from 'react';

type Row = InquiryItem;

type InquiriesPageProps = {
  direction: 'sent' | 'received';
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
  const merged = narrowInquiryFiltersWithinPageBounds(filters, {
    statuses: statusFilter ? [statusFilter] : undefined,
    includeExpired:
      filters?.includeExpired !== undefined ? undefined : hideExpired ? false : undefined,
  });
  const searchFields = inquiryFiltersToSearchFields(merged, expiredCutoff);
  const hasSearchFields = Object.keys(searchFields).length > 0;
  const queryParams = hasSearchFields ? { query: { searchFields } } : undefined;

  const sentSlot = sentInquiryContextQueries(context, queryParams);
  const receivedSlot = receivedInquiryContextQueries(context, queryParams);

  const sentQuery = useQuery({ ...sentSlot, enabled: direction === 'sent' });
  const receivedQuery = useQuery({ ...receivedSlot, enabled: direction === 'received' });

  const activeQuery = direction === 'sent' ? sentQuery : receivedQuery;
  const data = activeQuery.data;
  const inquiries = (data?.data ?? []) as Row[];

  // Derive page title: registry label for single-type filter, else prop title, else default
  const singleType = filters?.types?.length === 1 ? filters.types[0] : undefined;
  const registryLabel = singleType ? inquiryTypeComponentsFor(singleType)?.label : undefined;
  const pageTitle =
    title ?? registryLabel ?? (direction === 'sent' ? 'Sent inquiries' : 'Received inquiries');

  const columns = [
    {
      key: 'summary',
      label: direction === 'sent' ? 'To' : 'From',
      render: (inq: Row) => {
        if (direction === 'sent') {
          const entry = inquiryTypeComponentsFor(inq.type);
          const Summary = entry?.source?.summary;
          if (Summary) return <Summary inquiry={inq as InquiryItem} />;
        } else {
          const entry = inquiryTypeComponentsFor(inq.type);
          const Summary = entry?.target?.summary;
          if (Summary) return <Summary inquiry={inq as InquiryItem} />;
        }
        return inquiryPartyDisplayName(inq, direction === 'sent' ? 'target' : 'source');
      },
      skeleton: <SkeletonText width="12rem" />,
    },
    // Type column only shown when not filtered to a single type
    ...(singleType
      ? []
      : [
          {
            key: 'type',
            label: 'Type',
            render: (inq: Row) => INQUIRY_TYPE_LABELS[inq.type] ?? inq.type,
            skeleton: <SkeletonText width="10rem" />,
          },
        ]),
    {
      key: 'status',
      label: 'Status',
      render: (inq: Row) => <InquiryStatusBadge inquiry={inq} />,
      skeleton: <Badge>pending</Badge>,
    },
    {
      key: 'sentAt',
      label: 'Sent',
      render: (inq: Row) => (inq.sentAt ? new Date(inq.sentAt).toLocaleDateString() : '—'),
      skeleton: <SkeletonText width="5.5rem" />,
    },
    {
      key: 'expiresAt',
      label: 'Expires',
      render: (inq: Row) => (inq.expiresAt ? new Date(inq.expiresAt).toLocaleDateString() : '—'),
      skeleton: <SkeletonText width="5.5rem" />,
    },
    {
      key: 'actions',
      label: '',
      skeleton:
        direction === 'sent' ? (
          <InquirySourceControlsSkeleton />
        ) : (
          <InquiryTargetControlsSkeleton />
        ),
      render: (inq: Row) =>
        direction === 'sent' ? (
          <InquirySourceControls inquiry={inq as InquiryItem} />
        ) : (
          <InquiryTargetControls inquiry={inq as InquiryItem} />
        ),
    },
  ];

  const defaultEmptyMessage = `No ${direction} inquiries`;

  return (
    <Page
      title={pageTitle}
      description={
        direction === 'sent'
          ? 'Requests you have sent and where each one stands.'
          : 'Requests sent to you that may need your response.'
      }
      actions={
        <>
          {!filters?.statuses && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as InquiryStatus | '')}
              className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="changesRequested">Changes requested</option>
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
        </>
      }
    >
      <Table
        columns={columns}
        data={inquiries}
        keyExtractor={(inq) => inq.id}
        emptyMessage={emptyMessage ?? defaultEmptyMessage}
        empty={{
          icon: direction === 'sent' ? 'lucide:send' : 'lucide:inbox',
          description:
            direction === 'sent'
              ? 'Requests you send will be tracked here until they are resolved.'
              : 'Requests addressed to you will appear here for review.',
        }}
        isLoading={activeQuery.isLoading}
      />
    </Page>
  );
};
