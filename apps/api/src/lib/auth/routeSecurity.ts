/**
 * @atlas
 * @kind utils
 * @partOf feature:auth, primitive:routeTemplates
 * @uses none
 */
import type { RouteConfig } from '@hono/zod-openapi';
import { personOnlyActions } from '@template/permissions/client';
import { castArray } from 'lodash-es';
import { securityRequirements } from '#/lib/auth/securitySchemes';
import type { RouteArgs } from '#/lib/routeTemplates/types';

const personOnly = new Set<string>(personOnlyActions);

const checksPersonOnlyAction = (middleware: RouteArgs['middleware']) =>
  castArray(middleware ?? []).some(
    (handler) => 'selfAction' in handler && personOnly.has(String(handler.selfAction)),
  );

export const securityForRoute = ({
  internal,
  security,
  middleware,
}: Pick<RouteArgs, 'internal' | 'security' | 'middleware'>): NonNullable<
  RouteConfig['security']
> => {
  if (security) return security;
  if (internal) return securityRequirements('internalSecret');
  if (checksPersonOnlyAction(middleware)) return securityRequirements('userJwt');
  return securityRequirements('userJwt', 'apiToken');
};
