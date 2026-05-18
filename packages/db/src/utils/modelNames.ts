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

export const isModelName = (value: string): value is ModelName => modelNames.includes(value as ModelName);

export const toModelName = (accessor: string): ModelName | undefined => {
  const capitalized = upperFirst(accessor);
  return isModelName(capitalized) ? capitalized : undefined;
};

// ─────────────────────────────────────────────────────────────────────────────
// camelCase (AccessorName) utilities
// ─────────────────────────────────────────────────────────────────────────────

type AccessorTypeMap = { [K in ModelName as Uncapitalize<K>]: Uncapitalize<K> };

export const AccessorNames: AccessorTypeMap = Object.fromEntries(
  modelNames.map((name) => [lowerFirst(name), lowerFirst(name)]),
) as AccessorTypeMap;

export const accessorNames = Object.values(AccessorNames);

export const isAccessorName = (value: string): value is AccessorName => accessorNames.includes(value as AccessorName);

export const toAccessor = (model: ModelName): AccessorName => lowerFirst(model) as AccessorName;
