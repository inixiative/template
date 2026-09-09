/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
import type { RuleValue } from '@inixiative/json-rules';

export const bindValues = (names: Set<string>, values: Record<string, unknown>): Record<string, RuleValue> =>
  Object.fromEntries(
    [...names].map((name) => {
      if (!Object.hasOwn(values, name)) throw new Error(`Email bind "${name}" was not supplied`);
      return [name, values[name] as RuleValue];
    }),
  );
