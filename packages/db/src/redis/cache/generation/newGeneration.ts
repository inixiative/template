/**
 * @atlas
 * @kind helper
 * @partOf primitive:caching
 * @uses none
 */
// Outlives any compute, so a generation never expires under a running read. Random, not a counter:
// a generation that expired and was set again cannot match one captured before it.
export const GENERATION_TTL_SECONDS = 60 * 60 * 24;

export const newGeneration = (): string => crypto.randomUUID();
