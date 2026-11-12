/**
 * @atlas
 * @kind type
 * @partOf primitive:routeTemplates
 * @uses none
 */
import type { RouteConfig, z } from '@hono/zod-openapi';
import type { LensNarrowing } from '@inixiative/json-rules';
import type { Module } from '#/modules/modules';

export type ZodSchema = z.ZodObject<Record<string, z.ZodType>>;

export type ZodResponseSchema = z.ZodType;

export type RequestRefinement = {
  bivarianceHack(value: unknown, ctx: z.RefinementCtx): void | Promise<void>;
}['bivarianceHack'];

export type RouteArgs = Omit<RouteConfig, 'path' | 'method' | 'responses' | 'request'> & {
  model: Module;
  submodel?: Module;
  action?: string;
  params?: ZodSchema;
  query?: ZodSchema;
  responseSchema?: ZodResponseSchema;
  bodySchema?: ZodSchema;
  bodyRequired?: boolean;
  bodyRefinement?: RequestRefinement;
  queryRefinement?: RequestRefinement;
  paramsRefinement?: RequestRefinement;
  sanitizeKeys?: readonly string[];
  skipId?: boolean;
  many?: boolean;
  paginate?: boolean | 'cursor';
  admin?: boolean;
  internal?: boolean;
  filterLens?: LensNarrowing;
  includeDeleted?: boolean;
};
