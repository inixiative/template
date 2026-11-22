/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */

/** Deduplicates and canonically sorts a multi-select string array for set-equality stability. */
export const deduplicateMultiSelect = (values: readonly string[]): string[] =>
  [...new Set(values)].sort();
