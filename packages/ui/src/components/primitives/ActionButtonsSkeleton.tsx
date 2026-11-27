/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { Button } from '@template/ui/components/primitives/Button';

// The shape of a row's small buttons: `labels` for text buttons (outline), else `count` icon buttons (ghost).
export const ActionButtonsSkeleton = ({
  labels,
  count = 1,
}: {
  labels?: string[];
  count?: number;
}) => (
  <div className="flex justify-end gap-2">
    {labels
      ? labels.map((label) => (
          <Button key={label} type="button" variant="outline" size="sm">
            {label}
          </Button>
        ))
      : Array.from({ length: count }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton buttons have no identity
          <Button key={index} type="button" variant="ghost" size="sm">
            <span className="h-4 w-4" />
          </Button>
        ))}
  </div>
);
