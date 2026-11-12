/**
 * @atlas
 * @kind helper
 * @partOf primitive:flows
 * @uses none
 */
import type { Flow } from '@template/sdk';
import { pathnameOf } from '@template/ui/lib/flows/pathnameOf';

const ALWAYS_ON_PATH = ['/login', '/auth/callback', '/dashboard'];

export const isOnFlowPath = (pathname: string, flow: Flow): boolean =>
  [
    ...ALWAYS_ON_PATH,
    ...(flow.returnUrl ? [pathnameOf(flow.returnUrl)] : []),
    ...flow.steps.flatMap(({ to }) => (to ? [pathnameOf(to)] : [])),
  ].includes(pathname);
