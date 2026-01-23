import type { RouteConfig, z } from '@hono/zod-openapi';

// biome-ignore lint/suspicious/noExplicitAny: Allow any Zod object for params/query
export type ZodSchema = z.ZodObject<any>;

// biome-ignore lint/suspicious/noExplicitAny: Allow any Zod type for responses
export type ZodResponseSchema = z.ZodObject<any> | z.ZodUnion<any> | z.ZodArray<any> | z.ZodTypeAny;

export type RouteArgs<
  TResponse extends ZodResponseSchema | undefined,
  Params extends ZodSchema | undefined = undefined,
  Query extends ZodSchema | undefined = undefined,
> = Omit<RouteConfig, 'path' | 'method' | 'responses' | 'request'> & {
  model: string;
  submodel?: string;
  action?: string;
  params?: Params;
  query?: Query;
  responseSchema?: TResponse;
};

export type ResourceOptionals = {
  skipId?: boolean;
  many?: boolean;
  paginate?: boolean;
};

export type CreateRouteArgs<
  TResponse extends ZodResponseSchema | undefined,
  TBody extends ZodSchema,
  Params extends ZodSchema | undefined = undefined,
  Query extends ZodSchema | undefined = undefined,
> = RouteArgs<TResponse, Params, Query> & {
  bodySchema: TBody;
  sanitizeKeys?: string[];
  many?: boolean;
};

export type UpdateRouteArgs<
  TResponse extends ZodResponseSchema | undefined,
  TBody extends ZodSchema,
  Params extends ZodSchema | undefined,
  Query extends ZodSchema | undefined,
> = CreateRouteArgs<TResponse, TBody, Params, Query> & ResourceOptionals;

export type DeleteRouteArgs<
  TResponse extends ZodResponseSchema,
  Params extends ZodSchema | undefined,
  Query extends ZodSchema | undefined,
> = Omit<RouteArgs<TResponse, Params, Query>, 'responseSchema'> & ResourceOptionals;

export type ReadRouteArgs<
  TResponse extends ZodResponseSchema,
  Params extends ZodSchema | undefined = undefined,
  Query extends ZodSchema | undefined = undefined,
> = RouteArgs<TResponse, Params, Query> & ResourceOptionals;
