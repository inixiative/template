/**
 * @atlas
 * @kind utils
 * @partOf primitive:routeTemplates
 * @uses none
 */
import type { RouteConfig } from '@hono/zod-openapi';
import { omit } from 'lodash-es';

// Fields our route builders carry on the route object for internal use (handlers,
// SDK lens, validation inputs) but that must never reach the OpenAPI document:
// bodySchema/params/query are raw zod and serialize as zod internals — a recursive
// one (z.lazy) is a cyclic object that breaks JSON.stringify. Strip at the
// registration boundary so the full object stays available everywhere else.
const BUILDER_ONLY_KEYS = [
  'model',
  'submodel',
  'action',
  'params',
  'query',
  'responseSchema',
  'bodySchema',
  'sanitizeKeys',
  'skipId',
  'many',
  'paginate',
  'admin',
  'internal',
  'filterLens',
] as const;

export const toOpenApi = <T extends RouteConfig>(route: T): Omit<T, (typeof BUILDER_ONLY_KEYS)[number]> =>
  omit(route, BUILDER_ONLY_KEYS) as Omit<T, (typeof BUILDER_ONLY_KEYS)[number]>;
