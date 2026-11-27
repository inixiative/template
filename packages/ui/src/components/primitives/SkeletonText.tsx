/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */

const skeletonTextWidths = ['8rem', '5rem', '7rem', '4rem', '6rem'];

// why: rem, since a percentage resolves against nothing in an auto-layout table cell
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
