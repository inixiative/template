import type { ContactType } from '@template/db/generated/client/enums';
import { ContactRegistry } from '@template/shared/contact';

export const normalizeContactValue = <K extends ContactType>(type: K, value: unknown) => {
  const def = ContactRegistry[type];
  const canonical = def.valueSchema.parse(def.parseInput(def.inputSchema.parse(value)));
  return { value: canonical, valueKey: def.toValueKey(canonical) };
};
