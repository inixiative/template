/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
import {
  bindLens as bindLensValues,
  type LensNarrowing,
  listLensBindings,
} from '@inixiative/json-rules';
import { bindValues } from '#/lib/email/bindValues';

export const bindLens = (
  narrowing: LensNarrowing,
  values: Record<string, unknown>,
): LensNarrowing => bindLensValues(narrowing, bindValues(listLensBindings(narrowing), values));
