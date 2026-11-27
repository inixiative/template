/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */

// The loading cue for screen readers, placed beside a skeleton (whose inert content is not read).
export const SkeletonStatus = ({ isLoading }: { isLoading: boolean }) =>
  isLoading ? (
    <span role="status" className="sr-only">
      Loading…
    </span>
  ) : null;
