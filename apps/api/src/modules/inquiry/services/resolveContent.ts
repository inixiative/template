import type { z } from 'zod';

const RESOLUTION_METADATA_KEYS = new Set(['explanation']);

export const resolveContent = (
  content: Record<string, unknown>,
  resolution: Record<string, unknown>,
  resolutionInputSchema: z.ZodTypeAny,
): Record<string, unknown> => {
  // TODO: using .shape introspection breaks for ZodEffects (e.g. .refine()) — consider switching to
  // parsing the resolution against the schema and using the parsed keys as the allowlist instead.
  const shape = (resolutionInputSchema as { shape?: z.ZodRawShape }).shape ?? {};
  const allowedOverrideKeys = Object.keys(shape).filter((k) => !RESOLUTION_METADATA_KEYS.has(k));

  const overrides = Object.fromEntries(Object.entries(resolution).filter(([key]) => allowedOverrideKeys.includes(key)));
  return { ...content, ...overrides };
};
