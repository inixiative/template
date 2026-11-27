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
import {
  ActionButtonsSkeleton,
  Badge,
  EmptyState,
  Page,
  SkeletonSizedCell,
  SkeletonStatus,
  SkeletonText,
  skeletonAttributes,
  Table,
} from '@template/ui/components';
import {
  InquirySourceControls,
  InquiryStatusBadge,
  InquiryTargetControls,
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
        <AdminAllInquiryTable inquiries={inquiries} isLoading={isLoading} />
      ) : (
        <Table
          columns={[
            { key: 'type', label: 'Type', render: (inq: Inquiry) => INQUIRY_TYPE_LABELS[inq.type] },
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
            },
            {
              key: 'target',
              label: 'Target',
              render: (inq: Inquiry) => inquiryPartyDisplayName(inq, 'target'),
            },
            {
              key: 'sentAt',
              label: 'Sent',
              render: (inq: Inquiry) =>
                inq.sentAt ? new Date(inq.sentAt).toLocaleDateString() : '—',
            },
            {
              key: 'expiresAt',
              label: 'Expires',
              render: (inq: Inquiry) =>
                inq.expiresAt ? new Date(inq.expiresAt).toLocaleDateString() : '—',
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

const adminAllInquiryControlsSkeleton = <ActionButtonsSkeleton labels={['Cancel']} />;

const adminAllInquiryHeadings = ['Type', 'Status', 'Actor', 'Sent', 'Expires', ''];

type AdminAllInquiryRowCells = {
  type: React.ReactNode;
  status: React.ReactNode;
  source: React.ReactNode;
  target: React.ReactNode;
  sentAt: React.ReactNode;
  expiresAt: React.ReactNode;
  sourceControls: React.ReactNode;
  targetControls: React.ReactNode;
};

// Each side's controls cell keeps a small button's height whether or not it has controls, so every inquiry is one height.
const AdminAllInquiryRow = ({
  cells,
  ...props
}: { cells: AdminAllInquiryRowCells } & React.HTMLAttributes<HTMLTableSectionElement>) => (
  // group on tbody so both rows highlight together on hover
  <tbody className="group border-b last:border-b-0" {...props}>
    <tr className="group-hover:bg-muted/40 transition-colors">
      <td rowSpan={2} className="px-4 py-3 text-sm align-middle">
        {cells.type}
      </td>
      <td rowSpan={2} className="px-4 py-3 text-sm align-middle">
        {cells.status}
      </td>
      <td className="px-4 pt-3 pb-1 text-sm">
        <span className="text-xs text-muted-foreground mr-1">↑</span>
        {cells.source}
      </td>
      <td rowSpan={2} className="px-4 py-3 text-sm align-middle">
        {cells.sentAt}
      </td>
      <td rowSpan={2} className="px-4 py-3 text-sm align-middle">
        {cells.expiresAt}
      </td>
      <td className="px-4 pt-3 pb-1">
        <SkeletonSizedCell skeleton={adminAllInquiryControlsSkeleton}>
          {cells.sourceControls}
        </SkeletonSizedCell>
      </td>
    </tr>
    <tr className="group-hover:bg-muted/40 transition-colors">
      <td className="px-4 pb-3 pt-1 text-sm">
        <span className="text-xs text-muted-foreground mr-1">↓</span>
        {cells.target}
      </td>
      <td className="px-4 pb-3 pt-1">
        <SkeletonSizedCell skeleton={adminAllInquiryControlsSkeleton}>
          {cells.targetControls}
        </SkeletonSizedCell>
      </td>
    </tr>
  </tbody>
);

const adminAllInquirySkeletonCells: AdminAllInquiryRowCells = {
  type: <SkeletonText width="6rem" />,
  status: <Badge>pending</Badge>,
  source: <SkeletonText width="8rem" />,
  target: <SkeletonText width="7rem" />,
  sentAt: <SkeletonText width="5rem" />,
  expiresAt: <SkeletonText width="5rem" />,
  sourceControls: adminAllInquiryControlsSkeleton,
  targetControls: adminAllInquiryControlsSkeleton,
};

const AdminAllInquiryTable = ({
  inquiries,
  isLoading,
}: {
  inquiries: Inquiry[];
  isLoading: boolean;
}) => {
  if (!isLoading && inquiries.length === 0) {
    return (
      <EmptyState
        icon="lucide:inbox"
        title="No inquiries"
        description="Inquiries sent between users, organizations and spaces will appear here."
        className="rounded-xl border border-dashed bg-muted/30"
      />
    );
  }

  return (
    <div className="border rounded-xl overflow-hidden bg-card">
      <SkeletonStatus isLoading={isLoading} />
      <table className="w-full">
        <thead className="bg-muted/60 border-b">
          <tr>
            {adminAllInquiryHeadings.map((h) => (
              <th
                key={h}
                className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        {isLoading &&
          Array.from({ length: 5 }, (_, row) => (
            <AdminAllInquiryRow
              // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows have no identity
              key={row}
              cells={adminAllInquirySkeletonCells}
              {...skeletonAttributes(true)}
            />
          ))}
        {inquiries.map((inq) => {
          const entry = inquiryTypeComponentsFor(inq.type);
          const SourceSummary = entry?.source?.summary;
          const TargetSummary = entry?.target?.summary;

          // Registry components expect InquiryItem / InquiryItem; admin item is structurally compatible
          const inquiryItem = inq as unknown as InquiryItem;
          return (
            <AdminAllInquiryRow
              key={inq.id}
              cells={{
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
              }}
            />
          );
        })}
      </table>
    </div>
  );
};
