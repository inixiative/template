/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */

const skeletonTextWidths = ['8rem', '5rem', '7rem', '4rem', '6rem'];

// A line of text that is not there yet. It is empty, so the `[data-skeleton] …:empty` rule draws it
// as one line box: exactly as tall as the text it stands for. Widths are rem, since a percentage
// resolves against nothing in an auto-layout table cell. `widthIndex` picks a width from one list.
export const SkeletonText = ({
  widthIndex = 0,
  width,
}: {
  widthIndex?: number;
  width?: string;
}) => (
  <span
    className="inline-block"
    style={{ width: width ?? skeletonTextWidths[widthIndex % skeletonTextWidths.length] }}
  />
);
