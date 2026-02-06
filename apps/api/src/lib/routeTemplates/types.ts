import type { RouteConfig, z } from '@hono/zod-openapi';
import type { Module } from '#/modules/modules';

// biome-ignore lint/suspicious/noExplicitAny: Allow any Zod object for params/query
export type ZodSchema = z.ZodObject<any>;

// biome-ignore lint/suspicious/noExplicitAny: Allow any Zod type for responses
export type ZodResponseSchema = z.ZodObject<any> | z.ZodUnion<any> | z.ZodArray<any> | z.ZodTypeAny;

export type RouteArgs = Omit<RouteConfig, 'path' | 'method' | 'responses' | 'request'> & {
  model: Module;
  submodel?: Module;
  action?: string;
  params?: ZodSchema;
  query?: ZodSchema;
  responseSchema?: ZodResponseSchema;
  bodySchema?: ZodSchema;
  sanitizeKeys?: string[];
  skipId?: boolean;
  many?: boolean;
  paginate?: boolean;
  admin?: boolean;
  searchableFields?: string[];
};
