/**
 * @atlas
 * @kind helper
 * @partOf primitive:websockets
 * @uses none
 */
export type RouteAccess = 'granted' | 'rejected' | 'retryable';

export const routeAccessOf = (status: number): RouteAccess => {
  if (status >= 200 && status < 300) return 'granted';
  if (status === 429 || status >= 500) return 'retryable';
  return 'rejected';
};
