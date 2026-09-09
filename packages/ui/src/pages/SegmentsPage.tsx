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
import { Card, CardContent, CardHeader, CardTitle, Table } from '@template/ui/components';
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
    key: 'reconcilePausedReason',
    label: 'Status',
    render: (segment: OwnedSegment) =>
      segment.reconcilePausedReason ? (
        <span className="text-destructive" title={segment.reconcilePausedDetail ?? undefined}>
          Paused: {segment.reconcilePausedReason}
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
    key: 'source',
    label: 'Added by',
    render: (membership: Membership) => (
      <span className="capitalize">{membership.source === 'rule' ? 'Rule' : 'Manual'}</span>
    ),
  },
  {
    key: 'createdAt',
    label: 'Since',
    render: (membership: Membership) => (
      <span className="text-muted-foreground">{formatDate(membership.createdAt)}</span>
    ),
  },
];

export const SegmentsPage = () => {
  const context = useAppStore((state) => state.tenant.context) as AuthenticatedContext;
  const segmentQueries = segmentContextQueries(context);

  const owned = useQuery({
    queryKey: segmentQueries.owned.queryKey,
    queryFn: segmentQueries.owned.queryFn,
  });
  const memberships = useQuery({
    queryKey: segmentQueries.memberships.queryKey,
    queryFn: segmentQueries.memberships.queryFn,
  });

  if (owned.isLoading || memberships.isLoading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Segments you own</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Named sets of your customers, static or rule-driven</p>
        </CardHeader>
        <CardContent>
          <Table
            columns={ownedColumns}
            data={owned.data?.data ?? []}
            keyExtractor={(segment) => segment.id}
            emptyMessage="No segments yet"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Segments you belong to</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Where a provider has placed you as their customer</p>
        </CardHeader>
        <CardContent>
          <Table
            columns={membershipColumns}
            data={memberships.data?.data ?? []}
            keyExtractor={(membership) => membership.id}
            emptyMessage="Not a member of any segment"
          />
        </CardContent>
      </Card>
    </div>
  );
};
