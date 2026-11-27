/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { Skeleton } from '@template/ui/components/primitives/Skeleton';

const placeholderWidths = ['70%', '45%', '60%', '35%', '55%'];

export const TablePlaceholderRows = ({
  columnCount,
  rows,
}: {
  columnCount: number;
  rows: number;
}) =>
  Array.from({ length: rows }, (_, row) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows have no identity
    <tr key={row}>
      {Array.from({ length: columnCount }, (_, cell) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholder cells have no identity
        <td key={cell} className="px-4 py-3 text-sm">
          <Skeleton
            className="h-4"
            style={{ width: placeholderWidths[(row + cell) % placeholderWidths.length] }}
          />
        </td>
      ))}
    </tr>
  ));
