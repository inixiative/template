/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { Button } from '@template/ui/components/primitives/Button';

// The shape of a row's small icon buttons. A text button's skeleton is the real button, icon included.
export const ActionButtonsSkeleton = ({ count = 1 }: { count?: number }) => (
  <div className="flex justify-end gap-2">
    {Array.from({ length: count }, (_, index) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: skeleton buttons have no identity
      <Button key={index} type="button" variant="ghost" size="sm">
        <svg className="h-4 w-4" aria-hidden="true" />
      </Button>
    ))}
  </div>
);
