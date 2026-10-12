/**
 * @atlas
 * @kind helper
 * @partOf primitive:flows
 * @uses none
 */
import type { Flow } from '@template/sdk';

const ALWAYS_ON_PATH = ['/login', '/auth/callback', '/dashboard'];

const pathnameOf = (url: string): string => new URL(url, 'http://app.invalid').pathname;

export const isOnFlowPath = (pathname: string, flow: Flow): boolean =>
  [
    ...ALWAYS_ON_PATH,
    ...(flow.returnUrl ? [pathnameOf(flow.returnUrl)] : []),
    ...flow.steps.flatMap(({ to }) => (to ? [pathnameOf(to)] : [])),
  ].includes(pathname);
