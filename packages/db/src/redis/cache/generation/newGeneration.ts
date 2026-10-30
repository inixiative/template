/**
 * @atlas
 * @kind helper
 * @partOf primitive:caching
 * @uses none
 */
export const GENERATION_TTL_SECONDS = 60 * 60 * 24;

export const newGeneration = (): string => crypto.randomUUID();
