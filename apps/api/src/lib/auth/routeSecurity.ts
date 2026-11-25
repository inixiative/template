/**
 * @atlas
 * @kind utils
 * @partOf feature:auth, primitive:routeTemplates
 * @uses none
 */
import type { RouteConfig } from '@hono/zod-openapi';
import { type SecuritySchemeName, securityRequirements } from '#/lib/auth/securitySchemes';
import type { RouteArgs } from '#/lib/routeTemplates/types';

export const securityForRoute = ({
  internal,
  security,
  forbid,
}: Pick<RouteArgs, 'internal' | 'security' | 'forbid'>): NonNullable<RouteConfig['security']> => {
  if (security) return security;
  if (internal) return securityRequirements('internalSecret');
  const schemes: SecuritySchemeName[] = [];
  if (!forbid?.jwt) schemes.push('userJwt');
  if (!forbid?.tokens) schemes.push('apiToken');
  return securityRequirements(...schemes);
};
