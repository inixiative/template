/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { PlaceholderText } from '@template/ui/components/primitives/PlaceholderText';
import type * as React from 'react';

const placeholderWidths = ['70%', '45%', '60%', '35%', '55%'];

export type TablePlaceholderColumn = { key: string; placeholder?: React.ReactNode };

// Rows for a body that carries loadingMaskAttributes; a column's placeholder stands in for cells taller than one line.
export const TablePlaceholderRows = ({
  columns,
  rows,
}: {
  columns: TablePlaceholderColumn[];
  rows: number;
}) =>
  Array.from({ length: rows }, (_, row) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows have no identity
    <tr key={row}>
      {columns.map((column, cell) => (
        <td key={column.key} className="px-4 py-3 text-sm">
          {column.placeholder ?? (
            <PlaceholderText width={placeholderWidths[(row + cell) % placeholderWidths.length]} />
          )}
        </td>
      ))}
    </tr>
  ));
