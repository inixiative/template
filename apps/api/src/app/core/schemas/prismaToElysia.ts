import { t, TSchema } from 'elysia';
import { Prisma } from '@prisma/client';
import { JSON_TYPE_REGISTRY } from 'src/app/core/schemas/jsonTypes';

// Map Prisma scalar types to Elysia schema types
const SCALAR_TYPE_MAP: Record<string, () => TSchema> = {
  String:   () => t.String(),
  Int:      () => t.Number(),
  Float:    () => t.Number(),
  Boolean:  () => t.Boolean(),
  DateTime: () => t.String(), // ISO 8601 string
  Decimal:  () => t.Number(),
  BigInt:   () => t.Number(),
  Json:     () => t.Any(),    // Default - override with jsonTypes
  Bytes:    () => t.String()  // Base64 encoded
};

interface IncludeOptions {
  [key: string]: boolean | IncludeOptions;
}

export const prismaModelToElysiaSchema = (
  modelName: keyof typeof Prisma.ModelName,
  include?: IncludeOptions
): TSchema => {
  const properties: Record<string, TSchema> = {};
  
  // Get scalar fields from Prisma enum
  const scalarFieldEnum = Prisma[`${modelName}ScalarFieldEnum` as keyof typeof Prisma] as Record<string, string>;
  const scalarFields = Object.values(scalarFieldEnum) as string[];
  
  // Get field metadata from DMMF
  const dmmf = Prisma.dmmf;
  const model = dmmf.datamodel.models.find(m => m.name === modelName);
  
  if (!model) throw new Error(`Model ${modelName} not found in Prisma schema`);
  
  // Process scalar fields
  for (const field of model.fields) {
    if (scalarFields.includes(field.name)) {
      properties[field.name] = createFieldSchema(field, modelName);
    }
  }
  
  // Process includes recursively
  if (include) {
    for (const [relationName, includeValue] of Object.entries(include)) {
      if (includeValue === false) continue;
      
      const relationField = model.fields.find(f => f.name === relationName && f.kind === 'object');
      if (!relationField) continue;
      
      const relatedSchema = prismaModelToElysiaSchema(
        relationField.type as keyof typeof Prisma.ModelName,
        typeof includeValue === 'object' ? includeValue : undefined
      );
      
      properties[relationName] = relationField.isList ? t.Array(relatedSchema) : relatedSchema;
    }
  }
  
  return t.Object(properties);
};

const createFieldSchema = (field: any, modelName: string): TSchema => {
  if (field.type === 'Json') return JSON_TYPE_REGISTRY[modelName]?.[field.name] || t.Any();
  
  const schema = SCALAR_TYPE_MAP[field.type]?.() || t.Any();
  
  if (field.isList) return t.Array(schema);
  
  return schema;
};