/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses primitive:shared
 */
import { projectByPath } from '@inixiative/json-rules';
import { OPAQUE_SLOT, type SlotLens } from '@template/email/rules/emailLens';

export const emptyRowFor = (slot: SlotLens | undefined): Record<string, unknown> => {
  if (!slot || slot === OPAQUE_SLOT) return {};
  const [root] = projectByPath(slot).values();
  if (!root) return {};
  return Object.fromEntries(
    Object.entries(root.fields)
      .filter(([, field]) => field.kind === 'object')
      .map(([name, field]) => [name, field.isList ? [] : null]),
  );
};
