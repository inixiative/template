/**
 * @atlas
 * @kind helper
 * @partOf primitive:caching
 * @uses none
 */
import { uuidv7 } from 'uuidv7';

export const GENERATION_TTL_SECONDS = 60 * 60 * 24;

export const newGeneration = (): string => uuidv7();
