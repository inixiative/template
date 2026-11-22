/**
 * @atlas
 * @kind utils
 * @partOf primitive:routeTemplates
 * @uses none
 */
import { z } from '@hono/zod-openapi';
import { omit } from 'lodash-es';
import type { ZodSchema } from '#/lib/routeTemplates/types';
import { transformJsonFields } from '#/lib/routeTemplates/utils/transformJsonFields';

const BASE_SANITIZE_KEYS = ['id', 'uuid', 'createdAt', 'updatedAt', 'deletedAt'] as const;
type BaseSanitizeKey = (typeof BASE_SANITIZE_KEYS)[number];

type SanitizedSchema<T extends ZodSchema, ExtraKeys extends string = never> = z.ZodObject<
  Omit<T['shape'], BaseSanitizeKey | ExtraKeys>
>;

export const sanitizeRequestSchema = <
  T extends ZodSchema,
  const ExtraKeys extends readonly string[] = readonly [],
>(
  schema: T,
  additionalSanitizeKeys: ExtraKeys = [] as unknown as ExtraKeys,
): SanitizedSchema<T, ExtraKeys[number]> => {
  if (schema.def.checks?.length)
    throw new Error(
      'Body schema carries refinements that rebuilding its shape would drop; pass them as bodyRefinement instead',
    );
  const allSanitizeKeys = [...BASE_SANITIZE_KEYS, ...additionalSanitizeKeys];
  const sanitizedShape = omit(schema.shape, allSanitizeKeys);
  const transformedShape = transformJsonFields(sanitizedShape);
  const rebuilt = z.object(transformedShape);
  // why: preserve catchall (e.g. .passthrough() / .strict()) via Zod 4's schema.def.catchall
  const catchall = schema.def.catchall as z.ZodType | undefined;
  return (catchall ? rebuilt.catchall(catchall) : rebuilt) as SanitizedSchema<T, ExtraKeys[number]>;
};
