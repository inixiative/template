/**
 * @atlas
 * @kind helper
 * @partOf primitive:flows
 * @uses none
 */
export const pathnameOf = (url: string): string => new URL(url, 'http://app.invalid').pathname;
