import type * as runtime from '@prisma/client/runtime/client';
import { Prisma } from '@template/db/generated/client/client';

export type ModelName = Prisma.ModelName;

// DefaultSelection gives full model with required scalars (like User, Organization exports)
export type ModelOf<K extends ModelName> = runtime.Types.Result.DefaultSelection<
  Prisma.TypeMap['model'][K]['payload']
>;

export type CreateInputOf<K extends ModelName> = Prisma.TypeMap['model'][K]['operations']['create']['args']['data'];

export type BuildContext = {
  [K in ModelName]?: ModelOf<K>;
};

export type BuildResult<K extends ModelName> = {
  entity: ModelOf<K>;
  context: BuildContext;
};

// Typed result - extends BuildContext with guaranteed dependencies
export type TypedBuildResult<K extends ModelName, Deps extends ModelName[]> = {
  entity: ModelOf<K>;
  context: BuildContext & { [D in Deps[number]]: ModelOf<D> };
};

export type DependencyConfig = {
  modelName: ModelName;
  foreignKey: string | string[];
  required: boolean;
};

export type FactoryConfig<K extends ModelName> = {
  defaults: () => Partial<CreateInputOf<K>>;
  dependencies?: Record<string, Partial<DependencyConfig> | null>;
};

export type Factory<K extends ModelName> = {
  build: (overrides?: Partial<CreateInputOf<K>>, context?: BuildContext) => Promise<BuildResult<K>>;
  create: (overrides?: Partial<CreateInputOf<K>>, context?: BuildContext) => Promise<BuildResult<K>>;
};
