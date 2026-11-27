/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */

// One line of text that is not there yet: exactly one line box tall, so the row keeps its height.
export const PlaceholderText = ({ width }: { width: string }) => (
  <span className="inline-block align-top h-lh py-0.5" style={{ width }}>
    &nbsp;
  </span>
);
