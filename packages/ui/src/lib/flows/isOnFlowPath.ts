/**
 * @atlas
 * @kind utils
 * @partOf primitive:flows
 * @uses none
 */
import type { Flow } from '@template/sdk';
import { pathnameOf } from '@template/ui/lib/flows/pathnameOf';
import { TWO_FACTOR_PATH } from '@template/ui/lib/routeRedirect';

const ALWAYS_ON_PATH = ['/login', '/auth/callback', TWO_FACTOR_PATH, '/dashboard'];

export const isOnFlowPath = (pathname: string, flow: Flow): boolean =>
  [
    ...ALWAYS_ON_PATH,
    ...(flow.returnUrl ? [pathnameOf(flow.returnUrl)] : []),
    ...flow.steps.flatMap(({ to }) => (to ? [pathnameOf(to)] : [])),
  ].includes(pathname);
