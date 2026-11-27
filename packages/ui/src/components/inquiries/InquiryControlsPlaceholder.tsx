/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { Button } from '@template/ui/components/primitives/Button';

// The shape of InquirySourceControls / InquiryTargetControls (small buttons), for placeholders.
export const InquiryControlsPlaceholder = () => (
  <div className="flex justify-end gap-2">
    <Button type="button" variant="outline" size="sm" tabIndex={-1}>
      Cancel
    </Button>
  </div>
);
