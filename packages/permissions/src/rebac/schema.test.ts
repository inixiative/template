import { describe, expect, it } from 'bun:test';
import { validateActionRule, validateSchema } from '@inixiative/permissions';
import { schemaMap } from '@template/db/schemaMap';
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

  it('is valid against the schema map: every action a rule names exists, every read is inside the lens', () => {
    expect(validateSchema(schemaMap, rebacSchema).errors).toEqual([]);
  });
});
