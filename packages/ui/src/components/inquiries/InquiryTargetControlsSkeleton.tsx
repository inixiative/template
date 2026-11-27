/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { Button } from '@template/ui/components/primitives/Button';

export const InquiryTargetControlsSkeleton = () => (
  <div className="flex justify-end gap-2">
    <Button type="button" variant="outline" size="sm">
      Approve
    </Button>
    <Button type="button" variant="outline" size="sm">
      Decline
    </Button>
  </div>
);
