const RESOLUTION_METADATA_KEYS = ['resolvedBy', 'resolvedAt', 'explanation', 'requestedBy', 'requestedAt'] as const;

export const resolveContent = (
  content: Record<string, unknown>,
  resolution: Record<string, unknown>,
): Record<string, unknown> => {
  const overrides = Object.fromEntries(
    Object.entries(resolution).filter(([key]) => !RESOLUTION_METADATA_KEYS.includes(key as (typeof RESOLUTION_METADATA_KEYS)[number])),
  );
  return { ...content, ...overrides };
};
