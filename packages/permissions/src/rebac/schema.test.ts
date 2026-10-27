import { describe, expect, it } from 'bun:test';
import { actionRuleSchema } from '@inixiative/permissions/actionRuleSchema';
import { rebacSchema } from '@template/permissions/rebac/schema';

describe('rebacSchema', () => {
  it('every action rule is positive: it passes only on what the record carries', () => {
    const refused = Object.entries(rebacSchema.permissions).flatMap(([resource, permission]) =>
      Object.entries(permission?.actions ?? {})
        .filter(([, rule]) => !actionRuleSchema.safeParse(rule).success)
        .map(([action]) => `${resource}.${action}`),
    );
    expect(refused).toEqual([]);
  });
});
