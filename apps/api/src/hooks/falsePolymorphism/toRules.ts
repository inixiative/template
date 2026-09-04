import type { Condition } from '@inixiative/json-rules';
import { Operator } from '@inixiative/json-rules';
import { type ModelName, type PolymorphicAxis, type PolymorphicValue, PolymorphismRegistry } from '@template/db';

const buildAxisRule = (model: ModelName, axis: PolymorphicAxis): Condition => {
  const allFks = [...new Set(Object.values(axis.fkMap).flat())];
  const typeValues = Object.keys(axis.fkMap) as PolymorphicValue[];

  const branches = typeValues.map((typeValue) => {
    const requiredFks = axis.fkMap[typeValue] ?? [];
    const forbiddenFks = allFks.filter((fk: string) => !requiredFks.includes(fk));

    const conditions: Condition[] = [
      { field: axis.field, operator: Operator.equals, value: typeValue },
      ...requiredFks.map((fk) => ({
        field: fk,
        operator: Operator.notEmpty,
        value: true,
        error: `${model} with ${axis.field}=${typeValue} requires ${fk}`,
      })),
      ...forbiddenFks.map((fk) => ({
        field: fk,
        operator: Operator.isEmpty,
        value: true,
        error: `${model} with ${axis.field}=${typeValue} cannot have ${fk}`,
      })),
    ];

    // The id column and the FK are two clocks on one fact: they must agree the moment the edge is
    // written, and they are allowed to diverge later, when the database nulls the FK out from
    // under a row that is still named. Agreement is only checkable for a single-column FK.
    if (axis.idField && requiredFks.length === 1) {
      conditions.push({
        field: axis.idField,
        operator: Operator.equals,
        path: requiredFks[0],
        error: `${model}.${axis.idField} must equal ${requiredFks[0]} when ${axis.field}=${typeValue}`,
      } as Condition);
    }

    return { all: conditions };
  });

  // why: a purged target leaves every FK null while the id still names it. Reachable only through
  // why: ON DELETE SET NULL, never through a write - a create still has to satisfy a typed branch.
  if (axis.idField) {
    branches.push({
      all: [
        ...allFks.map((fk) => ({ field: fk, operator: Operator.isEmpty, value: true })),
        { field: axis.idField, operator: Operator.notEmpty, value: true },
      ] as Condition[],
    });
  }

  return {
    any: branches,
    error: `Invalid ${axis.field} value on ${model}`,
  };
};

export const polymorphismRules: Partial<Record<ModelName, Condition>> = {};

for (const [model, config] of Object.entries(PolymorphismRegistry)) {
  if (!config) continue;
  const modelName = model as ModelName;
  const rules = config.axes.map((axis) => buildAxisRule(modelName, axis));
  if (rules.length === 1) polymorphismRules[modelName] = rules[0];
  else if (rules.length > 1) polymorphismRules[modelName] = { all: rules };
}
