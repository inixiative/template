/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
import { type LensNarrowing, lensRequiredBindings, resolveLensBindings } from '@inixiative/json-rules';
import { bindValues } from '#/lib/email/bindValues';

export const bindLens = (narrowing: LensNarrowing, values: Record<string, unknown>): LensNarrowing =>
  resolveLensBindings(narrowing, bindValues(lensRequiredBindings(narrowing), values)) as LensNarrowing;
