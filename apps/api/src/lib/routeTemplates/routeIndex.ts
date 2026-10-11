/**
 * @atlas
 * @kind registry
 * @partOf primitive:routeTemplates
 * @uses none
 */

import type { RouteConfig } from '@hono/zod-openapi';
import type { LensNarrowing } from '@inixiative/json-rules';
import type { z } from 'zod';

export type IndexedRoute = RouteConfig & {
  operationId?: string;
  filterLens?: LensNarrowing;
  many?: boolean;
  paginate?: boolean;
  responseSchema?: z.ZodType;
};

const routes = new Map<string, IndexedRoute>();

export const indexRoute = (route: IndexedRoute): void => {
  if (!route.operationId) return;
  const indexed = routes.get(route.operationId);
  if (indexed && indexed !== route)
    throw new Error(`routeIndex: operationId "${route.operationId}" is registered twice`);
  routes.set(route.operationId, route);
};

export const routeByOperationId = (operationId: string): IndexedRoute | undefined =>
  routes.get(operationId);

export const readsRows = (
  route: IndexedRoute,
): route is IndexedRoute & { filterLens: LensNarrowing } =>
  route.method === 'get' && route.many === true && route.paginate === true && !!route.filterLens;
