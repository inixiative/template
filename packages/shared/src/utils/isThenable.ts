/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
export const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { then?: unknown }).then === 'function';
