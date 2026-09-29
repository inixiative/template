/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import type {
  MeReadManySegmentMembershipsResponse,
  MeReadManySegmentsResponse,
  OrganizationReadManySegmentMembershipsResponse,
  OrganizationReadManySegmentsResponse,
  SpaceReadManySegmentMembershipsResponse,
  SpaceReadManySegmentsResponse,
} from '@template/sdk';
import { Page, Table } from '@template/ui/components';
import { useQuery } from '@template/ui/hooks';
import { segmentContextQueries } from '@template/ui/lib/segmentContextQueries';
import { useAppStore } from '@template/ui/store';
import type { AuthenticatedContext } from '@template/ui/store/types/tenant';

type OwnedSegment =
  | MeReadManySegmentsResponse['data'][number]
  | OrganizationReadManySegmentsResponse['data'][number]
  | SpaceReadManySegmentsResponse['data'][number];

type Membership =
  | MeReadManySegmentMembershipsResponse['data'][number]
  | OrganizationReadManySegmentMembershipsResponse['data'][number]
  | SpaceReadManySegmentMembershipsResponse['data'][number];

const formatDate = (value: string) => new Date(value).toLocaleDateString();

const ownedColumns = [
  {
    key: 'name',
    label: 'Name',
    render: (segment: OwnedSegment) => <span className="font-medium">{segment.name}</span>,
  },
  { key: 'type', label: 'Type', render: (segment: OwnedSegment) => <span className="capitalize">{segment.type}</span> },
  {
    key: 'ruleIssues',
    label: 'Status',
    render: (segment: OwnedSegment) =>
      segment.ruleIssues.length ? (
        <span className="text-destructive" title={segment.ruleIssues.map((issue) => issue.detail).join('\n')}>
          Degraded: {segment.ruleIssues.map((issue) => issue.kind).join(', ')}
        </span>
      ) : (
        <span className="text-muted-foreground">Active</span>
      ),
  },
  {
    key: 'createdAt',
    label: 'Created',
    render: (segment: OwnedSegment) => <span className="text-muted-foreground">{formatDate(segment.createdAt)}</span>,
  },
];

const membershipColumns = [
  {
    key: 'segment',
    label: 'Segment',
    render: (membership: Membership) => <span className="font-medium">{membership.segment.name}</span>,
  },
  {
    key: 'owner',
    label: 'Owner',
    render: (membership: Membership) => <span className="capitalize">{membership.segment.ownerModel}</span>,
  },
  {
    key: 'createdAt',
    label: 'Since',
    render: (membership: Membership) => (
      <span className="text-muted-foreground">{formatDate(membership.createdAt)}</span>
    ),
  },
];

export const SegmentsPage = ({ view }: { view: 'owned' | 'memberships' }) => {
  const context = useAppStore((state) => state.tenant.context) as AuthenticatedContext;
  const segmentQueries = segmentContextQueries(context);

  const owned = useQuery({
    queryKey: segmentQueries.owned.queryKey,
    queryFn: segmentQueries.owned.queryFn,
    enabled: view === 'owned',
  });
  const memberships = useQuery({
    queryKey: segmentQueries.memberships.queryKey,
    queryFn: segmentQueries.memberships.queryFn,
    enabled: view === 'memberships',
  });

  const isLoading = view === 'owned' ? owned.isLoading : memberships.isLoading;

  return (
    <Page
      title={view === 'owned' ? 'Segments you own' : 'Segments you belong to'}
      description={
        view === 'owned'
          ? 'Named sets of your customers, computed once or continuously'
          : 'Where a provider has placed you as their customer'
      }
    >
      {isLoading ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted/50" />
      ) : view === 'owned' ? (
        <Table
          columns={ownedColumns}
          data={owned.data?.data ?? []}
          keyExtractor={(segment) => segment.id}
          emptyMessage="No segments yet"
          empty={{
            icon: 'lucide:filter',
            description: 'Segments you define will be listed here along with their rule status.',
          }}
        />
      ) : (
        <Table
          columns={membershipColumns}
          data={memberships.data?.data ?? []}
          keyExtractor={(membership) => membership.id}
          emptyMessage="Not a member of any segment"
          empty={{
            icon: 'lucide:users-round',
            description: 'When a provider adds you to one of their segments, it will show up here.',
          }}
        />
      )}
    </Page>
  );
};
