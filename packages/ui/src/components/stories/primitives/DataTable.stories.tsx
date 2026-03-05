import type { Story } from '@ladle/react';
import { type ColumnDef, DataTable } from '@template/ui/components/primitives/DataTable';

type Row = {
  id: string;
  name: string;
  role: string;
};

const columns: ColumnDef<Row>[] = [
  { id: 'name', header: 'Name', accessorKey: 'name', sortable: true },
  { id: 'role', header: 'Role', accessorKey: 'role', sortable: true },
];

const rows: Row[] = [
  { id: '1', name: 'Ari', role: 'Owner' },
  { id: '2', name: 'Casey', role: 'Editor' },
  { id: '3', name: 'Riley', role: 'Viewer' },
];

const labels = {
  emptyTitle: 'No rows',
  loadingTitle: 'Loading table',
  errorTitle: 'Load failed',
  noPermissionTitle: 'Access denied',
  noPermissionMessage: 'You do not have permission to view this table.',
};

export const Default: Story = () => <DataTable data={rows} columns={columns} rowKey="id" labels={labels} />;

export const Loading: Story = () => <DataTable data={[]} columns={columns} rowKey="id" isLoading labels={labels} />;

export const Empty: Story = () => (
  <DataTable data={[]} columns={columns} rowKey="id" emptyMessage="No matching records." labels={labels} />
);

export const ErrorState: Story = () => (
  <DataTable data={[]} columns={columns} rowKey="id" error="Request failed." labels={labels} />
);

export const NoPermission: Story = () => (
  <DataTable data={[]} columns={columns} rowKey="id" noPermission labels={labels} />
);
