/**
 * @atlas
 * @kind utils
 * @partOf feature:auth, primitive:routeTemplates
 * @uses none
 */
import type { RouteConfig } from '@hono/zod-openapi';
import { castArray } from 'lodash-es';
import { securityRequirements } from '#/lib/auth/securitySchemes';
import type { RouteArgs } from '#/lib/routeTemplates/types';
import { validateNotToken } from '#/middleware/validations/validateNotToken';

export const securityForRoute = ({
  internal,
  middleware,
  security,
}: Pick<RouteArgs, 'internal' | 'middleware' | 'security'>): NonNullable<RouteConfig['security']> => {
  if (security) return security;
  if (internal) return securityRequirements('internalSecret');
  if (castArray(middleware ?? []).includes(validateNotToken)) return securityRequirements('sessionToken');
  return securityRequirements('sessionToken', 'apiToken');
};
