/**
 * @atlas
 * @kind utils
 * @partOf primitive:routeTemplates
 * @uses none
 */
import type { RouteConfig } from '@hono/zod-openapi';
import { omit } from 'lodash-es';
import type { RouteArgs, RouteForbid } from '#/lib/routeTemplates/types';

type BuilderOnlyKey = Exclude<keyof RouteArgs, keyof RouteConfig>;
type ForbidKey = keyof RouteForbid;

const FORBID_OPENAPI_EXTENSIONS = {
  tokens: 'x-forbid-tokens',
  jwt: 'x-forbid-jwt',
  spoof: 'x-forbid-spoof',
  batch: 'x-forbid-batch',
} satisfies Record<ForbidKey, `x-forbid-${string}`>;

const FORBID_KEYS = Object.keys(FORBID_OPENAPI_EXTENSIONS) as readonly ForbidKey[];

// why: exhaustive against RouteArgs so newly added builder options cannot leak into OpenAPI
const BUILDER_ONLY_MAP = {
  model: true,
  submodel: true,
  action: true,
  params: true,
  query: true,
  responseSchema: true,
  bodySchema: true,
  bodyRequired: true,
  bodyRefinement: true,
  queryRefinement: true,
  paramsRefinement: true,
  sanitizeKeys: true,
  skipId: true,
  many: true,
  paginate: true,
  admin: true,
  internal: true,
  filterLens: true,
  includeDeleted: true,
  forbid: true,
} satisfies Record<BuilderOnlyKey, true>;

const BUILDER_ONLY_KEYS = Object.keys(BUILDER_ONLY_MAP) as readonly BuilderOnlyKey[];

export const toOpenApi = <T extends RouteConfig & Pick<RouteArgs, 'forbid'>>(
  route: T,
): Omit<T, BuilderOnlyKey> => {
  const openApiRoute = omit(route, BUILDER_ONLY_KEYS) as Omit<T, BuilderOnlyKey>;
  if (!route.forbid) return openApiRoute;
  const extensions: Record<string, true> = {};
  for (const key of FORBID_KEYS) {
    if (route.forbid[key]) extensions[FORBID_OPENAPI_EXTENSIONS[key]] = true;
  }
  return { ...openApiRoute, ...extensions };
};
