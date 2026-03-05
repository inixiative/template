import type * as runtime from '@prisma/client/runtime/client';
import type { Prisma } from '@template/db/generated/client/client';

export type ModelName = Prisma.ModelName;

// DefaultSelection gives full model with required scalars (like User, Organization exports)
export type ModelOf<K extends ModelName> = runtime.Types.Result.DefaultSelection<Prisma.TypeMap['model'][K]['payload']>;

export type CreateInputOf<K extends ModelName> = Prisma.TypeMap['model'][K]['operations']['create']['args']['data'];

export type Serialized<T> =
  T extends Date ? string
  : T extends Array<infer U> ? Array<Serialized<U>>
  : T extends object ? { [K in keyof T]: Serialized<T[K]> }
  : T;

type Defined<T> = Exclude<T, undefined>;

type ApplyOverrides<Base, Overrides> = Overrides extends object
  ? {
      [K in keyof Base]: K extends keyof Overrides
        ? Defined<Overrides[K]> extends never
          ? Base[K]
          : Defined<Overrides[K]> extends Base[K]
            ? Defined<Overrides[K]>
            : Base[K]
        : Base[K];
    }
  : Base;

export type ModelWithOverrides<K extends ModelName, O extends Partial<CreateInputOf<K>> | undefined = undefined> =
  ApplyOverrides<ModelOf<K>, O>;

export type BuildContext = {
  [K in ModelName as Uncapitalize<K>]?: ModelOf<K>;
};

export type BuildResult<K extends ModelName, O extends Partial<CreateInputOf<K>> | undefined = undefined> = {
  entity: ModelWithOverrides<K, O> & {
    __serialize(): Serialized<ModelWithOverrides<K, O>>;
  };
  context: BuildContext;
};

// Typed result - extends BuildContext with guaranteed dependencies
export type TypedBuildResult<
  K extends ModelName,
  Deps extends ModelName[],
  O extends Partial<CreateInputOf<K>> | undefined = undefined,
> = {
  entity: ModelWithOverrides<K, O> & {
    __serialize(): Serialized<ModelWithOverrides<K, O>>;
  };
  context: BuildContext & { [D in Deps[number]]: ModelOf<D> };
};

import type { Identifier } from '@template/db/utils/runtimeDataModel';

/**
 * FK format: { targetField: sourceField }
 * - string: source = target (e.g., "organizationId")
 * - Record: mapped (e.g., { id: "userId" } means set sourceField from targetField)
 */
export type DependencyConfig = {
  modelName: ModelName;
  foreignKey: Identifier;
  required: boolean;
};

export type FactoryConfig<K extends ModelName> = {
  defaults: () => Partial<CreateInputOf<K>>;
  dependencies?: Record<string, Partial<DependencyConfig> | null>;
};

export type Factory<K extends ModelName> = {
  build: <O extends Partial<CreateInputOf<K>> | undefined = undefined>(
    overrides?: O,
    context?: BuildContext,
  ) => Promise<BuildResult<K, O>>;
  create: (overrides?: Partial<CreateInputOf<K>>, context?: BuildContext) => Promise<BuildResult<K>>;
};
