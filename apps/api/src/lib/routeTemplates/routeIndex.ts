/**
 * @atlas
 * @kind registry
 * @partOf primitive:routeTemplates
 * @uses none
 */

import type { RouteConfig } from '@hono/zod-openapi';
import type { LensNarrowing } from '@inixiative/json-rules';

export type IndexedRoute = RouteConfig & {
  operationId?: string;
  filterLens?: LensNarrowing;
  many?: boolean;
  paginate?: boolean;
};

const routes = new Map<string, IndexedRoute>();

export const indexRoute = (route: IndexedRoute): void => {
  if (route.operationId) routes.set(route.operationId, route);
};

export const routeByOperationId = (operationId: string): IndexedRoute | undefined =>
  routes.get(operationId);
