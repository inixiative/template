/**
 * @atlas
 * @kind utils
 * @partOf primitive:websockets, feature:auth
 * @uses none
 */
import type { Context } from 'hono';

// Per-boot secrets: probes are same-process, so only internal callers can present them.
export const AUTH_PROBE_HEADER = 'x-auth-probe';
export const AUTH_PROBE_SECRET = crypto.randomUUID();
export const SYSTEM_PROBE_SECRET = crypto.randomUUID();

export const isAuthProbe = (c: Context): boolean => {
  const presented = c.req.header(AUTH_PROBE_HEADER);
  return presented === AUTH_PROBE_SECRET || presented === SYSTEM_PROBE_SECRET;
};

export const isSystemProbe = (c: Context): boolean => c.req.header(AUTH_PROBE_HEADER) === SYSTEM_PROBE_SECRET;
