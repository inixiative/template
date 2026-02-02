import { PolymorphismRegistry, type PolymorphicAxis, type PolymorphicValue, type ModelName } from '@template/db';
import type { Condition } from '@inixiative/json-rules';
import { Operator } from '@inixiative/json-rules';

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

    return { all: conditions };
  });

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
