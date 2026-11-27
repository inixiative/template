/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */

const skeletonTextWidths = ['70%', '45%', '60%', '35%', '55%'];

// A line of text that is not there yet. It is empty, so the `[data-skeleton] …:empty` rule draws it
// as one line box: exactly as tall as the text it stands for. `seed` picks a width from one list.
export const SkeletonText = ({ seed = 0, width }: { seed?: number; width?: string }) => (
  <span
    className="inline-block"
    style={{ width: width ?? skeletonTextWidths[seed % skeletonTextWidths.length] }}
  />
);
