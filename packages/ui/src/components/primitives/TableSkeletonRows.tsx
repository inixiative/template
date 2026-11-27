/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { SkeletonText } from '@template/ui/components/primitives/SkeletonText';
import type { Column } from '@template/ui/components/primitives/Table';

// Rows for a body that carries skeletonAttributes; a column's skeleton stands in for cells taller than one line.
export const TableSkeletonRows = <T,>({
  columns,
  rows,
}: {
  columns: Pick<Column<T>, 'key' | 'skeleton'>[];
  rows: number;
}) =>
  Array.from({ length: rows }, (_, row) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows have no identity
    <tr key={row}>
      {columns.map((column, cell) => (
        <td key={column.key} className="px-4 py-3 text-sm">
          {column.skeleton ?? <SkeletonText seed={row + cell} />}
        </td>
      ))}
    </tr>
  ));
