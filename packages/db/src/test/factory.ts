/**
 * Test Factory System
 *
 * Creates test entities with automatic dependency resolution.
 *
 * ## Triggering Optional Dependencies
 *
 * For optional dependencies (required: false), pass an empty object in overrides
 * to trigger creation:
 *
 *   tokenFactory.build({ organizationUser: {} })
 *
 * This follows Prisma's nested create pattern. Alternative API designs considered:
 *   - Boolean trigger: `{ organizationUser: true }`
 *   - Explicit array: `{ $create: ['organizationUser'] }`
 *   - Symbol marker: `{ organizationUser: CREATE }`
 *
 * ## Future: Reference Existing Entities
 *
 * Could support passing existing entity or unique field to link instead of create:
 *   - Pass entity: `{ user: existingUser }`
 *   - Pass unique field: `{ organization: { ref: { slug: 'acme' } } }`
 *   - Explicit create vs ref: `{ user: { create: {} } }` vs `{ user: { ref: { id } } }`
 *
 * Current approach chosen for familiarity with Prisma's `{ relation: { create: {} } }`.
 * Revisit if API feels awkward in practice.
 */

import { faker } from '@faker-js/faker';
import { db } from '@template/db/client';
import { toAccessor, toDelegate } from '@template/db/utils/modelNames';
import { getRuntimeDataModel } from '@template/db/utils/runtimeDataModel';
import { mergeDependencies } from '@template/db/test/dependencyInference';
import type {
  BuildContext,
  BuildResult,
  CreateInputOf,
  DependencyConfig,
  Factory,
  FactoryConfig,
  ModelName,
  ModelOf,
} from '@template/db/test/factoryTypes';

const autoInjectDbFields = (modelName: ModelName): Record<string, unknown> => {
  const dataModel = getRuntimeDataModel();
  const model = dataModel.models[modelName];
  if (!model) return {};

  const fieldNames = new Set(model.fields.map((f) => f.name));
  const injected: Record<string, unknown> = {};

  if (fieldNames.has('id')) injected.id = faker.string.uuid();
  if (fieldNames.has('createdAt')) injected.createdAt = new Date();
  if (fieldNames.has('updatedAt')) injected.updatedAt = new Date();
  if (fieldNames.has('deletedAt')) injected.deletedAt = null;

  return injected;
};

// Random offset ensures uniqueness across test runs even if cleanup fails
const sessionOffset = Math.floor(Math.random() * 1_000_000);
let globalSeq = sessionOffset;

export const getNextSeq = () => ++globalSeq;
export const resetSequence = () => {
  globalSeq = sessionOffset;
};

type RegisteredFactory = {
  defaults: () => Partial<unknown>;
  dependencies: Record<string, DependencyConfig>;
};

const factoryRegistry = new Map<ModelName, RegisteredFactory>();

export const createFactory = <K extends ModelName>(
  modelName: K,
  config: FactoryConfig<K>,
): Factory<K> => {
  const dependencies = mergeDependencies(modelName, config.dependencies);

  factoryRegistry.set(modelName, {
    defaults: config.defaults as () => Partial<unknown>,
    dependencies,
  });

  const generate = async (
    persist: boolean,
    overrides?: Partial<CreateInputOf<K>>,
    context?: BuildContext,
  ): Promise<BuildResult<K>> => {
    const ctx: BuildContext = context ?? {};

    const scalarFields: Record<string, unknown> = {};
    const relationFields: Record<string, unknown> = {};

    if (overrides) {
      for (const key in overrides) {
        if (dependencies[key]) {
          relationFields[key] = overrides[key as keyof typeof overrides];
        } else {
          scalarFields[key] = overrides[key as keyof typeof overrides];
        }
      }
    }

    const merged: Record<string, unknown> = {
      ...autoInjectDbFields(modelName),
      ...config.defaults(),
      ...scalarFields,
    };

    for (const [fieldName, dep] of Object.entries(dependencies)) {
      const relationValue = relationFields[fieldName];
      const registered = factoryRegistry.get(dep.modelName);

      if (!registered) {
        throw new Error(`Dependency factory not registered: ${dep.modelName}. Import it before using.`);
      }

      const depAccessor = toAccessor(dep.modelName);

      if (relationValue !== undefined) {
        const depFactory = createFactory(dep.modelName, {
          defaults: registered.defaults as () => Partial<CreateInputOf<typeof dep.modelName>>,
        });
        await (persist ? depFactory.create(relationValue as never, ctx) : depFactory.build(relationValue as never, ctx));
      } else if (!ctx[depAccessor] && dep.required) {
        const depFactory = createFactory(dep.modelName, {
          defaults: registered.defaults as () => Partial<CreateInputOf<typeof dep.modelName>>,
        });
        await (persist ? depFactory.create(undefined, ctx) : depFactory.build(undefined, ctx));
      }

      if (dep.foreignKey && ctx[depAccessor]) {
        const depEntity = ctx[depAccessor] as Record<string, unknown>;
        const fkFields = Array.isArray(dep.foreignKey) ? dep.foreignKey : [dep.foreignKey];

        for (const fk of fkFields) {
          // For composite FKs, copy matching field from dependent entity
          // For single FK (e.g., userId), use .id
          merged[fk] = fkFields.length > 1 ? depEntity[fk] : depEntity.id;
        }
      }
    }

    const entity: ModelOf<K> = persist
      ? await (toDelegate(db, modelName) as unknown as { create: (args: { data: typeof merged }) => Promise<ModelOf<K>> }).create({ data: merged })
      : (merged as ModelOf<K>);

    (ctx as Record<string, unknown>)[toAccessor(modelName)] = entity;

    return { entity, context: ctx };
  };

  return {
    build: (overrides, context) => generate(false, overrides, context),
    create: (overrides, context) => generate(true, overrides, context),
  };
};
