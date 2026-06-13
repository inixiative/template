/**
 * @atlas
 * @kind helper
 * @partOf feature:webhooks
 */
// URL.hostname wraps IPv6 literals in brackets ([::1]); strip them for classification.
export const hostnameOf = (parsed: URL): string => parsed.hostname.replace(/^\[|\]$/g, '');
