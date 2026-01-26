import { z } from '@hono/zod-openapi';
import { omit } from 'lodash';
import type { ZodSchema } from '#/lib/requestTemplates/types';
import { transformJsonFields } from '#/lib/requestTemplates/utils/transformJsonFields';

// Base system fields that are always sanitized
const BASE_SANITIZE_KEYS = ['id', 'uuid', 'createdAt', 'updatedAt', 'deletedAt'] as const;
type BaseSanitizeKey = (typeof BASE_SANITIZE_KEYS)[number];

// Type that represents a sanitized schema with base keys removed
type SanitizedSchema<T extends ZodSchema> = z.ZodObject<Omit<T['shape'], BaseSanitizeKey>>;

/**
 * Sanitizes a Zod object schema by:
 * 1. Removing system-managed fields (id, createdAt, updatedAt, etc.)
 * 2. Transforming z.unknown() JSON fields to Prisma-compatible InputJsonValue
 *
 * @param schema - The ZodObject schema to sanitize
 * @param additionalSanitizeKeys - Additional keys to remove beyond the base system fields
 * @returns A new ZodObject schema with fields omitted and JSON fields transformed
 */
export const sanitizeRequestSchema = <T extends ZodSchema>(
  schema: T,
  additionalSanitizeKeys: string[] = [],
): SanitizedSchema<T> => {
  const allSanitizeKeys = [...BASE_SANITIZE_KEYS, ...additionalSanitizeKeys];
  const shape = schema.shape;
  const sanitizedShape = omit(shape, allSanitizeKeys);
  const transformedShape = transformJsonFields(sanitizedShape);
  return z.object(transformedShape) as SanitizedSchema<T>;
};
