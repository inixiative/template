/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui
 * @uses none
 */

// The `[data-loading-mask]` rules in packages/shared/styles/theme.css turn the data inside into pulsing bars.
export const loadingMaskAttributes = (isLoading: boolean) => ({
  'aria-busy': isLoading,
  inert: isLoading,
  'data-loading-mask': isLoading ? '' : undefined,
});
