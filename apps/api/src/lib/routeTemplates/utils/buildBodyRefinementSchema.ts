/**
 * @atlas
 * @kind utils
 * @partOf primitive:routeTemplates
 * @uses none
 */
import { type RouteConfig, z } from '@hono/zod-openapi';
import type { BodyRefinement } from '#/lib/routeTemplates/types';

export type BodyRefinementSchema = {
  schema: z.ZodType;
  bodyRequired: boolean;
};

export const buildBodyRefinementSchema = (route: RouteConfig): BodyRefinementSchema | undefined => {
  const { bodyRefinement } = route as { bodyRefinement?: BodyRefinement<unknown> };
  if (!bodyRefinement) return undefined;

  const body = route.request?.body;
  const bodySchema = body?.content['application/json']?.schema as z.ZodType | undefined;
  if (!bodySchema) throw new Error('bodyRefinement requires a JSON body schema');

  const refinement = z.unknown().superRefine(bodyRefinement);
  return {
    schema: bodySchema._zod.def.type === 'array' ? z.array(refinement) : refinement,
    bodyRequired: Boolean(body?.required),
  };
};
