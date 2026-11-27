/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { Button } from '@template/ui/components/primitives/Button';

// The shape of a row's icon buttons (ghost, small), for a Table column's placeholder.
export const RowActionPlaceholder = ({ count = 1 }: { count?: number }) => (
  <div className="flex justify-end gap-2">
    {Array.from({ length: count }, (_, index) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: placeholder buttons have no identity
      <Button key={index} type="button" variant="ghost" size="sm" tabIndex={-1}>
        <span className="h-4 w-4" />
      </Button>
    ))}
  </div>
);
