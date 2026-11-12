import { describe, expect, it } from 'bun:test';
import { check } from '@inixiative/json-rules';
import {
  delegatedKeys,
  type ModelName,
  PolymorphismRegistry,
  polymorphicSchema,
  toModelName,
} from '@template/db';
import { polymorphismRules } from '#/hooks/falsePolymorphism/toRules';

const id = '019a0000-0000-7000-8000-000000000001';

describe('polymorphicSchema matches the write rule', () => {
  for (const [model, config] of Object.entries(PolymorphismRegistry)) {
    if (config.axes.length !== 1) continue;
    const [axis] = config.axes;
    const modelName: ModelName = toModelName(model);

    it(`${model}.${axis.field}`, () => {
      const rule = polymorphismRules[modelName];
      if (!rule) throw new Error(`${model} has no polymorphism rule`);
      const schema = polymorphicSchema(modelName as 'Integration', axis.field as 'ownerModel');
      const fkMap: Partial<Record<string, readonly string[]>> = axis.fkMap;
      const columns = [...new Set(Object.values(fkMap).flatMap((fks) => fks ?? []))];
      const verdicts = (row: Record<string, unknown>) => ({
        schema: schema.safeParse(row).success,
        rule: check(rule, row) === true,
      });

      for (const [value, required = []] of Object.entries(fkMap)) {
        const row = { [axis.field]: value, ...Object.fromEntries(required.map((fk) => [fk, id])) };
        expect({ value, ...verdicts(row) }).toEqual({ value, schema: true, rule: true });

        for (const fk of required) {
          const { [fk]: _missing, ...without } = row;
          expect({ value, fk, ...verdicts(without) }).toEqual({
            value,
            fk,
            schema: false,
            rule: false,
          });
        }
        const carried = delegatedKeys(axis, value);
        for (const fk of columns.filter((column) => !required.includes(column))) {
          expect({ value, fk, ...verdicts({ ...row, [fk]: id }) }).toEqual({
            value,
            fk,
            schema: false,
            rule: carried.includes(fk),
          });
        }
      }
    });
  }
});
