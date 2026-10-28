import { describe, expect, it } from 'bun:test';
import { validateActionRule } from '@inixiative/permissions';
import { rebacSchema } from '@template/permissions/rebac/schema';

describe('rebacSchema', () => {
  it('every action rule is positive: it passes only on what the record carries', () => {
    const refused = Object.entries(rebacSchema.permissions).flatMap(([resource, permission]) =>
      Object.entries(permission?.actions ?? {})
        .filter(([, rule]) => !validateActionRule(rule).ok)
        .map(([action]) => `${resource}.${action}`),
    );
    expect(refused).toEqual([]);
  });
});
