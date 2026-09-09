/**
 * @atlas
 * @kind utils
 * @partOf primitive:websockets, feature:auth
 * @uses none
 */
import type { Context } from 'hono';

// Per-boot secret: probes are same-process, so only internal callers can present it.
// An external request setting x-auth-probe never matches and is handled normally.
export const AUTH_PROBE_HEADER = 'x-auth-probe';
export const AUTH_PROBE_SECRET = crypto.randomUUID();

export const isAuthProbe = (c: Context): boolean => c.req.header(AUTH_PROBE_HEADER) === AUTH_PROBE_SECRET;
