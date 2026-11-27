/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import { useQuery } from '@tanstack/react-query';
import {
  type AdminInquiryReadManyResponses,
  adminInquiryReadMany,
  adminInquiryReadManyQueryKey,
  type InquiryItem,
} from '@template/sdk';
import { Badge, Page, SkeletonSized, SkeletonText, Table } from '@template/ui/components';
import {
  InquirySourceControls,
  InquirySourceControlsSkeleton,
  InquiryStatusBadge,
  InquiryTargetControls,
  InquiryTargetControlsSkeleton,
} from '@template/ui/components/inquiries';
import { apiQuery } from '@template/ui/lib/apiQuery';
import { inquiryPartyDisplayName } from '@template/ui/lib/inquiries/inquiryPartyDisplayName';
import {
  INQUIRY_TYPE_LABELS,
  type InquiryFilters,
  type InquiryStatus,
  inquiryFiltersToSearchFields,
  narrowInquiryFiltersWithinPageBounds,
} from '@template/ui/lib/inquiries/queryKeys';
import { inquiryTypeComponentsFor } from '@template/ui/lib/inquiries/registry';
import type * as React from 'react';
import { useMemo, useState } from 'react';

type Inquiry = AdminInquiryReadManyResponses[200]['data'][number];

type AdminInquiriesPageProps = {
  view: 'platform' | 'all';
  filters?: InquiryFilters;
};

export const AdminInquiriesPage = ({ view, filters }: AdminInquiriesPageProps) => {
  const [statusFilter, setStatusFilter] = useState<InquiryStatus | ''>('');

  const merged = narrowInquiryFiltersWithinPageBounds(filters, {
    statuses: statusFilter ? [statusFilter] : undefined,
  });
  // Recompute when the include-expired toggle changes so the cutoff stays in sync with the filter state.
  const expiredCutoff = useMemo(
    () => (merged.includeExpired === false ? new Date() : undefined),
    [merged.includeExpired],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const searchFields = inquiryFiltersToSearchFields(merged, expiredCutoff);
  if (view === 'platform') searchFields.targetModel = { in: ['admin'] };
  const hasSearchFields = Object.keys(searchFields).length > 0;

  const { data, isLoading } = useQuery({
    // searchFields supported server-side for all fields; cast because generated type omits it
    queryKey: adminInquiryReadManyQueryKey(
      hasSearchFields
        ? ({ query: { searchFields } } as Parameters<typeof adminInquiryReadManyQueryKey>[0])
        : undefined,
    ),
    queryFn: apiQuery((opts: Parameters<typeof adminInquiryReadMany>[0]) =>
      adminInquiryReadMany(opts),
    ),
  });

  const inquiries = Array.isArray(data?.data) ? data.data : [];

  const statusDropdown = !filters?.statuses && (
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
  );

  return (
    <Page
      title={view === 'platform' ? 'Platform inquiries' : 'All inquiries'}
      description={
        view === 'platform'
          ? 'Requests addressed to the platform that need an admin decision.'
          : 'Every inquiry across the platform, with controls for both sides.'
      }
      actions={statusDropdown}
    >
      {view === 'all' ? (
        <Table
          columns={adminAllInquiryColumns}
          data={inquiries}
          keyExtractor={(inq) => inq.id}
          emptyMessage="No inquiries"
          empty={{
            icon: 'lucide:inbox',
            description: 'Inquiries sent between users, organizations and spaces will appear here.',
          }}
          isLoading={isLoading}
          renderItemRows={(inq) => <AdminAllInquiryRows cells={adminAllInquiryCells(inq)} />}
          skeletonItemRows={<AdminAllInquiryRows cells={adminAllInquirySkeletonCells} />}
        />
      ) : (
        <Table
          columns={[
            {
              key: 'type',
              label: 'Type',
              render: (inq: Inquiry) => INQUIRY_TYPE_LABELS[inq.type],
              skeleton: <SkeletonText width="10rem" />,
            },
            {
              key: 'status',
              label: 'Status',
              render: (inq: Inquiry) => <InquiryStatusBadge inquiry={inq} />,
              skeleton: <Badge>pending</Badge>,
            },
            {
              key: 'source',
              label: 'Source',
              render: (inq: Inquiry) => inquiryPartyDisplayName(inq, 'source'),
              skeleton: <SkeletonText width="8rem" />,
            },
            {
              key: 'target',
              label: 'Target',
              render: (inq: Inquiry) => inquiryPartyDisplayName(inq, 'target'),
              skeleton: <SkeletonText width="8rem" />,
            },
            {
              key: 'sentAt',
              label: 'Sent',
              render: (inq: Inquiry) =>
                inq.sentAt ? new Date(inq.sentAt).toLocaleDateString() : '—',
              skeleton: <SkeletonText width="5.5rem" />,
            },
            {
              key: 'expiresAt',
              label: 'Expires',
              render: (inq: Inquiry) =>
                inq.expiresAt ? new Date(inq.expiresAt).toLocaleDateString() : '—',
              skeleton: <SkeletonText width="5.5rem" />,
            },
          ]}
          data={inquiries}
          keyExtractor={(inq) => inq.id}
          emptyMessage="No platform inquiries"
          empty={{
            icon: 'lucide:inbox',
            description: 'Requests that need platform approval will show up here.',
          }}
          isLoading={isLoading}
        />
      )}
    </Page>
  );
};

const adminAllInquiryColumns = [
  { key: 'type', label: 'Type' },
  { key: 'status', label: 'Status' },
  { key: 'actor', label: 'Actor' },
  { key: 'sentAt', label: 'Sent' },
  { key: 'expiresAt', label: 'Expires' },
  { key: 'controls', label: '' },
];

type AdminAllInquiryRowsCells = {
  type: React.ReactNode;
  status: React.ReactNode;
  source: React.ReactNode;
  target: React.ReactNode;
  sentAt: React.ReactNode;
  expiresAt: React.ReactNode;
  sourceControls: React.ReactNode;
  targetControls: React.ReactNode;
};

const adminAllInquirySkeletonCells: AdminAllInquiryRowsCells = {
  type: <SkeletonText width="10rem" />,
  status: <Badge>pending</Badge>,
  source: <SkeletonText width="12rem" />,
  target: <SkeletonText width="12rem" />,
  sentAt: <SkeletonText width="5.5rem" />,
  expiresAt: <SkeletonText width="5.5rem" />,
  sourceControls: <InquirySourceControlsSkeleton />,
  targetControls: <InquiryTargetControlsSkeleton />,
};

const AdminAllInquiryRows = ({ cells }: { cells: AdminAllInquiryRowsCells }) => (
  <>
    <tr className="group-hover:bg-muted/40 transition-colors">
      <td rowSpan={2} className="px-4 py-3 text-sm align-middle">
        <SkeletonSized skeleton={adminAllInquirySkeletonCells.type}>{cells.type}</SkeletonSized>
      </td>
      <td rowSpan={2} className="px-4 py-3 text-sm align-middle">
        <SkeletonSized skeleton={adminAllInquirySkeletonCells.status}>{cells.status}</SkeletonSized>
      </td>
      <td className="px-4 pt-3 pb-1 text-sm">
        <SkeletonSized skeleton={adminAllInquirySkeletonCells.source}>
          <span>
            <span className="text-xs text-muted-foreground mr-1">↑</span>
            {cells.source}
          </span>
        </SkeletonSized>
      </td>
      <td rowSpan={2} className="px-4 py-3 text-sm align-middle">
        <SkeletonSized skeleton={adminAllInquirySkeletonCells.sentAt}>{cells.sentAt}</SkeletonSized>
      </td>
      <td rowSpan={2} className="px-4 py-3 text-sm align-middle">
        <SkeletonSized skeleton={adminAllInquirySkeletonCells.expiresAt}>
          {cells.expiresAt}
        </SkeletonSized>
      </td>
      <td className="px-4 pt-3 pb-1">
        <SkeletonSized skeleton={adminAllInquirySkeletonCells.sourceControls}>
          {cells.sourceControls}
        </SkeletonSized>
      </td>
    </tr>
    <tr className="group-hover:bg-muted/40 transition-colors">
      <td className="px-4 pb-3 pt-1 text-sm">
        <SkeletonSized skeleton={adminAllInquirySkeletonCells.target}>
          <span>
            <span className="text-xs text-muted-foreground mr-1">↓</span>
            {cells.target}
          </span>
        </SkeletonSized>
      </td>
      <td className="px-4 pb-3 pt-1">
        <SkeletonSized skeleton={adminAllInquirySkeletonCells.targetControls}>
          {cells.targetControls}
        </SkeletonSized>
      </td>
    </tr>
  </>
);

const adminAllInquiryCells = (inq: Inquiry): AdminAllInquiryRowsCells => {
  const entry = inquiryTypeComponentsFor(inq.type);
  const SourceSummary = entry?.source?.summary;
  const TargetSummary = entry?.target?.summary;
  // Registry components expect InquiryItem; the admin item is structurally compatible
  const inquiryItem = inq as unknown as InquiryItem;
  return {
    type: INQUIRY_TYPE_LABELS[inq.type] ?? inq.type,
    status: <InquiryStatusBadge inquiry={inq} />,
    source: SourceSummary ? (
      <SourceSummary inquiry={inquiryItem} />
    ) : (
      inquiryPartyDisplayName(inq, 'source')
    ),
    target: TargetSummary ? (
      <TargetSummary inquiry={inquiryItem} />
    ) : (
      inquiryPartyDisplayName(inq, 'target')
    ),
    sentAt: inq.sentAt ? new Date(inq.sentAt).toLocaleDateString() : '—',
    expiresAt: inq.expiresAt ? new Date(inq.expiresAt).toLocaleDateString() : '—',
    sourceControls: <InquirySourceControls inquiry={inquiryItem} />,
    targetControls: <InquiryTargetControls inquiry={inquiryItem} />,
  };
};
