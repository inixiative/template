import type { Story } from '@ladle/react';
import { type ColumnDef, DataTable } from '@template/ui/components/primitives/DataTable';
import { useMemo, useState } from 'react';

type Row = {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'invited' | 'suspended';
};

const rows: Row[] = [
  { id: '1', name: 'Casey Morgan', email: 'casey@example.com', status: 'active' },
  { id: '2', name: 'Ari Sutton', email: 'ari@example.com', status: 'invited' },
  { id: '3', name: 'Sky Patel', email: 'sky@example.com', status: 'suspended' },
];

const columns: ColumnDef<Row>[] = [
  { id: 'name', header: 'Name', accessorKey: 'name', sortable: true },
  { id: 'email', header: 'Email', accessorKey: 'email', sortable: true },
  { id: 'status', header: 'Status', accessorKey: 'status', sortable: true },
];

export const ListPage: Story = () => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  const selectedCount = selectedIds.length;
  const selectedSummary = useMemo(() => `${selectedCount} selected`, [selectedCount]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Users</h2>
      <DataTable
        data={rows}
        columns={columns}
        rowKey="id"
        page={page}
        pageSize={2}
        onPageChange={setPage}
        selectable
        columnVisibility
        onSelectionChange={(selected) => setSelectedIds(selected.map((row) => row.id))}
        bulkActions={() => <span className="text-sm text-muted-foreground">{selectedSummary}</span>}
        emptyMessage="No users found."
        labels={{
          emptyTitle: 'Empty',
          loadingTitle: 'Loading',
          errorTitle: 'Error',
          noPermissionTitle: 'Unauthorized',
          noPermissionMessage: 'You cannot view this list.',
        }}
      />
    </div>
  );
};
