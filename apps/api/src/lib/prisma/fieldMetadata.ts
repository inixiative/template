import { prismaMap } from '@template/permissions/rebac/prismaMap.gen';

type FieldDef = {
  kind: 'scalar' | 'enum' | 'object';
  type: string;
  values?: readonly string[];
};

const getField = (modelName: string, fieldName: string): FieldDef | undefined => {
  const model = (prismaMap as unknown as Record<string, { fields?: Record<string, FieldDef> }>)[modelName];
  return model?.fields?.[fieldName];
};

const lookupField = (modelName: string, path: string): FieldDef | undefined => {
  const segments = path.split('.');
  let currentModel: string | undefined = modelName;
  for (let i = 0; i < segments.length; i += 1) {
    if (!currentModel) return undefined;
    const field = getField(currentModel, segments[i]);
    if (!field) return undefined;
    if (i === segments.length - 1) return field;
    if (field.kind !== 'object') return undefined;
    currentModel = field.type;
  }
  return undefined;
};

/**
 * True if the given dotted path on `modelName` resolves to an enum field.
 * Used by buildWhereClause to switch emission from { contains, mode } to
 * exact equality on enum columns (Prisma rejects contains+mode on enums).
 */
export const isEnumPath = (modelName: string, path: string): boolean => lookupField(modelName, path)?.kind === 'enum';
