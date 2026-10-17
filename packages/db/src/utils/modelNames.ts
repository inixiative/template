/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import { Prisma } from '@template/db/generated/client/client';
import { lowerFirst, upperFirst } from 'lodash-es';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ModelName = Prisma.ModelName;

export type AccessorName = Uncapitalize<ModelName>;

export type ModelTypeMap = { [K in ModelName]: Prisma.TypeMap['model'][K]['payload']['scalars'] };

export type ModelNameFromAccessor<A extends AccessorName> = Extract<ModelName, Capitalize<A>>;

// ─────────────────────────────────────────────────────────────────────────────
// PascalCase (ModelName) utilities
// ─────────────────────────────────────────────────────────────────────────────

export const ModelNames = Prisma.ModelName;

export const modelNames = Object.values(Prisma.ModelName);

const modelNameSet = new Set<string>(modelNames);

export const isModelName = (value: string): value is ModelName => modelNameSet.has(value);

export const toModelName = (model: string): ModelName => {
  const modelName = upperFirst(model);
  if (!isModelName(modelName)) throw new Error(`Unknown model '${model}'`);
  return modelName;
};

// ─────────────────────────────────────────────────────────────────────────────
// camelCase (AccessorName) utilities
// ─────────────────────────────────────────────────────────────────────────────

type AccessorTypeMap = { [K in ModelName as Uncapitalize<K>]: Uncapitalize<K> };

export const AccessorNames: AccessorTypeMap = Object.fromEntries(
  modelNames.map((name) => [lowerFirst(name), lowerFirst(name)]),
) as AccessorTypeMap;

export const accessorNames = Object.values(AccessorNames);

const accessorNameSet = new Set<string>(accessorNames);

export const isAccessorName = (value: string): value is AccessorName => accessorNameSet.has(value);

export const toAccessor = (model: string): AccessorName => {
  const accessor = lowerFirst(model);
  if (!isAccessorName(accessor)) throw new Error(`Unknown model '${model}'`);
  return accessor;
};
