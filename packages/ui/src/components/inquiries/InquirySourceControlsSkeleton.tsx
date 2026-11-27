/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { Button } from '@template/ui/components/primitives/Button';

// InquirySourceControls for a sent inquiry, the usual case: its Cancel button.
export const InquirySourceControlsSkeleton = () => (
  <div className="flex justify-end gap-2">
    <Button type="button" variant="outline" size="sm">
      Cancel
    </Button>
  </div>
);
