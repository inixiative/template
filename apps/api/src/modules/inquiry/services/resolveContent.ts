import type { z } from 'zod';

const RESOLUTION_METADATA_KEYS = new Set(['explanation']);

export const resolveContent = (
  content: Record<string, unknown>,
  resolution: Record<string, unknown>,
  resolutionInputSchema: z.ZodTypeAny,
): Record<string, unknown> => {
  const shape = (resolutionInputSchema as { shape?: z.ZodRawShape }).shape ?? {};
  const allowedOverrideKeys = Object.keys(shape).filter((k) => !RESOLUTION_METADATA_KEYS.has(k));

  const overrides = Object.fromEntries(Object.entries(resolution).filter(([key]) => allowedOverrideKeys.includes(key)));
  return { ...content, ...overrides };
};
