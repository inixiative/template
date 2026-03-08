import {
  type OrganizationReadManySpacesResponse,
  organizationReadManySpaces,
  organizationReadManySpacesQueryKey,
} from '@template/ui/apiClient';
import { Card, CardContent, CardHeader, CardTitle, Table } from '@template/ui/components';
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

  if (isLoading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Spaces</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Spaces within this organization</p>
        </CardHeader>
        <CardContent>
          <Table
            columns={columns}
            data={spaces}
            keyExtractor={(space) => space.id}
            onRowClick={(space: Space) => tenant.setSpace(space.id)}
            emptyMessage="No spaces in this organization yet"
          />
        </CardContent>
      </Card>
    </div>
  );
};
