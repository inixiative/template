/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import {
  type OrganizationReadManySpacesResponse,
  organizationReadManySpaces,
  organizationReadManySpacesQueryKey,
} from '@template/sdk';
import { Page, Table } from '@template/ui/components';
import { useQuery } from '@template/ui/hooks';
import { apiQuery } from '@template/ui/lib/apiQuery';
import { useAppStore } from '@template/ui/store';

type Space = OrganizationReadManySpacesResponse['data'][number];

type OrganizationSpacesPageProps = {
  organizationId: string;
};

export const OrganizationSpacesPage = ({ organizationId }: OrganizationSpacesPageProps) => {
  const tenant = useAppStore((state) => state.tenant);
  const authSpaceUsers = useAppStore((state) => state.auth.spaceUsers);

  const { data, isLoading } = useQuery({
    queryKey: organizationReadManySpacesQueryKey({ path: { id: organizationId } }),
    queryFn: apiQuery((requestOptions: Parameters<typeof organizationReadManySpaces>[0]) =>
      organizationReadManySpaces({ ...requestOptions, path: { id: organizationId } }),
    ),
  });
  const spaces = data?.data ?? [];

  const columns = [
    {
      key: 'name',
      label: 'Space',
      render: (space: Space) => <span className="font-medium">{space.name}</span>,
    },
    {
      key: 'role',
      label: 'Your Role',
      render: (space: Space) => {
        const role = authSpaceUsers?.[space.id]?.role;
        return <span className="capitalize">{role ?? '—'}</span>;
      },
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (space: Space) => new Date(space.createdAt).toLocaleDateString(),
    },
  ];

  return (
    <Page title="Spaces" description="Spaces within this organization. Open one to work in its context.">
      {isLoading ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted/50" />
      ) : (
        <Table
          columns={columns}
          data={spaces}
          keyExtractor={(space) => space.id}
          onRowClick={(space: Space) => tenant.setSpace(space.id)}
          emptyMessage="No spaces in this organization yet"
          empty={{
            icon: 'lucide:layout-grid',
            description: 'Spaces created in this organization will appear here.',
          }}
        />
      )}
    </Page>
  );
};
