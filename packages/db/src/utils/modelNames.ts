import { lowerFirst, upperFirst } from 'lodash-es';
import { Prisma } from '@template/db/generated/client/client';

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

/** Enum-like object: { User: 'User', Organization: 'Organization', ... } */
export const ModelNames = Prisma.ModelName;

/** Array of all model names: ['User', 'Organization', ...] */
export const modelNames = Object.values(Prisma.ModelName);

/** Type guard for ModelName */
export const isModelName = (value: string): value is ModelName => modelNames.includes(value as ModelName);

/** Convert accessor to ModelName: 'user' → 'User' */
export const toModelName = (accessor: string): ModelName | undefined => {
  const capitalized = upperFirst(accessor);
  return isModelName(capitalized) ? capitalized : undefined;
};

// ─────────────────────────────────────────────────────────────────────────────
// camelCase (AccessorName) utilities
// ─────────────────────────────────────────────────────────────────────────────

type AccessorTypeMap = { [K in ModelName as Uncapitalize<K>]: Uncapitalize<K> };

/** Enum-like object: { user: 'user', organization: 'organization', ... } */
export const AccessorNames: AccessorTypeMap = Object.fromEntries(
  modelNames.map((name) => [lowerFirst(name), lowerFirst(name)]),
) as AccessorTypeMap;

/** Array of all accessor names: ['user', 'organization', ...] */
export const accessorNames = Object.values(AccessorNames);

/** Type guard for AccessorName */
export const isAccessorName = (value: string): value is AccessorName => accessorNames.includes(value as AccessorName);

/** Convert ModelName to accessor: 'User' → 'user' */
export const toAccessor = (model: ModelName): AccessorName => lowerFirst(model) as AccessorName;
