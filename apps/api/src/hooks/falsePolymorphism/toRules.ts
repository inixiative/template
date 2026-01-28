import type { ModelName } from '@template/db';
import type { Condition } from '@inixiative/json-rules';
import { Operator } from '@inixiative/json-rules';
import { FalsePolymorphismRegistry, type FalsePolymorphismRelation } from './registry';

const buildPolymorphismRule = (model: ModelName, config: FalsePolymorphismRelation): Condition => {
  const allFks = [...new Set(Object.values(config.fkMap).flat())];
  const typeValues = Object.keys(config.fkMap);

  const branches = typeValues.map((typeValue) => {
    const requiredFks = config.fkMap[typeValue];
    const forbiddenFks = allFks.filter((fk) => !requiredFks.includes(fk));

    const conditions: Condition[] = [
      { field: config.typeField, operator: Operator.equals, value: typeValue },
      ...requiredFks.map((fk) => ({
        field: fk,
        operator: Operator.notEmpty,
        value: true,
        error: `${model} with ${config.typeField}=${typeValue} requires ${fk}`,
      })),
      ...forbiddenFks.map((fk) => ({
        field: fk,
        operator: Operator.isEmpty,
        value: true,
        error: `${model} with ${config.typeField}=${typeValue} cannot have ${fk}`,
      })),
    ];

    return { all: conditions };
  });

  return {
    any: branches,
    error: `Invalid ${config.typeField} value on ${model}`,
  };
};

export const polymorphismRules: Partial<Record<ModelName, Condition>> = {};

for (const [model, configs] of Object.entries(FalsePolymorphismRegistry)) {
  const modelName = model as ModelName;
  const rules = (configs ?? []).map((config) => buildPolymorphismRule(modelName, config));
  if (rules.length === 1) polymorphismRules[modelName] = rules[0];
  else if (rules.length > 1) polymorphismRules[modelName] = { all: rules };
}
