/**
 * @atlas
 * @kind service
 * @partOf feature:inquiry
 * @uses none
 */
import type { z } from 'zod';

const RESOLUTION_METADATA_KEYS = new Set(['explanation']);

export const resolveContent = (
  content: Record<string, unknown>,
  resolution: Record<string, unknown>,
  resolutionInputSchema: z.ZodTypeAny,
): Record<string, unknown> => {
  const parsed = resolutionInputSchema.parse(resolution) as Record<string, unknown>;
  const overrides = Object.fromEntries(
    Object.keys(resolution)
      .filter((key) => key in parsed && !RESOLUTION_METADATA_KEYS.has(key))
      .map((key) => [key, parsed[key]]),
  );
  return { ...content, ...overrides };
};
