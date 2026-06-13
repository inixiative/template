/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
import { z } from 'zod';

// uuidv7: 32 hex chars in 8-4-4-4-12 grouping, version nibble = 7,
// variant nibble (top of 4th group) = 8/9/a/b. All schema ids are
// dbgenerated as uuidv7 — this is the canonical id format we accept on
// :id params (with ?lookup= as the escape hatch for other columns).
const UUID_V7_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isUuidV7 = (value: string): boolean => UUID_V7_RE.test(value);

export const uuidV7Schema = z.string().refine(isUuidV7, { message: 'Must be a uuidv7' });
