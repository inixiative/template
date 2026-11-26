/**
 * @atlas
 * @kind utils
 * @partOf feature:email
 * @uses primitive:shared
 */
import { projectLens } from '@inixiative/json-rules';
import { OPAQUE_SLOT, type SlotLens } from '@template/email/rules/emailLens';
import { mapValues, pickBy } from 'lodash-es';

export const emptyRowFor = (slot: SlotLens | undefined): Record<string, unknown> => {
  if (!slot || slot === OPAQUE_SLOT) return {};
  const [root] = Object.values(projectLens(slot));
  if (!root) return {};
  return mapValues(
    pickBy(root.fields, (field) => field.kind === 'object'),
    (field) => (field.isList ? [] : null),
  );
};
