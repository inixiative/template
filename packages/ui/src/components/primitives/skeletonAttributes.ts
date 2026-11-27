/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui
 * @uses none
 */

// While loading, the `[data-skeleton]` rules in packages/shared/styles/theme.css draw the element's
// content as bars of its own size; `inert` keeps it out of reach. Announce loading with SkeletonStatus
// outside the element, since nothing inside an inert element is read.
export const skeletonAttributes = (isLoading?: boolean) => ({
  inert: isLoading || undefined,
  'data-skeleton': isLoading ? '' : undefined,
});
