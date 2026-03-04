import type { z } from 'zod';

const RESOLUTION_METADATA_KEYS = new Set(['resolvedBy', 'resolvedAt', 'explanation', 'requestedBy', 'requestedAt']);

export const resolveContent = (
  content: Record<string, unknown>,
  resolution: Record<string, unknown>,
  resolutionSchema: z.ZodTypeAny,
): Record<string, unknown> => {
  const shape = (resolutionSchema as z.ZodObject<z.ZodRawShape>).shape ?? {};
  const allowedOverrideKeys = Object.keys(shape).filter((k) => !RESOLUTION_METADATA_KEYS.has(k));

  const overrides = Object.fromEntries(
    Object.entries(resolution).filter(([key]) => allowedOverrideKeys.includes(key)),
  );
  return { ...content, ...overrides };
};
