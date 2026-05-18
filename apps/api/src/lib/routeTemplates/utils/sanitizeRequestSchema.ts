import { z } from '@hono/zod-openapi';
import { omit } from 'lodash-es';
import type { ZodSchema } from '#/lib/routeTemplates/types';
import { transformJsonFields } from '#/lib/routeTemplates/utils/transformJsonFields';

// Base system fields that are always sanitized
const BASE_SANITIZE_KEYS = ['id', 'uuid', 'createdAt', 'updatedAt', 'deletedAt'] as const;
type BaseSanitizeKey = (typeof BASE_SANITIZE_KEYS)[number];

// Type that represents a sanitized schema with base keys removed
type SanitizedSchema<T extends ZodSchema> = z.ZodObject<Omit<T['shape'], BaseSanitizeKey>>;

export const sanitizeRequestSchema = <T extends ZodSchema>(
  schema: T,
  additionalSanitizeKeys: readonly string[] = [],
): SanitizedSchema<T> => {
  const allSanitizeKeys = [...BASE_SANITIZE_KEYS, ...additionalSanitizeKeys];
  const sanitizedShape = omit(schema.shape, allSanitizeKeys);
  const transformedShape = transformJsonFields(sanitizedShape);
  // Preserve the input schema's catchall (e.g. `.passthrough()`) so per-route
  // shapes that intentionally allow extra keys (e.g. inquiryResolve forwarding
  // handler-specific resolution fields) keep working after sanitize.
  const rebuilt = z.object(transformedShape);
  const catchall = (schema as { _def?: { catchall?: z.ZodTypeAny } })._def?.catchall;
  return (catchall ? rebuilt.catchall(catchall) : rebuilt) as SanitizedSchema<T>;
};
