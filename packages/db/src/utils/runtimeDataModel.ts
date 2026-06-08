import { prismaMap } from '@template/db/generated/prismaMap';
import { type AccessorName, type ModelName, toAccessor, toModelName } from '@template/db/utils/modelNames';

export type Identifier = string | Record<string, string>;

export type RelationInfo = {
  relationName: string;
  targetModel: ModelName;
  targetAccessor: AccessorName;
  foreignKey: Identifier | null;
};

type RelationField = { kind: string; type: string; fromFields?: string[]; toFields?: string[] };

// fromFields = local FK columns, toFields = the columns they reference on the
// target. A single same-named pair collapses to a string; multiple pairs become
// a { referencedField: localField } map; reverse relations (no fromFields) have
// no foreign key.
const toForeignKey = (fromFields: string[], toFields: string[]): Identifier | null => {
  if (fromFields.length === 0 || fromFields.length !== toFields.length) return null;
  if (fromFields.length === 1 && fromFields[0] === toFields[0]) return fromFields[0];
  const composite: Record<string, string> = {};
  for (let i = 0; i < fromFields.length; i++) composite[toFields[i]] = fromFields[i];
  return composite;
};

export const getModelRelations = (modelName: ModelName): RelationInfo[] => {
  const model = prismaMap.models[modelName];
  if (!model) throw new Error(`Model ${modelName} not found in prismaMap`);

  const fields = model.fields as Record<string, RelationField>;
  return Object.entries(fields)
    .filter(([, field]) => field.kind === 'object')
    .map(([relationName, field]) => ({
      relationName,
      targetModel: field.type as ModelName,
      targetAccessor: toAccessor(field.type as ModelName),
      foreignKey: toForeignKey(field.fromFields ?? [], field.toFields ?? []),
    }));
};

export const getAccessorRelations = (accessor: AccessorName): RelationInfo[] => {
  const modelName = toModelName(accessor);
  if (!modelName) {
    throw new Error(`Unknown accessor: ${accessor}`);
  }
  return getModelRelations(modelName);
};
