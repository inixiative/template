/**
 * @atlas
 * @kind utils
 * @partOf feature:auth, primitive:routeTemplates
 * @uses none
 */
import type { RouteConfig } from '@hono/zod-openapi';
import { securityRequirements } from '#/lib/auth/securitySchemes';
import type { RouteArgs } from '#/lib/routeTemplates/types';

export const securityForRoute = ({
  internal,
  security,
}: Pick<RouteArgs, 'internal' | 'security'>): NonNullable<RouteConfig['security']> => {
  if (security) return security;
  if (internal) return securityRequirements('internalSecret');
  return securityRequirements('sessionToken', 'apiToken', 'userJwt');
};
