/**
 * @atlas
 * @kind config
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { createLens, type FieldMap, type Lens, type LensNarrowing, validateNarrowing } from '@inixiative/json-rules';
import { getModelRelations, getPolymorphismConfig, type ModelName, modelNames } from '@template/db';
import { prismaMap } from '@template/db/generated/prismaMap';

export const EMAIL_RULE_CONTEXT = 'EmailRuleContext';

const emailRuleContextMap = {
  ...prismaMap,
  models: {
    ...prismaMap.models,
    [EMAIL_RULE_CONTEXT]: {
      fields: {
        recipient: { kind: 'object', type: 'User', isRequired: true, isList: false },
        sender: { kind: 'scalar', type: 'Json', isRequired: false, isList: false },
        data: { kind: 'scalar', type: 'Json', isRequired: false, isList: false },
      },
    },
  },
} as unknown as FieldMap;

export const emailRuleLens: Lens = createLens({
  maps: { prisma: emailRuleContextMap },
  mapName: 'prisma',
  model: EMAIL_RULE_CONTEXT,
});

const referencedAxis = getPolymorphismConfig('RuleReference')?.axes.find((axis) => axis.field === 'referencedModel');

export const REFERENCEABLE_MODELS = Object.keys(referencedAxis?.fkMap ?? {}) as ModelName[];

const referenceable = new Set<string>(REFERENCEABLE_MODELS);

type ModelDefaults = { sources?: Record<string, true>; omits?: string[] };

const modelDefaults = (): Record<string, ModelDefaults> => {
  const models: Record<string, ModelDefaults> = {};
  for (const model of REFERENCEABLE_MODELS) models[model] = { sources: { id: true } };
  for (const model of modelNames) {
    const ownFields = (prismaMap.models as Record<string, { fields: Record<string, unknown> }>)[model]?.fields ?? {};
    const fkColumns = getModelRelations(model)
      .filter((relation) => referenceable.has(relation.targetModel) && relation.foreignKey)
      .flatMap((relation) =>
        typeof relation.foreignKey === 'string' ? [relation.foreignKey] : Object.values(relation.foreignKey ?? {}),
      )
      .filter((column): column is string => typeof column === 'string' && column in ownFields);
    if (!fkColumns.length) continue;
    models[model] = { ...models[model], omits: [...new Set(fkColumns)] };
  }
  return models;
};

export const emailRuleNarrowing: LensNarrowing = {
  parent: emailRuleLens,
  mapDefaults: { prisma: { models: modelDefaults() } },
};

validateNarrowing(emailRuleNarrowing);
