import { prismaMap } from '@template/db/generated/prismaMap';

export type FieldDef = {
  kind: 'scalar' | 'enum' | 'object';
  type: string; // 'String' | 'Int' | 'Boolean' | 'DateTime' | 'Json' | <ModelName> | <EnumName>
  values?: readonly string[];
  relationName?: string;
  fromFields?: readonly string[];
  toFields?: readonly string[];
};

// `prismaMap` is exported `as const`, so its type is the full literal shape.
// For string-keyed runtime lookups we reshape it once at module boundary —
// one cast, no `unknown` laundering.
const MAP = prismaMap.models as Record<string, { fields: Record<string, FieldDef> }>;

const getField = (modelName: string, fieldName: string): FieldDef | undefined => MAP[modelName]?.fields?.[fieldName];

export const lookupField = (modelName: string, path: string): FieldDef | undefined => {
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

export const isStringPath = (modelName: string, path: string): boolean => {
  const field = lookupField(modelName, path);
  return field?.kind === 'scalar' && field.type === 'String';
};

export const isEnumPath = (modelName: string, path: string): boolean => lookupField(modelName, path)?.kind === 'enum';

export const isDatePath = (modelName: string, path: string): boolean => {
  const field = lookupField(modelName, path);
  return field?.kind === 'scalar' && field.type === 'DateTime';
};
